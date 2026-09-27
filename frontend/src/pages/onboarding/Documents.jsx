import { useRef, useState } from 'react';
import { programApi, pick } from '../../lib/onboardingProgram.js';
import { useToast } from '../../components/Toast.jsx';
import Icon from '../../components/Icon.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * เอกสารที่จำเป็น — ประตูบานแรกของทั้งโปรแกรม
 *
 * ทำสี่อย่างได้บนการ์ดเดียวตามพอร์ทัลของเขา: **ดู** เอกสารต้นแบบในเบราว์เซอร์
 * **ดาวน์โหลด** ไปกรอก **อัปโหลด** กลับ และติ๊ก **เสร็จสมบูรณ์** ด้วยมือได้ถ้า
 * ส่งทางอื่นไปแล้ว — การอัปโหลดถือว่าข้อนั้นเสร็จเองโดยไม่ต้องติ๊กซ้ำ
 *
 * ยังส่งไม่ครบ = เลือกแผนกไม่ได้ (ประตูกั้นของเขา) จึงต้องบอกให้ชัดว่าเหลืออีก
 * กี่รายการ ไม่ใช่ปล่อยให้ไปงงที่หน้าเลือกแผนกว่าทำไมกดไม่ได้
 */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

export default function Documents({ documents, status, onChanged, onDone }) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const pending = useRef(null);            // เอกสารที่กด "อัปโหลด" ไว้
  const fileInput = useRef(null);
  const submitted = new Set(status.submittedDocuments);
  const uploads = status.uploads || {};
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

  const chooseFile = (doc) => { pending.current = doc.id; fileInput.current?.click(); };

  /**
   * ตรวจขนาดก่อน "อ่านไฟล์" ไม่ใช่หลัง — ของเขาเคยไม่ตรวจเลย ไฟล์สแกนใหญ่เกิน
   * ก็ล้มที่เซิร์ฟเวอร์แล้วขึ้นว่า "ลองใหม่อีกครั้ง" ซึ่งเป็นคำแนะนำที่ทำตาม
   * แล้วล้มเหมือนเดิมทุกครั้ง เพราะไฟล์เดิมใหญ่เกินอยู่แล้ว
   */
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    const docId = pending.current;
    e.target.value = '';
    if (!file || !docId) return;
    if (file.size > MAX_BYTES) {
      toast.error(t('ไฟล์นี้ใหญ่เกินไป (จำกัด 10MB) กรุณาอัปโหลดไฟล์สแกนหรือรูปถ่ายที่เล็กกว่านี้'));
      return;
    }
    if (file.size === 0) { toast.error(t('ไฟล์นี้ว่างเปล่า กรุณาเลือกไฟล์อื่น')); return; }
    setBusy(docId);
    try {
      await programApi.uploadDoc(docId, file);
      await onChanged();
      toast.success(t('อัปโหลดแล้ว: {name}', { name: file.name }));
    } catch (err) { toast.error(err.message); }
    finally { setBusy(null); }
  };

  /** เปิดไฟล์ที่อัปโหลดไว้ — ต้องดึงเป็น blob ก่อน เพราะ API ต้องมี Bearer */
  const openMine = async (docId) => {
    try {
      const url = await programApi.docFileUrl(docId);
      window.open(url, '_blank', 'noopener');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      <input ref={fileInput} type="file" accept={ACCEPT} onChange={onFile} className="hidden" />

      <div className="card space-y-1">
        <h2 className="text-xl font-bold text-slate-800">{t('เอกสารที่จำเป็น')}</h2>
        <p className="text-sm text-slate-600">
          {t('ดู ดาวน์โหลด กรอกข้อมูล และอัปโหลดเอกสารทั้ง 8 ฉบับนี้ก่อนวันเริ่มงานวันแรก:')}
        </p>
      </div>

      <div className={`card-sm flex flex-wrap items-center gap-3 border-l-4 ${left === 0 ? 'border-emerald-400' : 'border-amber-400'}`}>
        <div className="flex-1 text-sm text-slate-700">
          {left === 0
            ? t('ส่งเอกสารครบแล้ว — เลือกแผนกได้เลย')
            : t('ยังเหลืออีก {n} รายการ จึงจะเลือกแผนกได้', { n: left })}
        </div>
        {left === 0 && onDone && (
          <button onClick={onDone} className="btn-primary">
            {t('ไปที่เลือกแผนก')} <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {documents.map((d) => {
          const on = submitted.has(d.id);
          const mine = uploads[d.id];
          const title = pick(lang, d.title, d.title_th);
          const descr = pick(lang, d.descr, d.descr_th);
          return (
            <div key={d.id} className={`card space-y-3 ${on ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              <div className="flex items-start gap-3">
                <Icon name="document" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800">{title}</div>
                  {descr && <div className="mt-0.5 text-sm text-slate-500">{descr}</div>}
                </div>
                {on && (
                  <span className="chip shrink-0 bg-emerald-100 text-emerald-700">
                    <Icon name="check" className="h-3 w-3" /> {t('เสร็จสมบูรณ์')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {d.view_url && (
                  <a href={d.view_url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    <Icon name="eye" className="h-4 w-4" /> {t('ดูเอกสาร')}
                  </a>
                )}
                {d.download_url && (
                  <a href={d.download_url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    <Icon name="download" className="h-4 w-4" /> {t('ดาวน์โหลด')}
                  </a>
                )}
                <button onClick={() => chooseFile(d)} disabled={busy === d.id} className="btn-outline disabled:opacity-50">
                  <Icon name="paperclip" className="h-4 w-4" /> {t('อัปโหลด')}
                </button>
                <button onClick={() => toggle(d)} disabled={busy === d.id}
                  aria-label={on ? t('ยกเลิกการส่ง') : t('ทำเครื่องหมายว่าเสร็จสมบูรณ์')}
                  className={`ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                    on ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                    on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                    {on && <Icon name="check" className="h-3 w-3" />}
                  </span>
                  {t('เสร็จสมบูรณ์')}
                </button>
              </div>

              {/* ใบเสร็จ — ของเขาเก็บใน localStorage ซึ่งหายไปพร้อมเบราว์เซอร์
                  ของเราอ่านจากฐานข้อมูล ย้ายเครื่องแล้วยังเห็นว่าส่งไฟล์ใดไป */}
              {mine && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t('อัปโหลดแล้ว')}:{' '}
                  <button onClick={() => openMine(d.id)} className="font-medium text-brand underline hover:no-underline">
                    {mine.fileName}
                  </button>{' '}
                  <span className="text-slate-400">({t('อัปโหลดใหม่จะแทนไฟล์เดิม')})</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
