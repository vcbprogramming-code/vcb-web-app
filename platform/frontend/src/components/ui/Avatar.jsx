import Icon from '../Icon.jsx';

/**
 * Small rounded icon tile shown at the start of a table row (BTS style).
 * `color` is a Tailwind bg+text pair, e.g. "bg-brand/10 text-brand".
 */
export default function Avatar({ icon = 'user', color = 'bg-slate-100 text-slate-500', className = '' }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} ${className}`}
    >
      <Icon name={icon} className="h-5 w-5" />
    </span>
  );
}
