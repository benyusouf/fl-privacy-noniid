'use client'

// React Imports
import { useMemo, useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'

// Component Imports
import ChartFrame from './ChartFrame'
import ChartLegend from './ChartLegend'
import SvgTooltip from './SvgTooltip'

// Type Imports
import type { Run } from '@/types/results'

// Lib Imports
import { clientNoise } from '@/lib/results'
import { bandScale, extent, subBands } from '@/lib/chart-geometry.mjs'

type Props = {
  run: Run
}

const SIGMA_COLOUR = '#8264F0'
const SIZE_COLOUR = '#666CFF'

/*
 * Who pays for the privacy guarantee.
 *
 * Noise is calibrated per client, so the burden is not shared evenly. Clients
 * are ordered smallest to largest, which makes the relationship read left to
 * right: the least data attracts the most noise.
 *
 * The mechanism is subsampling amplification. A client's privacy accounting
 * benefits from each sample being unlikely to appear in a given batch — but that
 * benefit depends on the sampling ratio q = batch / n being small. A silo holding
 * 88 samples with a batch of 64 has q ≈ 0.73, so almost every sample appears in
 * almost every batch, amplification buys nothing, and sigma has to rise steeply
 * to hit the same epsilon.
 */
const ClientNoiseChart = ({ run }: Props) => {
  const [hover, setHover] = useState<number | null>(null)

  const noise = useMemo(() => clientNoise(run), [run])

  if (!noise) {
    return <Typography color='text.secondary'>This run has no privacy mechanism, so there is no noise to show.</Typography>
  }

  const { clients } = noise

  /*
   * A time-adaptive run has no scalar sigma per client — noise moves every
   * round — so `sigma` is null there by design. Fall back to the client's own
   * sigmaMin/sigmaMax range, and draw the bar as that span rather than as a
   * single height. Reading `sigma` unguarded would render null into the DOM.
   */
  const scheduled = clients.some(c => c.schedule)
  const lo = (c: (typeof clients)[number]) => c.sigma ?? c.sigmaMin ?? 0
  const hi = (c: (typeof clients)[number]) => c.sigma ?? c.sigmaMax ?? 0
  const sigmaMax = (extent(clients.map(hi)) ?? [0, 1])[1]
  const sizeMax = (extent(clients.map(c => c.n)) ?? [0, 1])[1]

  return (
    <div>
      <ChartFrame
        vbHeight={340}
        margin={{ top: 16, right: 64, bottom: 48, left: 64 }}
        xDomain={[0, clients.length]}
        yDomain={[0, sigmaMax * 1.12]}
        xLabel='clients, ordered from fewest samples to most'
        yLabel='noise multiplier σ'
        xTickCount={Math.min(clients.length, 8)}
        formatX={v => String(Math.round(v))}
        formatY={v => v.toFixed(0)}
      >
        {({ y, area }) => {
          const band = bandScale(clients.length, area.x0, area.x1, 0.25)
          const sub = subBands(band.barWidth, 2)
          const sy = (n: number) => area.y1 - (n / (sizeMax * 1.12)) * area.height

          return (
            <>
              {/* right-hand axis: samples held */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <text
                  key={`s${t}`}
                  x={area.x1 + 8}
                  y={sy(sizeMax * 1.12 * t)}
                  dominantBaseline='middle'
                  fontSize={11}
                  fill={SIZE_COLOUR}
                >
                  {Math.round((sizeMax * 1.12 * t) / 100) / 10}k
                </text>
              ))}
              <text
                transform={`translate(${area.x1 + 52} ${(area.y0 + area.y1) / 2}) rotate(90)`}
                textAnchor='middle'
                fontSize={12}
                fill={SIZE_COLOUR}
              >
                samples held
              </text>

              {clients.map((c, i) => (
                <g key={c.client}>
                  <rect
                    x={band.start(i) + sub.offset(0)}
                    y={y(hi(c))}
                    width={sub.width}
                    height={Math.max(area.y1 - y(hi(c)), 0)}
                    fill={SIGMA_COLOUR}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                  {c.schedule && (
                    // the floor of the schedule, so the bar reads as a range
                    <rect
                      x={band.start(i) + sub.offset(0)}
                      y={y(lo(c))}
                      width={sub.width}
                      height={Math.max(area.y1 - y(lo(c)), 0)}
                      fill={SIGMA_COLOUR}
                      opacity={0.4}
                    />
                  )}
                  <rect
                    x={band.start(i) + sub.offset(1)}
                    y={sy(c.n)}
                    width={sub.width}
                    height={Math.max(area.y1 - sy(c.n), 0)}
                    fill={SIZE_COLOUR}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                  <rect
                    x={band.center(i) - band.band / 2}
                    y={area.y0}
                    width={band.band}
                    height={area.height}
                    fill='transparent'
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              ))}

              {hover !== null && clients[hover] && (
                <SvgTooltip
                  x={band.center(hover)}
                  y={y(hi(clients[hover]))}
                  bounds={area}
                  lines={[
                    { text: `client ${clients[hover].client}`, bold: true },
                    { text: `${clients[hover].n.toLocaleString()} samples`, colour: SIZE_COLOUR },
                    {
                      text: clients[hover].schedule
                        ? `σ = ${lo(clients[hover]).toFixed(2)}–${hi(clients[hover]).toFixed(2)} over the run`
                        : `σ = ${(clients[hover].sigma ?? 0).toFixed(2)}`,
                      colour: SIGMA_COLOUR
                    },
                    { text: `q = ${clients[hover].q.toFixed(3)}` },
                    {
                      text: `realised ε = ${(
                        clients[hover].realisedEpsilon ??
                        clients[hover].realised_epsilon ??
                        0
                      ).toFixed(4)}`
                    }
                  ]}
                />
              )}
            </>
          )
        }}
      </ChartFrame>

      <ChartLegend
        items={[
          {
            label: scheduled ? 'noise multiplier σ, range over the run' : 'noise multiplier σ',
            colour: SIGMA_COLOUR,
            note: '(left axis)'
          },
          { label: 'samples held', colour: SIZE_COLOUR, note: '(right axis)' }
        ]}
      />
    </div>
  )
}

export default ClientNoiseChart
