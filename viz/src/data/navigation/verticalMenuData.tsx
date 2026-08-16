// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => [
  {
    label: 'Overview',
    href: '/',
    icon: 'tabler-smart-home'
  },
  {
    label: 'Results',
    isSection: true,
    children: [
      { label: 'Heterogeneity (RQ1)', href: '/rq1', icon: 'tabler-chart-dots' },
      { label: 'Cost of privacy (RQ2)', href: '/privacy', icon: 'tabler-lock' },
      { label: 'Run explorer', href: '/runs', icon: 'tabler-table' },
      { label: 'Phases A–E', href: '/phases', icon: 'tabler-list-check' },
      { label: 'Data and records', href: '/downloads', icon: 'tabler-download' }
    ]
  },
  {
    label: 'Background',
    isSection: true,
    children: [
      { label: 'Concepts', href: '/concepts', icon: 'tabler-bulb' },
      { label: 'Methodology', href: '/methodology', icon: 'tabler-flask' },
      { label: 'Limitations', href: '/limitations', icon: 'tabler-alert-triangle' }
    ]
  }
]

export default verticalMenuData
