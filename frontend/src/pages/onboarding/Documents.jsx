import { useState } from 'react';
import { programApi } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * เอกสารที่ต้องส่งก่อนวันแรกทำงาน — ประตูบานแรกของทั้งโปรแกรม
 *
 * ยังส่งไม่ครบ เฟสแรกก็ยังไม่ปลดล็อก จึงต้องบอกให้ชัดว่าเหลืออีกกี่รายการ
 * ไม่ใช่ปล่อยให้ไปงงที่หน้าเฟสว่าทำไมติ๊กไม่ได้
 */
export default function Documents({ documents, status, onChanged }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const submitted = new Set(status.submittedDocuments);
  const left = documents.length - submitted.size;

  const toggle = async (doc) => {
    setBusy(doc.id);
    try {
      if (submitted.has(doc.id)) await programApi.unsubmitDoc(doc.id);
      else await programApi.submitDoc(doc.id, '');
      await onChanged();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div className={`card-sm border-l-4 ${left === 0 ? 'border-emerald-400' : 'border-amber-400'}`}>
        <div className="text-sm text-slate-700">
          {left === 0
            ? t('ส่งเอกสารครบแล้ว — เริ่มเฟสแรกได้เลย')
            : t('ยังเหลืออีก {n} รายการ จึงจะเริ่มเฟสแรกได้', { n: left })}
        </div>
      </div>

      <div className="card overflow-hidden !p-0">
        {documents.map((d) => {
          const on = submitted.has(d.id);
          return (
            <div key={d.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
              <button onClick={() => toggle(d)} disabled={busy === d.id}
                aria-label={on ? t('ยกเลิกการส่ง') : t('ทำเครื่องหมายว่าส่งแล้ว')}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                  on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-brand'
                } disabled:opacity-50`}>
                {on && <Icon name="check" className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${on ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{d.title}</div>
                {d.descr && <div className="mt-0.5 text-sm text-slate-500">{d.descr}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
