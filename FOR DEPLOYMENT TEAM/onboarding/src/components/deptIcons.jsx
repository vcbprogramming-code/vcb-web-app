// One icon per department card in the deptgrid section (content.html's
// icon('ledger')/icon('coin')/icon('package')/icon('building')/icon('wrench')
// calls) — simple line icons matching the original's icon set closely enough
// to read the same at a glance; the original's icon sprite itself isn't
// portable, so these are redrawn, not traced.

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function LedgerIcon(props) {
  return (
    <svg {...common} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </svg>
  );
}

export function CoinIcon(props) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.5 9.75c0-1.24-1.12-2.25-2.5-2.25s-2.5.9-2.5 2c0 3 5 1.5 5 4.5 0 1.1-1.12 2-2.5 2s-2.5-1.01-2.5-2.25" />
    </svg>
  );
}

export function PackageIcon(props) {
  return (
    <svg {...common} {...props}>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...common} {...props}>
      <rect x="5" y="3" width="10" height="18" />
      <rect x="15" y="9" width="4" height="12" />
      <path d="M8 7h1M11 7h1M8 11h1M11 11h1M8 15h1M11 15h1" />
    </svg>
  );
}

export function WrenchIcon(props) {
  return (
    <svg {...common} {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L4 16.5V20h3.5l5.3-5.3a4 4 0 0 0 4.9-5.4l-2.55 2.55a1.8 1.8 0 0 1-2.55-2.55L14.7 6.3Z" />
    </svg>
  );
}

const DEPT_ICONS = {
  ledger: LedgerIcon,
  coin: CoinIcon,
  package: PackageIcon,
  building: BuildingIcon,
  wrench: WrenchIcon,
};

export function DeptIcon({ icon, ...rest }) {
  const Cmp = DEPT_ICONS[icon] || PackageIcon;
  return <Cmp {...rest} />;
}
