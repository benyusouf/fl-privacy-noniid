# Results explorer

A browsable supplement to the dissertation *Federated Learning for Privacy-Preserving AI Models:
A Study on Secure, Decentralized Model Training with Non-IID Data*.

**The dissertation stands alone.** Every figure and table an examiner needs is in the written
document. This site is a supplement and never a dependency — nothing in the thesis should say
"see the website for full results".

Built on the Vuexy MUI Next.js admin template (commercial licence — see *Before you push* below).

---

## First run

Work through these in order — they are arranged cheapest-failure-first, so a
problem surfaces at the step that explains it rather than as a wall of build
output.

```bash
cd viz

node scripts/build-data.mjs    # 1. no install needed — should print "72 runs"
node scripts/test-chart-geometry.mjs   # 2. no install needed — 34 tests

pnpm install                   # 3. resolves from the committed lockfile
pnpm typecheck                 # 4. tsc --noEmit — THE step that has never run
pnpm lint                      # 5. eslint
pnpm dev                       # 6. serves on :3000
```

Steps 1 and 2 need no packages at all and were run during development. **Step 4
is the one that has never been executed anywhere** — see *What is verified*
below. Run it before `pnpm dev`; a type error is much easier to read from `tsc`
than from a failing Next.js build.

`pnpm check` runs 1, 2, 4 and 5 in sequence.

`pnpm install` should resolve entirely from the committed `pnpm-lock.yaml`: the
site adds **no runtime dependencies** to the template. See *Charts* below.

### If pnpm install fails with ENOTCONN

On this machine the npm registry is blocked at the network layer by a Microsoft
Defender web-content policy named **"[TE] NPM URL Block"**, delivered by a
leftover Intune enrolment. `cdn.jsdelivr.net` is blocked by the same policy. The
symptom is `read ENOTCONN` on tarball fetches — the connection is terminated
mid-stream rather than refused, so it looks like a flaky network.

The site is built to survive this: it adds **no dependencies** to the template,
so everything it needs should already be in the local pnpm store.

```bash
pnpm install --offline                       # store only, no network
pnpm install --offline --no-frozen-lockfile  # if the lockfile is stale
pnpm install --prefer-offline                # network only for genuine misses
```

The data pipeline and the geometry tests need no packages at all and run
regardless.

A secondary consequence: nothing in this project may depend on a CDN at build or
run time, because jsdelivr is blocked too. Icon generation uses the local
`@iconify/json` package rather than a CDN, which is why `build:icons` works.

The real fix is removing the stale device management, which is a separate matter
from this project.

`predev` and `prebuild` both run `scripts/build-data.mjs`, which reads `../results/` and writes
`src/data/generated/results.json`, which is **generated, never committed** — `results/` is the
source of truth. `predev`, `prebuild`, `pretypecheck` and `prelint` all run it first, so any entry
point works on a fresh clone. You can also run it alone at any time:

```bash
node scripts/build-data.mjs
```

It prints the run count, every excluded directory with a reason, and any integrity warning.
It has no npm dependencies, so it works before `pnpm install` has ever been run.

## Deploying to GitHub Pages

Deployment is automatic. `.github/workflows/deploy-viz.yml` builds and publishes on every push to
`main` that touches `viz/`, `results/` or the workflow itself.

**One manual setting, once:** repository Settings → Pages → Build and deployment → Source →
**GitHub Actions**. Without it the deploy step fails with a permissions error that does not
explain itself.

The workflow owns the whole pipeline: install, generate the results bundle from `results/`, run
the tests, type-check, lint, build the static export and upload it. Nothing generated is committed
and nothing has to be kept in sync by hand. A broken build never reaches the published site, and
the job summary records the run count and dataset hash that was deployed.

This matters locally too: the npm registry is blocked on the development machine (see below), but
GitHub's runners are not, so CI is the one place a clean `pnpm install --frozen-lockfile` always
works.

### Building it by hand

```bash
pnpm build:site       # data -> static export with basePath -> viz/out/
```

For inspecting the real export locally. The workflow is the only deployment path — it uploads
`viz/out` as a Pages artifact, so there is no committed build output and **no `docs/` directory**
in this repository.

`BASEPATH` must be set to the repository name when building for a project page, and left unset in
development or every link acquires a doubled prefix. Both the workflow and `build:site` handle
this. Both also write `.nojekyll`, which is **not optional**: GitHub Pages runs Jekyll by default
and Jekyll ignores directories beginning with an underscore, which includes Next.js's `_next/` —
i.e. all JavaScript and CSS. Without it the site deploys as unstyled HTML and the cause is
invisible from the browser.

---

## What was changed in the template, and why

Five things blocked static export. Four were expected; the fifth was not.

1. **`output: 'export'` added** to `next.config.ts`. Without it there is nothing for Pages to serve.
2. **The `redirects()` block removed.** `redirects()` is unsupported under static export and would
   have failed the build. The home page moved from `/home` to the root route instead, and
   `themeConfig.homePageUrl` follows it.
3. **`assetPrefix` deliberately not set.** Next.js already prefixes assets with `basePath`; setting
   both double-prefixes every asset URL.
4. **`images.unoptimized: true`** — the image optimizer needs a server.
5. **`src/@core/utils/serverHelpers.ts` rewritten.** The stock version calls `cookies()` from
   `next/headers`, which is a dynamic server API that static export rejects. All three layouts call
   it, so the build would have failed immediately. It now returns `themeConfig` defaults at build
   time; `SettingsProvider` still reads the real cookie client-side via `useObjectCookie`, so theme
   switching works. A returning visitor with a non-default theme may see one frame of the default
   before hydration — the normal trade-off for a static site.

Both `.gitignore` files were modified, deliberately:

- `viz/.gitignore` gained `src/data/generated/` — build output, regenerated by every entry point.
- The repository-root `.gitignore` had `data/` **anchored** to `/data/`. Without a leading slash
  git applies the pattern at every depth, so it was matching `viz/src/data/` as well as the 341 MB
  dataset directory it was written for. The template's `src/data/navigation/` files were being
  silently excluded from the repository as a result. Nothing imported them yet, so nothing broke —
  it would have surfaced later as a missing module in CI with no obvious cause.

Nothing outside `viz/` was modified. `flcore/`, `attacks/`, `experiments/`, `run.py`, `results/`
and `tests/` are untouched — `results/` is read only.

---

## Where the numbers come from

`scripts/build-data.mjs` reads each run directory and emits one bundle. No value is recomputed,
rescaled or corrected; derived fields are selections from recorded values, never adjustments.

Excluded from the site:

- `*.pre-D49` and `*.d50-twostage` — superseded by later methodology decisions
- `attack_probe/` — no `config_used.json`, unresolved provenance
- `smoke_synthetic_dir01/` — a synthetic fixture, not a result

That leaves **72 runs**: 68 federated, 4 centralized.

The bundle was verified cell-by-cell against the source CSVs with an independent parser —
4,200 metric rows, plus every partition report, timing file and configuration — with zero
mismatches. Re-run that check any time the data changes.

---

## Things the site deliberately does not smooth over

- **Communication cost does not distinguish the strategies.** `bytes_up` is recorded identically
  (11,347,800/round) for FedAvg, FedProx, SCAFFOLD, MOON and FedAvgM — the base
  `params × 4 × clients` formula with no protocol multiplier. SCAFFOLD's control-variate ×2 is
  not in the data. The site reports the recorded figures and flags the gap, so that what is shown
  matches the CSVs an examiner can open. **Unresolved — see `v2/FRONTEND_DATA_AUDIT.md`.**
- **Timings are never plotted.** Shown per run, labelled unreliable.
- **Single-seed cells are marked `ⁿ¹` everywhere** and error bars are min–max ranges, not standard
  deviations or confidence intervals.
- **SCAFFOLD's divergence is presented with its peak named** — 37.89% at round 48, final 8.24% at
  round 60, against an 11.11% chance line.
- **MOON carries its configuration caveat** wherever it appears.
- **Phases B–E are shown as pending**, not hidden.

---

## Before you push

The Vuexy licence is held, so committing the template source is settled.

The remaining decision is not legal but academic: free GitHub Pages requires a **public**
repository, so the first successful deploy publishes the Phase A results before the dissertation
has been examined. That is a reasonable thing to do — an open, browsable artefact strengthens the
contribution — but it should be a deliberate choice rather than a side effect of pushing a branch.
If you would rather wait, leave the Pages source unset until you are ready; the workflow will run,
build, pass its checks and fail only at the final publish step.

---

## Charts — no charting library

The charts are hand-written inline SVG. There is no Recharts, no Chart.js, nothing added to
`package.json` at all.

A charting library was chosen first and then dropped. The stated reason at the time — no route to
the npm registry — turned out to be a limitation of the environment the site was authored in, not
of this machine, so it was never a real constraint on the project. The decision was revisited on
its merits and the SVG charts kept, because dropping the library holds the dependency set at
exactly the template's committed lockfile and, more usefully, makes the charts testable:

- **`src/lib/chart-geometry.mjs`** holds all the arithmetic — scales, tick selection, line paths,
  band layout, tick formatting. Plain JavaScript with JSDoc types, consumed by TypeScript through
  `allowJs`. It runs under bare Node with no toolchain.
- **`scripts/test-chart-geometry.mjs`** covers it: 34 assertions including zero-width domains,
  reversed domains, null gaps in a line, empty series and floating-point noise in tick labels.
  One of them caught a real bug — tick labels rendering `0.25` as `0.3`.
- **`scripts/preview-charts.mjs`** renders the real charts from the real results bundle to
  standalone SVG in `scripts/preview/`, using the same geometry calls the components make. That is
  how the volatility problem in §3a of the data audit was found: the curves were rendered and
  looked at.

The React components are deliberately thin — they turn those numbers into SVG elements and do no
arithmetic of their own, so the part that can be numerically wrong is the part under test.

If you would rather have a charting library later, the change is contained to
`AccuracyCurveChart.tsx`, `HellingerScatterChart.tsx`, `ClientDistributionChart.tsx` and
`ChartFrame.tsx`. Nothing else touches them.

---

## What is verified, and what is not

**Verified by execution:**

- The data pipeline runs, and its output was cross-checked cell-by-cell against the source CSVs
  with an independent parser: 72 runs, 24,960 metric cells, every partition report, timing file,
  configuration and derived statistic. Zero mismatches.
- Chart geometry: 34 unit tests passing.
- The charts themselves were rendered from real data and inspected.
- Import resolution across all 528 path-aliased and relative imports; `'use client'` placement;
  brace balance; unused imports; package declarations.

- **`tsc --noEmit` passes**, once `node_modules` exists. This covers the two things that looked
  riskiest: the MUI `Select` value unions in `RunExplorer.tsx`, which mix `number` with the string
  `'all'`, and `src/lib/chart-geometry.mjs`, which is JavaScript consumed through `allowJs` and
  JSDoc.
- **ESLint passes** with the template's own configuration.

**Not verified:**

- **`next build` has not been run end to end.** It needs a platform-native SWC binary, which
  cannot be fetched on a machine where the registry is blocked. CI runs it, and it is the gate
  that matters most — treat a green workflow run as the real confirmation.
- **Nothing has been checked visually beyond the charts.** Those were rendered as standalone SVG
  from real data and inspected, so the geometry is sound, but layout, spacing, dark mode and the
  SVG tooltips are unverified against real MUI styling in a browser.

Report what breaks and it can be fixed directly.
