import { useLang } from '../lib/i18n.jsx';

/** ไทย / EN. Small, and in the same place on every screen so it can be found
 *  without hunting — a language switch people cannot find is not a language
 *  switch. */
export default function LangToggle({ dark = false }) {
  const { lang, setLang } = useLang();
  const base = 'rounded-md px-2 py-0.5 text-xs font-semibold transition';
  const on = dark ? 'bg-white/20 text-white' : 'bg-brand text-white';
  const off = dark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800';
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'border border-slate-200'}`}>
      {[['th', 'ไทย'], ['en', 'EN']].map(([k, label]) => (
        <button key={k} type="button" onClick={() => setLang(k)}
          aria-pressed={lang === k}
          title={k === 'th' ? 'ภาษาไทย' : 'English'}
          className={`${base} ${lang === k ? on : off}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
