'use client'

// React Imports
import { useMemo, useState } from 'react'

// Component Imports
import RunLink from '@/components/site/RunLink'

// Type Imports
import type { Partition } from '@/types/results'

// Lib Imports
import { PARTITION_ORDER, num, runByName } from '@/lib/results'

/*
 * The opening figure: the study's actual federation.
 *
 * Fifteen clients around one server, drawn from the partition report of a real
 * Phase A run (CIFAR-10, FedAvg, seed 0). Circle area is the number of samples
 * a client holds; the shade is its Hellinger distance from the pooled label
 * distribution. Switching partition redraws the same fifteen silos under each
 * protocol, which is the whole of RQ1's independent variable in one picture.
 */

const SHORT: Record<Partition, string> = {
  dir100: 'α = 100',
  'dir1.0': 'α = 1.0',
  'dir0.1': 'α = 0.1',
  quantity: 'Quantity skew',
  path1: 'Pathological'
}

const CX = 260
const CY = 260
const R = 186

const FederationHero = () => {
  const [partition, setPartition] = useState<Partition>('dir0.1')
  const [hover, setHover] = useState<number | null>(null)

  const run = useMemo(() => runByName(`A_cifar10_fedavg_${partition}_s0`), [partition])
  const sizes = run?.clientSizes ?? []
  const hel = run?.hellingerPerClient ?? []
  const classes = run?.classesPerClient ?? []

  // Area-true radii against a fixed reference, so switching partition shows
  // real changes in silo size rather than re-normalising each view.
  const REF = 10140
  const radius = (n: number) => Math.round((4 + 30 * Math.sqrt(n / REF)) * 100) / 100

  const options = PARTITION_ORDER.filter(p => runByName(`A_cifar10_fedavg_${p}_s0`))
  const h = hover !== null ? hover : null

  return (
    <div className='hero-fed'>
      <div className='hero-fed__controls'>
        <div className='seg' role='group' aria-label='Partition protocol'>
          {options.map(p => (
            <button key={p} type='button' aria-pressed={partition === p} onClick={() => setPartition(p)}>
              {SHORT[p]}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox='0 0 520 520' className='hero-fed__svg' role='img' aria-label={`Fifteen clients under ${run?.partitionLabel ?? partition}`}>
        <circle cx={CX} cy={CY} r={R} className='hero-fed__orbit' />
        {sizes.map((n, i) => {
          const a = (i / sizes.length) * Math.PI * 2 - Math.PI / 2
          // Rounded so server and browser trig agree exactly (hydration).
          const r2 = (v: number) => Math.round(v * 100) / 100
          const x = r2(CX + R * Math.cos(a))
          const y = r2(CY + R * Math.sin(a))
          const r = radius(n)
          const shade = Math.min(1, Math.max(0.12, (hel[i] ?? 0) / 0.9))

          return (
            <g
              key={i}
              className={`hero-fed__client${h === i ? ' is-hover' : ''}${h !== null && h !== i ? ' is-dim' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role='img'
              aria-label={`Client ${i + 1}: ${n.toLocaleString('en-US')} samples, Hellinger ${num(hel[i] ?? null)}, ${classes[i] ?? '—'} classes`}
            >
              <line
                x1={r2(CX + 30 * Math.cos(a))}
                y1={r2(CY + 30 * Math.sin(a))}
                x2={r2(x - (r + 4) * Math.cos(a))}
                y2={r2(y - (r + 4) * Math.sin(a))}
                className='hero-fed__spoke'
              />
              <circle cx={x} cy={y} r={r + 10} className='hero-fed__hit' />
              <circle cx={x} cy={y} r={r} className='hero-fed__dot' style={{ fillOpacity: shade }} />
            </g>
          )
        })}
        <circle cx={CX} cy={CY} r={26} className='hero-fed__server' />
        <circle cx={CX} cy={CY} r={10} className='hero-fed__core' />
      </svg>

      <div className='hero-fed__readout' aria-live='polite'>
        {h !== null ? (
          <>
            <p className='hero-fed__big'>Client {h + 1}</p>
            <dl>
              <div>
                <dt>Samples</dt>
                <dd>{sizes[h]?.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt>Hellinger distance</dt>
                <dd>{num(hel[h] ?? null)}</dd>
              </div>
              <div>
                <dt>Classes present</dt>
                <dd>{classes[h] ?? '—'}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <p className='hero-fed__big'>{run?.partitionLabel}</p>
            <dl>
              <div>
                <dt>Mean Hellinger distance</dt>
                <dd>{num(run?.hellingerMean ?? null)}</dd>
              </div>
              <div>
                <dt>Client sizes</dt>
                <dd>
                  {Math.min(...sizes).toLocaleString('en-US')} to {Math.max(...sizes).toLocaleString('en-US')}
                </dd>
              </div>
            </dl>
          </>
        )}
        <p className='hero-fed__note'>
          Area is samples held; shade is distance from the pooled label mix. From the partition report of{' '}
          {run && <RunLink name={run.name} />}.
        </p>
      </div>
    </div>
  )
}

export default FederationHero
