'use client'

// React Imports
import type { ReactNode } from 'react'

// Hook Imports
import { useInView } from './useInView'

/*
 * Small explanatory drawings for the Concepts page, one per concept. They are
 * schematic: shapes illustrate an idea and never stand in for a result. Where a
 * number appears it is one stated elsewhere on the site (the PSNR references).
 */

const Glyph = ({ caption, children, label }: { caption: ReactNode; children: ReactNode; label: string }) => {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <figure ref={ref} className={`glyph dg-figure${inView ? ' is-visible' : ''}`} style={{ border: '1px solid var(--line)' }}>
      <svg viewBox='0 0 280 170' role='img' aria-label={label}>
        {children}
      </svg>
      <figcaption className='glyph__caption'>{caption}</figcaption>
    </figure>
  )
}

const bars = (x: number, y: number, mix: number[], w = 150) => {
  let off = 0

  return mix.map((m, j) => {
    const el = (
      <rect
        key={j}
        x={x + off}
        y={y}
        width={Math.max(w * m - 2, 1.5)}
        height={12}
        rx={2}
        className={j % 3 === 0 ? 'dg-fill-ink' : j % 3 === 1 ? 'dg-fill-accent' : 'dg-fill-line'}
      />
    )

    off += w * m

    return el
  })
}

export const NonIidGlyph = () => (
  <Glyph label='Three partition protocols shown as per-client class mixes' caption='Each bar is one client’s class mix. Smaller α concentrates clients on fewer classes; pathological gives each client one.'>
    {[
      { l: 'α = 100', rows: [[0.34, 0.33, 0.33], [0.32, 0.35, 0.33], [0.33, 0.33, 0.34]] },
      { l: 'α = 0.1', rows: [[0.82, 0.12, 0.06], [0.05, 0.15, 0.8], [0.1, 0.85, 0.05]] },
      { l: 'one class', rows: [[1, 0, 0], [0, 0, 1], [0, 1, 0]] }
    ].map((g, i) => (
      <g key={g.l} className='dg-enter' style={{ ['--i' as string]: i }}>
        <text x={8} y={28 + i * 54} className='dg-label' style={{ fontSize: 11.5 }}>
          {g.l}
        </text>
        {g.rows.map((r, k) => (
          <g key={k}>{bars(90 + k * 0, 10 + i * 54 + k * 15, r, 180)}</g>
        ))}
      </g>
    ))}
  </Glyph>
)

export const HellingerGlyph = () => (
  <Glyph label='Hellinger distance compares a client label distribution with the pooled one' caption='One client’s label distribution (solid) against the pooled one (outline). Hellinger distance is 0 when they match and 1 when they share no classes.'>
    {[0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1].map((g, i) => {
      const c = [0.02, 0.05, 0.35, 0.03, 0.25, 0.02, 0.18, 0.04, 0.04, 0.02][i]
      const x = 16 + i * 25

      return (
        <g key={i} className='dg-enter' style={{ ['--i' as string]: i }}>
          <rect x={x} y={110 - c * 260} width={16} height={c * 260} rx={2} className='dg-fill-accent' />
          <rect x={x - 2} y={110 - g * 260} width={20} height={g * 260} rx={2} fill='none' className='dg-stroke-line' strokeWidth={1.5} />
        </g>
      )
    })}
    <line x1={10} x2={270} y1={110} y2={110} className='dg-stroke-line' />
    <line x1={16} x2={264} y1={146} y2={146} className='dg-stroke-line' strokeWidth={1.5} />
    <circle cx={16} cy={146} r={4} className='dg-fill-ink2' />
    <circle cx={264} cy={146} r={4} className='dg-fill-ink2' />
    <circle cx={16 + 248 * 0.63} cy={146} r={6} className='dg-fill-accent' />
    <text x={16} y={164} className='dg-label' style={{ fontSize: 11 }}>
      0 identical
    </text>
    <text x={264} y={164} textAnchor='end' className='dg-label' style={{ fontSize: 11 }}>
      1 disjoint
    </text>
  </Glyph>
)

export const StrategyGlyph = () => (
  <Glyph label='Client drift: local updates pull towards different local optima' caption='Under skew, each client’s local steps drift towards its own optimum (dots), away from the global one (ring). The strategies differ in how they correct that drift.'>
    <circle cx={140} cy={92} r={9} fill='none' className='dg-stroke-accent' strokeWidth={2} />
    {[
      [48, 40],
      [236, 52],
      [120, 156],
      [222, 140]
    ].map(([x, y], i) => (
      <g key={i} className='dg-enter' style={{ ['--i' as string]: i }}>
        <path d={`M 140 92 Q ${(140 + x) / 2 + (i % 2 ? 18 : -18)} ${(92 + y) / 2 - 10} ${x} ${y}`} className='dg-edge' style={{ strokeDasharray: 'none', strokeDashoffset: 0, animation: 'none' }} />
        <circle cx={x} cy={y} r={5} className='dg-fill-ink' />
      </g>
    ))}
    <text x={152} y={88} className='dg-label dg-label--accent' style={{ fontSize: 11.5, fontWeight: 600 }}>
      global
    </text>
    <text x={8} y={20} className='dg-label' style={{ fontSize: 11 }}>
      local optima pull the update apart
    </text>
  </Glyph>
)

export const PrivacyGlyph = () => {
  const curve = (shift: number) => {
    const pts: string[] = []

    for (let i = 0; i <= 60; i++) {
      const x = i / 60
      const y = Math.exp(-((x - 0.45 - shift) ** 2) / 0.02)

      // Rounded: Math.exp can differ in the last digit between Node and the
      // browser, which would make the server and client paths disagree.
      pts.push(`${(16 + x * 248).toFixed(2)},${(130 - y * 96).toFixed(2)}`)
    }

    return `M ${pts.join(' L ')}`
  }

  return (
    <Glyph label='Output distributions with and without one record overlap closely' caption='What the model releases with your record (solid) and without it (dashed). ε bounds how far apart the two can be: smaller ε, more overlap, more noise.'>
      <path d={curve(0)} className='dg-stroke-accent dg-enter' strokeWidth={2} />
      <path d={curve(0.08)} className='dg-stroke-line dg-enter' strokeWidth={2} strokeDasharray='5 4' style={{ ['--i' as string]: 1 }} />
      <line x1={10} x2={270} y1={130} y2={130} className='dg-stroke-line' />
      <text x={16} y={152} className='dg-label' style={{ fontSize: 11 }}>
        with the record
      </text>
      <text x={264} y={152} textAnchor='end' className='dg-label' style={{ fontSize: 11 }}>
        without it
      </text>
    </Glyph>
  )
}

export const MaskGlyph = () => (
  <Glyph label='A mask added by one client and subtracted by another cancels in the sum' caption='Client 1 adds a random mask, client 2 subtracts the same mask. Each upload looks random; their sum is exact.'>
    {[
      { y: 30, t: 'x₁ + m', sign: '+' },
      { y: 74, t: 'x₂ − m', sign: '−' }
    ].map((r, i) => (
      <g key={i} className='dg-enter' style={{ ['--i' as string]: i }}>
        <rect x={16} y={r.y} width={110} height={30} rx={6} className='dg-fill-surface' stroke='var(--line-strong)' />
        <text x={71} y={r.y + 20} textAnchor='middle' className='dg-label dg-label--ink' style={{ fontSize: 13 }}>
          {r.t}
        </text>
      </g>
    ))}
    <path d='M 128 45 C 170 45, 170 100, 196 100' className='dg-edge' style={{ strokeDasharray: 'none', strokeDashoffset: 0, animation: 'none' }} />
    <path d='M 128 89 C 160 89, 170 100, 196 100' className='dg-edge' style={{ strokeDasharray: 'none', strokeDashoffset: 0, animation: 'none' }} />
    <rect x={198} y={84} width={70} height={32} rx={6} className='dg-fill-ink' />
    <text x={233} y={105} textAnchor='middle' className='dg-fill-surface' style={{ fontSize: 13 }}>
      x₁ + x₂
    </text>
    <text x={16} y={150} className='dg-label' style={{ fontSize: 11 }}>
      m − m = 0: the server learns only the sum
    </text>
  </Glyph>
)

export const PsnrGlyph = () => {
  const x = (db: number) => 16 + ((db - 5) / (30 - 5)) * 248

  return (
    <Glyph label='PSNR reference points: random image 8.7 dB, flat grey 13.8 dB, lightly noised copy 26.1 dB' caption='Reading PSNR. Higher means a better reconstruction and so worse privacy. At or below the flat-grey floor, the attack has failed.'>
      <rect x={16} y={70} width={248} height={10} rx={5} className='dg-fill-line' opacity={0.6} />
      <rect x={x(13.8)} y={70} width={x(30) - x(13.8)} height={10} rx={5} className='dg-fill-danger' opacity={0.85} />
      {[
        { v: 8.7, l: 'random', l2: '8.7 dB', up: true },
        { v: 13.8, l: 'flat grey', l2: '13.8 dB', up: false },
        { v: 26.1, l: 'noised copy', l2: '26.1 dB', up: true }
      ].map((r, i) => (
        <g key={r.v} className='dg-enter' style={{ ['--i' as string]: i }}>
          <line x1={x(r.v)} x2={x(r.v)} y1={62} y2={88} stroke='var(--ink)' strokeWidth={2} />
          <text x={x(r.v)} y={r.up ? 38 : 108} textAnchor='middle' className='dg-label dg-label--ink' style={{ fontSize: 11.5, fontWeight: 600 }}>
            {r.l2}
          </text>
          <text x={x(r.v)} y={r.up ? 52 : 122} textAnchor='middle' className='dg-label' style={{ fontSize: 11 }}>
            {r.l}
          </text>
        </g>
      ))}
      <text x={264} y={150} textAnchor='end' className='dg-label' style={{ fontSize: 11 }}>
        higher PSNR, worse privacy →
      </text>
    </Glyph>
  )
}
