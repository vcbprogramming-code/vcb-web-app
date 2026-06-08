import Icon from '../Icon.jsx';

/**
 * Dashboard stat card with a soft pastel icon tile on the left (BTS style).
 * iconColor is a Tailwind bg+text pair, e.g. "bg-brand/10 text-brand".
 */
export default function StatCard({ label, value, icon, iconColor = 'bg-brand/10 text-brand', accent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      {icon && (
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
          <Icon name={icon} className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0">
        <div className={`text-2xl font-bold ${accent || 'text-slate-900'}`}>{value}</div>
        <div className="truncate text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
