// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

const horizontalMenuData = (): HorizontalMenuDataType[] => [
  { label: 'Overview', href: '/', icon: 'tabler-smart-home' },
  { label: 'Headline result', href: '/rq1', icon: 'tabler-chart-dots' },
  { label: 'Run explorer', href: '/runs', icon: 'tabler-table' },
  { label: 'Phases', href: '/phases', icon: 'tabler-list-check' },
  { label: 'Concepts', href: '/concepts', icon: 'tabler-bulb' },
  { label: 'Methodology', href: '/methodology', icon: 'tabler-flask' },
  { label: 'Limitations', href: '/limitations', icon: 'tabler-alert-triangle' }
]

export default horizontalMenuData
