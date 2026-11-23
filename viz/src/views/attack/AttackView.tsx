'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

// Component Imports
import Caveat from '@/components/site/Caveat'
import FigureData from '@/components/site/FigureData'
import SectionCard from '@/components/site/SectionCard'
import StatCard from '@/components/site/StatCard'

// Type Imports
import type { AttackCondition } from '@/types/results'

// Lib Imports
import {
  attack,
  attackConditions,
  attackFileUrl,
  attackFilesFor,
  bestDefended,
  conditionOf,
  db,
  lenetMatrix,
  smallcnnRow
} from '@/lib/attack'

type ObjectFilter = 'both' | 'grad' | 'delta'

/*
 * One 32 x 32 image, scaled up with nearest-neighbour sampling so the pixels the
 * attack produced are the pixels the reader sees. Smoothing would flatter a
 * reconstruction by blurring it toward the original.
 */
const Pixel = ({ src, alt, size = 72 }: { src: string; alt: string; size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={attackFileUrl(src)}
    alt={alt}
    width={size}
    height={size}
    loading='lazy'
    style={{ imageRendering: 'pixelated', inlineSize: size, blockSize: size }}
    className='rounded border border-solid border-divider'
  />
)

const GalleryRow = ({ c }: { c: AttackCondition }) => {
  const gt = attack?.groundTruth ?? []

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2 flex-wrap'>
        <Typography variant='subtitle2'>
          {c.archLabel} · {c.defenceLabel} · {c.objectLabel}
        </Typography>
        <Chip
          size='small'
          variant='tonal'
          color={c.aboveFloor > 0 ? 'error' : 'success'}
          label={`mean ${db(c.psnrMean)} · ${c.aboveFloor} of ${c.images.length} above floor`}
        />
      </div>
      <div className='flex gap-2 flex-wrap'>
        {c.images.map((img, k) => {
          const above = c.psnrPerImage[k] > c.greyPerImage[k]

          return (
            <figure key={img} className='flex flex-col items-center gap-1 m-0'>
              <Pixel src={img} alt={`${c.id} reconstruction of image ${k} (${gt[k]?.labelName ?? ''})`} />
              <Typography
                variant='caption'
                color={above ? 'error.main' : 'text.secondary'}
                title={`floor for this image: ${c.greyPerImage[k].toFixed(2)} dB`}
              >
                {c.psnrPerImage[k].toFixed(1)} dB
              </Typography>
            </figure>
          )
        })}
      </div>
    </div>
  )
}

/*
 * Mean PSNR per condition on one axis, with Section 3.9's three reference
 * points drawn as vertical rules. Hand-rolled SVG like the site's other charts.
 */
const PsnrStrip = ({ rows }: { rows: AttackCondition[] }) => {
  const refs = attack!.references
  const W = 760
  const left = 250
  const right = 20
  const rowH = 26
  const top = 28
  const H = top + rows.length * rowH + 30
  const max = 30
  const x = (v: number) => left + (Math.max(0, Math.min(max, v)) / max) * (W - left - right)

  const refLines = [
    { v: refs.randomImage, label: `random ${refs.randomImage}`, colour: 'var(--mui-palette-text-secondary)' },
    { v: refs.flatGrey, label: `flat grey ${refs.flatGrey}`, colour: 'var(--mui-palette-warning-main)' },
    { v: refs.noisedCopy, label: `noised copy ${refs.noisedCopy}`, colour: 'var(--mui-palette-error-main)' }
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className='is-full' role='img' aria-label='Mean PSNR per attack condition'>
      {refLines.map(r => (
        <g key={r.label}>
          <line x1={x(r.v)} x2={x(r.v)} y1={top - 8} y2={H - 26} stroke={r.colour} strokeDasharray='4 3' />
          <text x={x(r.v)} y={top - 12} textAnchor='middle' fontSize='10' fill={r.colour}>
            {r.label}
          </text>
        </g>
      ))}
      {rows.map((c, i) => {
        const y = top + i * rowH + rowH / 2
        const colour = c.aboveFloor > 0 ? 'var(--mui-palette-error-main)' : 'var(--mui-palette-primary-main)'

        return (
          <g key={c.id}>
            <text x={left - 10} y={y + 4} textAnchor='end' fontSize='11' fill='var(--mui-palette-text-primary)'>
              {c.arch === 'smallcnn' ? 'SmallCNN · ' : ''}
              {c.defenceLabel} · {c.object === 'grad' ? 'gradient' : 'delta'}
            </text>
            <line
              x1={x(Math.min(...c.psnrPerImage))}
              x2={x(Math.max(...c.psnrPerImage))}
              y1={y}
              y2={y}
              stroke={colour}
              strokeOpacity={0.35}
              strokeWidth={6}
              strokeLinecap='round'
            />
            <circle cx={x(c.psnrMean)} cy={y} r={5} fill={colour} />
          </g>
        )
      })}
      {[0, 5, 10, 15, 20, 25, 30].map(t => (
        <text key={t} x={x(t)} y={H - 10} textAnchor='middle' fontSize='10' fill='var(--mui-palette-text-secondary)'>
          {t} dB
        </text>
      ))}
    </svg>
  )
}

const AttackView = () => {
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>('both')

  if (!attack || attackConditions.length === 0) {
    return (
      <Caveat severity='info' title='Phase E has not been recorded'>
        No attack condition has a result.json yet, so nothing is shown. Nothing here is estimated in the meantime.
      </Caveat>
    )
  }

  const refs = attack.references
  const d = attack.design
  const lenetGrad = conditionOf('lenet', 'none', 'grad')
  const lenetDelta = conditionOf('lenet', 'none', 'delta')
  const small = smallcnnRow()
  const best = bestDefended()
  const matrix = lenetMatrix()

  const ordered = [
    ...matrix.flatMap(m => [m.grad, m.delta]),
    small.grad,
    small.delta
  ].filter((c): c is AttackCondition => c !== null)

  const shown = ordered.filter(c => objectFilter === 'both' || c.object === objectFilter)
  const undefended = shown.filter(c => c.defence === 'none')
  const defended = shown.filter(c => c.defence !== 'none')

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <StatCard
          label='Undefended, single gradient'
          value={db(lenetGrad?.psnrMean ?? null)}
          hint={`LeNet · ${lenetGrad?.aboveFloor ?? 0} of 8 images above their floor`}
          icon='tabler-lock-open'
          color='error'
        />
        <StatCard
          label='Undefended, multi-epoch delta'
          value={db(lenetDelta?.psnrMean ?? null)}
          hint='the object this pipeline actually sends'
          icon='tabler-stack-2'
          color='warning'
        />
        <StatCard
          label='SmallCNN, undefended'
          value={`${db(small.grad?.psnrMean ?? null, 1)} / ${db(small.delta?.psnrMean ?? null, 1)}`}
          hint='gradient / delta · the architecture of Phases A–D'
          icon='tabler-cpu'
          color='info'
        />
        <StatCard
          label='Best defended condition'
          value={db(best?.psnrMean ?? null)}
          hint={best ? `${best.defenceLabel} · ${best.aboveFloor} of 8 above floor` : ''}
          icon='tabler-shield-check'
          color='success'
        />
      </div>

      <Caveat severity='info' title='Higher PSNR means worse privacy'>
        A reconstruction is scored against the image it tried to recover. Three reference points, fixed in Section 3.9
        before any run, make the figure readable: a random image scores about {refs.randomImage} dB, a flat grey image{' '}
        {refs.flatGrey} dB, and a lightly noised copy {refs.noisedCopy} dB. At or below the grey floor, the attack has
        recovered nothing a blank image would not. Each image also carries its own grey floor, and the per-image counts
        on this page compare each reconstruction with its own.
      </Caveat>

      <SectionCard
        icon='tabler-photo'
        color='error'
        title='What the attacker recovered'
        subtitle={`${attack.recorded} of ${attack.planned} attack conditions · the victim's ${d.imagesPerClient} images, one per class`}
        action={
          <ToggleButtonGroup
            size='small'
            exclusive
            value={objectFilter}
            onChange={(_, v) => v && setObjectFilter(v)}
            aria-label='Attack object'
          >
            <ToggleButton value='both'>Both objects</ToggleButton>
            <ToggleButton value='grad'>Gradient</ToggleButton>
            <ToggleButton value='delta'>Delta</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <div className='flex flex-col gap-2'>
          <Typography variant='subtitle2'>Ground truth — the victim client&apos;s data</Typography>
          <div className='flex gap-2 flex-wrap'>
            {attack.groundTruth.map(g => (
              <figure key={g.k} className='flex flex-col items-center gap-1 m-0'>
                <Pixel src={g.image} alt={`ground truth ${g.k}: ${g.labelName}`} />
                <Typography variant='caption' color='text.secondary'>
                  {g.labelName}
                </Typography>
              </figure>
            ))}
          </div>
        </div>

        <Typography variant='overline' color='text.secondary'>
          No defence
        </Typography>
        {undefended.map(c => (
          <GalleryRow key={c.id} c={c} />
        ))}

        <Typography variant='overline' color='text.secondary'>
          With a defence in place (LeNet)
        </Typography>
        {defended.map(c => (
          <GalleryRow key={c.id} c={c} />
        ))}

        <Typography variant='body2' color='text.secondary' className='max-is-[85ch]'>
          Each reconstruction is min-max normalised per image before display, the same convention the PSNR is computed
          under, so the picture shown is exactly the one that was scored. A figure in red beats that image&apos;s own
          grey floor. Images are shown at their native 32 × 32 resolution, enlarged without smoothing.
        </Typography>
      </SectionCard>

      <SectionCard
        icon='tabler-chart-dots-3'
        color='primary'
        title='Every condition on one scale'
        subtitle='Dot: mean over the eight images · bar: lowest to highest image'
        action={
          <FigureData
            filename='phase_e_psnr'
            columns={[
              'condition',
              'architecture',
              'defence',
              'epsilon',
              'secure_aggregation',
              'attack_object',
              'psnr_mean_db',
              'psnr_max_db',
              'grey_floor_mean_db',
              'images_above_floor'
            ]}
            rows={ordered.map(c => [
              c.id,
              c.arch,
              c.defence,
              c.epsilon,
              c.secagg,
              c.object,
              c.psnrMean,
              c.psnrMax,
              c.greyMean,
              c.aboveFloor
            ])}
            sources={ordered.map(c => `E_attack/${c.id}`)}
          />
        }
      >
        <PsnrStrip rows={ordered} />
      </SectionCard>

      <SectionCard
        icon='tabler-table'
        color='secondary'
        title='The phase as a table'
        subtitle='Mean PSNR, with images above their own floor in brackets'
      >
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Defence</TableCell>
                <TableCell align='right'>Single gradient</TableCell>
                <TableCell align='right'>Multi-epoch delta</TableCell>
                <TableCell align='right'>Noise / signal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matrix.map(m => (
                <TableRow key={m.defence}>
                  <TableCell>LeNet · {m.label}</TableCell>
                  <TableCell align='right'>
                    <strong>{db(m.grad?.psnrMean)}</strong> ({m.grad?.aboveFloor ?? '—'}/8)
                  </TableCell>
                  <TableCell align='right'>
                    <strong>{db(m.delta?.psnrMean)}</strong> ({m.delta?.aboveFloor ?? '—'}/8)
                  </TableCell>
                  <TableCell align='right'>
                    {m.grad?.noiseToSignal ? `${m.grad.noiseToSignal.toFixed(0)}×` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>SmallCNN · No defence</TableCell>
                <TableCell align='right'>
                  <strong>{db(small.grad?.psnrMean)}</strong> ({small.grad?.aboveFloor ?? '—'}/8)
                </TableCell>
                <TableCell align='right'>
                  <strong>{db(small.delta?.psnrMean)}</strong> ({small.delta?.aboveFloor ?? '—'}/8)
                </TableCell>
                <TableCell align='right'>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard icon='tabler-microscope' color='warning' title='How to read these numbers' prose>
        <Typography>
          <strong>The undefended attack only partly succeeds.</strong> Against one batch gradient over eight images,
          LeNet gives up coarse colour and layout — the sea and sky behind the boat, the tone of each scene — but no
          recognisable object, and its mean of {db(lenetGrad?.psnrMean ?? null)} sits just below the mean grey floor of{' '}
          {db(lenetGrad?.greyMean ?? null)}. The exploratory probe that fixed the attack&apos;s configuration recovered a
          single image; eight is harder, as Guo et al. (2025) report for batch size.
        </Typography>
        <Typography>
          <strong>The object matters more than any defence.</strong> The same attack against the multi-epoch delta —{' '}
          {lenetDelta?.objectLocalSteps ?? 8} local SGD steps folded into one update — falls to{' '}
          {db(lenetDelta?.psnrMean ?? null)} with no defence at all. That is the update Phases A to D transmit, and it is
          the result Section 3.10.5 sets the two objects side by side to test.
        </Typography>
        <Typography>
          <strong>Every defended condition fails outright</strong>, between{' '}
          {db(Math.min(...attackConditions.filter(c => c.defence !== 'none').map(c => c.psnrMean)))} and{' '}
          {db(best?.psnrMean ?? null)}. That is below even the {refs.randomImage} dB of a random image: the optimiser
          drives pixels to saturated extremes, so these are failures, not degrees of success, and differences among them
          carry no meaning.
        </Typography>
        <Caveat severity='warning' title='The DP conditions simulate the mechanism; they do not reproduce it'>
          Noise is calibrated by the same accountant as Phase B (q = {d.sampleRate.toFixed(4)}, {d.steps.toLocaleString('en-US')}{' '}
          steps, δ = {d.delta}), giving σ ={' '}
          {Object.entries(d.sigma)
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([e, s]) => `${s.toFixed(4)} at ε = ${e}`)
            .join(', ')}
          . It is applied to the whole transmitted object after clipping it to unit norm, where DP-SGD clips each example
          — so these conditions carry no ε guarantee of their own, and a conclusion from them is about how much noise
          defeats inversion, not about what a given ε promises (Sections 3.10.5 and 3.11.3).
        </Caveat>
        <Caveat severity='info' title='Secure aggregation leaves the attacker the sum of fifteen updates'>
          Each of the {d.numClients} clients forms the same kind of object from its own eight images, and the server sees
          only the masked total. The masks cancel to{' '}
          {conditionOf('lenet', 'sa', 'grad')?.maskCancellationError?.toExponential(1) ?? '—'}, so the attacker inverts
          the true aggregate — and there is no single client&apos;s update left in it to recover.
        </Caveat>
        <Typography variant='body2' color='text.secondary'>
          Fixed for every condition: layer-wise cosine matching, {d.iterations.toLocaleString('en-US')} iterations,{' '}
          {d.restarts} restarts, labels known to the attacker; the model pre-trained {d.pretrainEpochs} epochs on{' '}
          {d.pretrainImages} images disjoint from every client&apos;s data; local training at batch {d.localBatch},
          learning rate {d.localLr}, {d.localEpochs} epochs. One seed, as Table 3.6 sets out.
        </Typography>
      </SectionCard>

      <SectionCard icon='tabler-files' color='secondary' title='The records behind this page'>
        <TableContainer>
          <Table size='small'>
            <TableBody>
              {attackFilesFor('_phase')
                .filter(f => !f.file.startsWith('ground_truth_'))
                .map(f => (
                  <TableRow key={f.file} hover>
                    <TableCell>
                      <a
                        href={attackFileUrl(`E_attack/${f.file}`)}
                        download={f.file}
                        className='flex items-center gap-2 text-primary no-underline'
                      >
                        <i className='tabler-download text-[16px]' />
                        <code className='text-xs'>{f.file}</code>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption' color='text.secondary'>
                        {f.description}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Typography variant='caption' color='text.secondary'>
                        {f.sizeLabel}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              {ordered.map(c => {
                const rec = attackFilesFor(c.id).find(f => f.file.endsWith('result.json'))

                return rec ? (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <a
                        href={attackFileUrl(`E_attack/${rec.file}`)}
                        download={`${c.id}.json`}
                        className='flex items-center gap-2 text-primary no-underline'
                      >
                        <i className='tabler-download text-[16px]' />
                        <code className='text-xs'>{rec.file}</code>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption' color='text.secondary'>
                        {c.archLabel} · {c.defenceLabel} · {c.objectLabel}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Typography variant='caption' color='text.secondary'>
                        {rec.sizeLabel}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant='body2' color='text.secondary'>
          Every reconstruction image on this page is also published beside its result.json, and the whole phase is in the
          study archive on the Data page.
        </Typography>
      </SectionCard>
    </div>
  )
}

export default AttackView
