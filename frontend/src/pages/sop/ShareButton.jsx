import { useState } from 'react';
import { copyText, shareUrl } from '../../lib/copyText.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * Copies a direct link to one case study or process flow.
 *
 * The manual is something people quote at each other — "ดูเคส AP-3" — and until
 * now the only way to point at one was to describe where to click. The link
 * opens the app straight on that item.
 *
 * `param` is 'case' or 'flow'; `value` the number or id.
 */
export default function ShareButton({ param, value, className = '' }) {
  const t = useT();
  // 'busy' matters: when the browser's clipboard call stalls instead of
  // answering, the button would otherwise sit unchanged for seconds and the
  // reader would press it again.
  const [state, setState] = useState('idle'); // idle | busy | ok | fail

  const copy = async () => {
    if (state === 'busy') return;
    setState('busy');
    const ok = await copyText(shareUrl(param, value));
    setState(ok ? 'ok' : 'fail');
    setTimeout(() => setState('idle'), 2200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={t('คัดลอกลิงก์มาที่รายการนี้')}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
        state === 'busy'
          ? 'border-slate-200 text-slate-400'
          : state === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : state === 'fail'
            ? 'border-rose-200 bg-rose-50 text-rose-600'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      } ${className}`}
    >
      <Icon name={state === 'ok' ? 'check' : 'link'} className={`h-4 w-4 ${state === 'busy' ? 'animate-pulse' : ''}`} />
      {state === 'busy' ? 'กำลังคัดลอก…' : state === 'ok' ? 'คัดลอกแล้ว' : state === 'fail' ? 'คัดลอกไม่สำเร็จ' : 'แชร์'}
    </button>
  );
}
