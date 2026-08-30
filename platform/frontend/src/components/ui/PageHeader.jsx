/**
 * Page title block (BTS style): bold title, gray subtitle, optional right slot
 * for actions / date chips.
 */
export default function PageHeader({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}
