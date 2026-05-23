/**
 * Temporary landing page for each module before it is built out.
 * Lists the planned capabilities (from the proposal) so the structure is clear.
 */
export default function ModulePlaceholder({ title, moduleNo, features = [] }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-brand">โมดูลที่ {moduleNo}</div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      </div>

      <div className="card">
        <div className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          อยู่ระหว่างพัฒนา
        </div>
        <p className="mb-4 text-sm text-slate-600">ความสามารถที่วางแผนไว้:</p>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 text-brand">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
