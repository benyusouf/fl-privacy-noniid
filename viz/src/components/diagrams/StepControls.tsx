'use client'

// React Imports
import { useCallback, useEffect, useState } from 'react'

export type Step = { title: string; body: string }

/*
 * Step-through state for a diagram. `step` is -1 for "show everything" (the
 * resting state, so the diagram is complete before anyone touches it) or the
 * index of the highlighted step.
 */
export const useSteps = (count: number) => {
  const [step, setStep] = useState(-1)
  const [playing, setPlaying] = useState(false)

  const next = useCallback(() => setStep(s => (s + 1 >= count ? 0 : s + 1)), [count])
  const prev = useCallback(() => setStep(s => (s <= 0 ? count - 1 : s - 1)), [count])

  useEffect(() => {
    if (!playing) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const t = window.setInterval(next, reduce ? 4200 : 2600)

    return () => window.clearInterval(t)
  }, [playing, next])

  return { step, setStep, next, prev, playing, setPlaying }
}

type Props = {
  steps: Step[]
  state: ReturnType<typeof useSteps>
  label?: string
}

/*
 * Numbered step buttons, previous/next, play/pause, and the active step's text
 * announced politely to screen readers. Arrow keys move between steps when the
 * control has focus.
 */
const StepControls = ({ steps, state, label = 'Diagram steps' }: Props) => {
  const { step, setStep, next, prev, playing, setPlaying } = state
  const active = step >= 0 ? steps[step] : null

  return (
    <div
      className='dg-steps'
      onKeyDown={e => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setPlaying(false)
          next()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setPlaying(false)
          prev()
        }
      }}
    >
      <div className='dg-steps__bar' role='group' aria-label={label}>
        <button
          type='button'
          className='dg-steps__icon'
          onClick={() => {
            if (step < 0) setStep(0)
            setPlaying(p => !p)
          }}
          aria-label={playing ? 'Pause' : 'Play the steps'}
        >
          <i className={playing ? 'tabler-player-pause' : 'tabler-player-play'} aria-hidden />
        </button>
        <ol className='dg-steps__list'>
          {steps.map((s, i) => (
            <li key={s.title}>
              <button
                type='button'
                className={`dg-steps__step${step === i ? ' is-active' : ''}${step > i ? ' is-past' : ''}`}
                aria-pressed={step === i}
                onClick={() => {
                  setPlaying(false)
                  setStep(i)
                }}
              >
                <span className='dg-steps__num'>{i + 1}</span>
                <span className='dg-steps__label'>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className='dg-steps__nav'>
          <button
            type='button'
            className='dg-steps__icon'
            aria-label='Previous step'
            onClick={() => {
              setPlaying(false)
              prev()
            }}
          >
            <i className='tabler-chevron-left' aria-hidden />
          </button>
          <button
            type='button'
            className='dg-steps__icon'
            aria-label='Next step'
            onClick={() => {
              setPlaying(false)
              next()
            }}
          >
            <i className='tabler-chevron-right' aria-hidden />
          </button>
          {step >= 0 && (
            <button
              type='button'
              className='dg-steps__reset'
              onClick={() => {
                setPlaying(false)
                setStep(-1)
              }}
            >
              Show all
            </button>
          )}
        </div>
      </div>
      <p className='dg-steps__text' aria-live='polite'>
        {active ? (
          <>
            <strong>{active.title}.</strong> {active.body}
          </>
        ) : (
          <span>Step through the diagram, or press play.</span>
        )}
      </p>
    </div>
  )
}

export default StepControls
