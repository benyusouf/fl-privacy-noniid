// React Imports
import type { SVGAttributes } from 'react'

/*
 * The mark.
 *
 * Three things about the study, in one glyph:
 *
 *   Five clients around a centre        — cross-silo federated learning.
 *   Their circles are different sizes   — non-IID. The silos do not hold
 *                                         comparable data, which is the whole
 *                                         problem the study is about.
 *   The spokes stop short of the ring   — updates travel inward, raw data does
 *                                         not. The gap is the privacy claim.
 *
 * The centre is an open ring rather than a filled dot: what the server holds is
 * an aggregate, not a copy of anything.
 *
 * Sized in em and drawn in currentColor so it inherits font-size and palette
 * from wherever it sits, exactly as the template's own logo did. Geometry is
 * laid out on a 24-unit grid with a 1-unit margin; a dashed-spoke variant was
 * tried and rejected because the dashes fill in at sidebar sizes.
 */
const LogoMark = (props: SVGAttributes<SVGElement>) => (
  <svg width='1em' height='1em' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
    <g stroke='currentColor' strokeWidth='1.5' strokeLinecap='round'>
      <line x1='12' y1='8.5' x2='12' y2='6.2' />
      <line x1='15.33' y1='10.92' x2='18.18' y2='9.99' />
      <line x1='14.06' y1='14.83' x2='15.23' y2='16.45' />
      <line x1='9.94' y1='14.83' x2='8.3' y2='17.1' />
      <line x1='8.67' y1='10.92' x2='6.58' y2='10.24' />
    </g>
    <circle cx='12' cy='12' r='2.3' fill='none' stroke='currentColor' strokeWidth='1.9' />
    <circle cx='12' cy='3.4' r='2.1' fill='currentColor' />
    <circle cx='20.18' cy='9.34' r='1.4' fill='currentColor' />
    <circle cx='17.05' cy='18.96' r='2.4' fill='currentColor' />
    <circle cx='6.95' cy='18.96' r='1.6' fill='currentColor' />
    <circle cx='3.82' cy='9.34' r='2.2' fill='currentColor' />
  </svg>
)

export default LogoMark
