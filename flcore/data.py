"""Dataset loading. Returns flat float32 features in [0,1] and int labels:
    load_dataset(name) -> (X_train, y_train, X_test, y_test)

Backends:
  * synthetic  - Gaussian blobs, zero-dependency, for CI/smoke tests
  * mnist      - via torchvision if available, else the raw IDX files if present
  * cifar10    - via torchvision (production; needs torch on the real machine)
  * pathmnist  - via medmnist (production)

The FL core consumes flat vectors, so the NumPy MLP works directly; the torch
CNN backend reshapes internally.
"""
from __future__ import annotations

import numpy as np


def load_dataset(name: str, seed: int = 0):
    name = name.lower()
    if name == "synthetic":
        return _synthetic(seed)
    if name == "mnist":
        return _mnist()
    if name in ("cifar10", "cifar-10"):
        return _torchvision_cifar10()
    if name == "pathmnist":
        return _pathmnist()
    raise ValueError(f"unknown dataset: {name}")


def _synthetic(seed: int, n_train=6000, n_test=1000, num_classes=10, dim=64):
    """10-class Gaussian blobs - separable enough to show learning + non-IID drop."""
    rng = np.random.default_rng(seed)
    centers = rng.normal(0, 3, (num_classes, dim))

    def make(n):
        y = rng.integers(0, num_classes, n)
        X = centers[y] + rng.normal(0, 1.0, (n, dim))
        return X.astype(np.float32), y.astype(np.int64)

    Xtr, ytr = make(n_train)
    Xte, yte = make(n_test)
    # standardize
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-6
    return (Xtr - mu) / sd, ytr, (Xte - mu) / sd, yte


def _mnist():
    from torchvision import datasets
    tr = datasets.MNIST(root="./data", train=True, download=True)
    te = datasets.MNIST(root="./data", train=False, download=True)
    Xtr = (tr.data.numpy().reshape(-1, 784) / 255.0).astype(np.float32)
    Xte = (te.data.numpy().reshape(-1, 784) / 255.0).astype(np.float32)
    return Xtr, tr.targets.numpy().astype(np.int64), Xte, te.targets.numpy().astype(np.int64)


def _torchvision_cifar10():
    from torchvision import datasets
    tr = datasets.CIFAR10(root="./data", train=True, download=True)
    te = datasets.CIFAR10(root="./data", train=False, download=True)
    Xtr = (tr.data.reshape(len(tr.data), -1) / 255.0).astype(np.float32)
    Xte = (te.data.reshape(len(te.data), -1) / 255.0).astype(np.float32)
    return Xtr, np.array(tr.targets, np.int64), Xte, np.array(te.targets, np.int64)


def _pathmnist():
    from medmnist import PathMNIST
    tr = PathMNIST(split="train", download=True)
    te = PathMNIST(split="test", download=True)
    Xtr = (tr.imgs.reshape(len(tr.imgs), -1) / 255.0).astype(np.float32)
    Xte = (te.imgs.reshape(len(te.imgs), -1) / 255.0).astype(np.float32)
    return Xtr, tr.labels.ravel().astype(np.int64), Xte, te.labels.ravel().astype(np.int64)
