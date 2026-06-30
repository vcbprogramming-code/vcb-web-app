// Line-art SVG icons ported verbatim from index.html.
import type { SVGProps } from 'react'
import type { AppIconKey } from './types'

const svgProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function GlobeIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.86l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.86-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.86.34l-.06.06A2 2 0 1 1 4.2 16.93l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.86l-.06-.06A2 2 0 1 1 7.03 4.2l.06.06a1.7 1.7 0 0 0 1.86.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.86-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.86V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  )
}

export function AnnouncementIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 11l18-7-4 16-5-5-5 2-4-6z" />
    </svg>
  )
}

export function AppIcon({ icon }: { icon: AppIconKey }) {
  switch (icon) {
    case 'memo':
      return (
        <svg {...svgProps}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h7" />
          <path d="M9 17h5" />
          <path d="M9 9h3" />
        </svg>
      )
    case 'minutes':
      return (
        <svg {...svgProps}>
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 4V5z" />
          <path d="M7 8h6" />
          <path d="M7 11h4" />
          <path d="M19 9a2 2 0 0 1 2 2v8l-3-3h-5a2 2 0 0 1-2-2" />
        </svg>
      )
    case 'sop':
      return (
        <svg {...svgProps}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M9 10l1.5 1.5L13 9" />
          <path d="M9 15l1.5 1.5L13 14" />
          <path d="M15 11h1" />
          <path d="M15 16h1" />
        </svg>
      )
    case 'hr':
      return (
        <svg {...svgProps}>
          <circle cx="10" cy="8" r="3.2" />
          <path d="M4 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" />
          <circle cx="17" cy="17" r="3.5" />
          <path d="M17 15v2l1.4 1" />
        </svg>
      )
    case 'credit':
      return (
        <svg {...svgProps}>
          <path d="M3 10l9-6 9 6" />
          <path d="M5 10v8" />
          <path d="M9 10v8" />
          <path d="M15 10v8" />
          <path d="M19 10v8" />
          <path d="M3 20h18" />
          <path d="M12 13v3" />
          <path d="M11 14h2" />
        </svg>
      )
    default:
      return (
        <svg {...svgProps}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </svg>
      )
  }
}
