'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import Figure from './Figure'
import { ArrowDefs, Box, Edge, useSvgId } from './primitives'

/*
 * Figure 2.4, the conceptual framework, as revised to three research questions
 * (D97). Five bodies of theory feed one framework, which answers three
 * questions. Hover or focus any box to trace it.
 */

const THEORIES = [
  { t: 'Distributed optimisation', l: ['Bounded dissimilarity;', 'client drift.', 'Li et al. (2020);', 'Karimireddy et al. (2020)'] },
  { t: 'Learning under shift', l: ['Weight divergence; inconsistent', 'loss landscapes.', 'Zhao et al. (2018);', 'Seo, Catak and Rong (2024)'] },
  { t: 'Differential privacy', l: ['Sensitivity; composition;', 'the protected unit.', 'Dwork et al. (2006);', 'Abadi et al. (2016)'] },
  { t: 'Secure multiparty comp.', l: ['Honest-but-curious adversary;', 'masked aggregation.', 'Bonawitz et al. (2017)'] },
  { t: 'Information leakage', l: ['Gradients are invertible', 'in principle.', 'Zhu et al. (2019);', 'Geiping et al. (2020)'] }
]

const PARTS = [
  { t: 'Cross-silo federation', l: ['15 institutional clients, full', 'participation, persistent state'] },
  { t: 'Controlled heterogeneity', l: ['Dirichlet, pathological and quantity-', 'skew partitions, reported against', 'Hellinger distance'] },
  { t: 'Privacy pipeline', l: ['Sample-level DP-SGD with per-example', 'clipping and accounting, plus', 'pairwise-masked secure aggregation'] },
  { t: 'Threat evaluation', l: ['Gradient-inversion attack against', 'an honest-but-curious server'] }
]

const RQS = [
  { t: 'RQ1', phase: 'Phase A', l: ['FL against centralized training under', 'increasing non-IID severity, across', 'four aggregation strategies'] },
  { t: 'RQ2', phase: 'Phases B, C and D', l: ['Cost of DP and secure aggregation against', 'measured heterogeneity; the protected', 'unit; the time-adaptive schedule'] },
  { t: 'RQ3', phase: 'Phase E', l: ['Gradient inversion on unprotected', 'updates, and whether the integrated', 'mechanisms prevent it'] }
]

type Focus = { kind: 'theory' | 'rq'; i: number } | null

const ConceptualFramework = () => {
  const id = useSvgId()
  const [focus, setFocus] = useState<Focus>(null)

  const tx = (i: number) => 8 + i * 198
  const rx = (i: number) => 40 + i * 320

  const theoryMuted = (i: number) => focus !== null && !(focus.kind === 'theory' && focus.i === i)
  const rqMuted = (i: number) => focus !== null && !(focus.kind === 'rq' && focus.i === i)

  return (
    <Figure
      title='How the study is framed'
      source='Redrawn from Figure 2.4 (conceptual framework), as revised to three research questions.'
      caption='Five bodies of theory inform one framework; the framework is exercised by five phases that answer three research questions. Hover any box to trace it.'
      minWidth={760}
    >
      <svg viewBox='0 0 1000 500' role='img' aria-label='Conceptual framework: five theories, one framework, three research questions'>
        <ArrowDefs id={id} />

        {THEORIES.map((t, i) => (
          <g key={t.t}>
            <Edge id={id} d={`M ${tx(i) + 92} 118 L ${tx(i) + 92} 166`} active={focus?.kind === 'theory' && focus.i === i} muted={theoryMuted(i) && focus?.kind === 'theory'} i={i} />
            <Box
              x={tx(i)}
              y={8}
              w={184}
              h={108}
              title={t.t}
              lines={t.l}
              titleSize={13.5}
              lineSize={11.5}
              i={i}
              active={focus?.kind === 'theory' && focus.i === i}
              muted={theoryMuted(i)}
              onEnter={() => setFocus({ kind: 'theory', i })}
              onLeave={() => setFocus(null)}
            />
          </g>
        ))}

        <Box x={8} y={168} w={984} h={170} tone='zone' i={5} active={focus !== null} />
        <text x={28} y={194} className='dg-node__title dg-enter' style={{ fontSize: 14 }}>
          Framework of the study
        </text>
        <text x={196} y={194} className='dg-node__line dg-enter' style={{ fontSize: 12.5 }}>
          secure, decentralized model training under non-IID data
        </text>
        {PARTS.map((p, i) => (
          <Box key={p.t} x={28 + i * 241} y={210} w={225} h={110} title={p.t} lines={p.l} titleSize={13.5} lineSize={11.5} i={6 + i} />
        ))}

        {RQS.map((r, i) => (
          <g key={r.t}>
            <Edge id={id} d={`M ${rx(i) + 140} 340 L ${rx(i) + 140} 384`} active={focus?.kind === 'rq' && focus.i === i} muted={rqMuted(i) && focus?.kind === 'rq'} i={5 + i} />
            <Box
              x={rx(i)}
              y={386}
              w={280}
              h={106}
              tone='strong'
              title={`${r.t}  ·  ${r.phase}`}
              lines={r.l}
              titleSize={13.5}
              lineSize={11.5}
              i={10 + i}
              active={focus?.kind === 'rq' && focus.i === i}
              muted={rqMuted(i)}
              onEnter={() => setFocus({ kind: 'rq', i })}
              onLeave={() => setFocus(null)}
            />
          </g>
        ))}
      </svg>
    </Figure>
  )
}

export default ConceptualFramework
