// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

const horizontalMenuData = (): HorizontalMenuDataType[] => [
  { label: 'Overview', href: '/', icon: 'tabler-smart-home' },
  { label: 'Heterogeneity', href: '/rq1', icon: 'tabler-chart-dots' },
  { label: 'Cost of privacy', href: '/privacy', icon: 'tabler-lock' },
  { label: 'Secure aggregation', href: '/secagg', icon: 'tabler-shield-check' },
  { label: 'What privacy protects', href: '/granularity', icon: 'tabler-building-bank' },
  { label: 'Run explorer', href: '/runs', icon: 'tabler-table' },
  { label: 'Phases', href: '/phases', icon: 'tabler-list-check' },
  { label: 'Data', href: '/downloads', icon: 'tabler-download' },
  { label: 'Concepts', href: '/concepts', icon: 'tabler-bulb' },
  { label: 'Methodology', href: '/methodology', icon: 'tabler-flask' },
  { label: 'Limitations', href: '/limitations', icon: 'tabler-alert-triangle' }
]

export default horizontalMenuData
