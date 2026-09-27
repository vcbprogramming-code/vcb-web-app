import { useEffect, useRef, useState } from 'react';
import { meetingsApi } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/ui/index.js';
import Icon from '../../components/Icon.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * The minutes editor.
 *
 * A contentEditable surface with a small toolbar, the same shape the reference
 * implementation settled on — plus tables and pictures, which the client asked
 * for. Deliberately not a full word processor: minutes are decisions and action
 * items, and every extra control is one more thing to explain.
 *
 * What is typed here is stored as HTML and read by other people, so the server
 * sanitises it on save. Nothing in this file is a security boundary.
 */
export default function Editor({ meetingId, value, onChange }) {
  const t = useT();
  const toast = useToast();
  const ref = useRef(null);
  const saved = useRef(null);       // ช่วงที่เลือกไว้ก่อนกล่องโต้ตอบเปิด
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState('p');
  const [dialog, setDialog] = useState(null);   // null | 'link' | 'table'
  const [url, setUrl] = useState('');
  const [grid, setGrid] = useState({ cols: '3', rows: '3' });

  // Load the body once. Writing `value` back into the DOM on every keystroke
  // would move the caret to the start of the document as you type.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  /**
   * Escape ในกล่องโต้ตอบต้องปิดแค่กล่องนั้น
   *
   * ตัวแก้ไขนี้อยู่ในกล่อง "แก้ไขรายงาน" อีกชั้น และ Modal ทุกตัวฟัง keydown ที่
   * document ตัวนอกลงทะเบียนก่อนจึงทำงานก่อน — กด Escape ทีเดียวปิดทั้งสองชั้น
   * แล้วสิ่งที่พิมพ์ไว้ทั้งฉบับก็หายไป ดักในช่วง capture ซึ่งมาก่อน bubble ของ
   * document แล้วหยุดไว้ที่นี่
   */
  useEffect(() => {
    if (!dialog) return;
    const guard = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setDialog(null); } };
    document.addEventListener('keydown', guard, true);
    return () => document.removeEventListener('keydown', guard, true);
  }, [dialog]);

  const emit = () => onChange(ref.current?.innerHTML || '');

  /** เก็บช่วงที่เลือกไว้ กล่องโต้ตอบจะแย่งโฟกัสไป และคำสั่งอย่าง createLink
   *  ต้องมีช่วงที่เลือกอยู่จริงถึงจะทำอะไรได้ */
  const remember = () => {
    const sel = window.getSelection();
    saved.current = sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange() : null;
  };
  const restore = () => {
    ref.current?.focus();
    if (!saved.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.current);
  };

  const run = (cmd, arg) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const insert = (html) => {
    ref.current?.focus();
    document.execCommand('insertHTML', false, html);
    emit();
  };

  /** ระดับหัวข้อของบรรทัดที่เคอร์เซอร์อยู่ ให้ dropdown บอกความจริง ไม่ใช่ค้าง
   *  ที่ค่าที่เพิ่งเลือกไปเมื่อสองย่อหน้าก่อน */
  const syncBlock = () => {
    try {
      const v = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      setBlock(['h1', 'h2', 'h3'].includes(v) ? v : 'p');
    } catch { /* เบราว์เซอร์บางตัวไม่ตอบ ปล่อยค่าเดิมไว้ */ }
  };

  const openLink = () => { remember(); setUrl(''); setDialog('link'); };
  const addLink = () => {
    const v = url.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) { toast.error(t('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')); return; }
    setDialog(null);
    restore();
    // ไม่ได้ลากคลุมข้อความไว้ createLink จะไม่เกิดอะไรขึ้นเลย — แทรกลิงก์ที่มี
    // ตัวมันเองเป็นข้อความให้ ดีกว่ากดแล้วเงียบ
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) insert(`<a href="${v.replace(/"/g, '&quot;')}">${v.replace(/</g, '&lt;')}</a>&nbsp;`);
    else run('createLink', v);
  };

  /** A checklist line — the reference app's green tick, kept because action
   *  items are what people come back to minutes for. */
  const checklist = () => insert('<ul><li data-checked="false">☐ &nbsp;</li></ul>');

  const openTable = () => { remember(); setGrid({ cols: '3', rows: '3' }); setDialog('table'); };
  const addTable = () => {
    const cols = Math.min(8, Math.max(1, Number(grid.cols) || 0));
    const rows = Math.min(30, Math.max(1, Number(grid.rows) || 0));
    if (!cols || !rows) return;
    setDialog(null);
    restore();
    const head = `<tr>${'<th>หัวข้อ</th>'.repeat(cols)}</tr>`;
    const body = `<tr>${'<td>&nbsp;</td>'.repeat(cols)}</tr>`.repeat(Math.max(0, rows - 1));
    insert(`<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
  };

  const pickImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('ต้องเป็นไฟล์ภาพ')); return; }
    if (/svg/i.test(file.type)) { toast.error(t('ไม่รองรับไฟล์ SVG')); return; }
    if (!meetingId) { toast.error(t('บันทึกรายงานก่อน แล้วจึงแทรกรูปได้')); return; }
    setBusy(true);
    try {
      // Upload first, then reference it. Embedding the bytes in the body would
      // bloat every version snapshot with a copy of the same picture.
      const r = await meetingsApi.attach(meetingId, file, 'inline');
      const fileUrl = await meetingsApi.fileUrl(meetingId, r.data.id);
      insert(`<img src="${fileUrl}" alt="${file.name.replace(/"/g, '')}" />`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Btn = ({ on, title, children }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={on} title={title}
      className="rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100">
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
        {/* ย้อนกลับ / ทำซ้ำ มาก่อนทุกอย่างเหมือนของเขา — คนที่เพิ่งลบย่อหน้าผิด
            ต้องหาปุ่มนี้ได้ทันที ไม่ใช่ไล่หาในแถว */}
        <Btn on={() => run('undo')} title={t('ย้อนกลับ')}>
          <Icon name="undo" className="inline h-4 w-4" />
        </Btn>
        <Btn on={() => run('redo')} title={t('ทำซ้ำ')}>
          <Icon name="undo" className="inline h-4 w-4 -scale-x-100" />
        </Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <select value={block} title={t('ระดับหัวข้อ')} aria-label={t('ระดับหัวข้อ')}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { setBlock(e.target.value); run('formatBlock', `<${e.target.value}>`); }}
          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm text-slate-600">
          <option value="p">{t('ข้อความปกติ')}</option>
          <option value="h1">{t('หัวข้อ 1')}</option>
          <option value="h2">{t('หัวข้อ 2')}</option>
          <option value="h3">{t('หัวข้อ 3')}</option>
        </select>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={() => run('bold')} title={t('ตัวหนา')}><b>B</b></Btn>
        <Btn on={() => run('italic')} title={t('ตัวเอียง')}><i>I</i></Btn>
        <Btn on={() => run('underline')} title={t('ขีดเส้นใต้')}><u>U</u></Btn>
        <Btn on={() => run('strikeThrough')} title={t('ขีดฆ่า')}><s>S</s></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={() => run('insertUnorderedList')} title={t('หัวข้อย่อย')}>{t('• รายการ')}</Btn>
        <Btn on={() => run('insertOrderedList')} title={t('รายการมีเลข')}>{t('1. ลำดับ')}</Btn>
        {/* ป้ายปุ่มเป็นไอคอนเส้นสีเดียว ไม่ใช่สัญลักษณ์กล่อง — กล่อง ☐ ยังคงอยู่
            ใน "เนื้อหา" ที่แทรกลงเอกสาร เพราะมันคือช่องติ๊กที่คนอ่านต้องเห็น */}
        <Btn on={checklist} title={t('รายการติ๊กถูก')}>
          <Icon name="check" className="inline h-4 w-4" /> {t('ติ๊ก')}
        </Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={openTable} title={t('แทรกตาราง')}><Icon name="layers" className="inline h-4 w-4" /> {t('ตาราง')}</Btn>
        <label className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          title={meetingId ? t('แทรกรูป') : t('บันทึกรายงานก่อนจึงแทรกรูปได้')}>
          <Icon name="file" className="inline h-4 w-4" /> {busy ? t('กำลังอัปโหลด…') : t('รูป')}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickImage(f); }} />
        </label>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={openLink} title={t('เพิ่มลิงก์')}><Icon name="link" className="inline h-4 w-4" /> {t('ลิงก์')}</Btn>
        <Btn on={() => run('unlink')} title={t('ถอดลิงก์')}>{t('ถอดลิงก์')}</Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { emit(); syncBlock(); }}
        onBlur={emit}
        onKeyUp={syncBlock}
        onMouseUp={syncBlock}
        role="textbox"
        aria-multiline="true"
        aria-label={t('เนื้อหารายงานการประชุม')}
        className="mtg-body min-h-[340px] px-5 py-4 text-[15px] leading-relaxed text-slate-800 outline-none"
      />

      {dialog === 'link' && (
        <Modal title={t('เพิ่มลิงก์')} onClose={() => setDialog(null)} size="md"
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-outline">{t('ยกเลิก')}</button>
              <button type="button" onClick={addLink} disabled={!url.trim()} className="btn-primary disabled:opacity-50">
                {t('เพิ่ม')}
              </button>
            </>
          )}>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ลิงก์ URL')}</label>
          <input value={url} autoFocus onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
            placeholder="https://…" className="field" />
          <p className="mt-1 text-xs text-slate-400">{t('รับเฉพาะลิงก์ที่ขึ้นต้นด้วย http:// หรือ https://')}</p>
        </Modal>
      )}

      {dialog === 'table' && (
        <Modal title={t('แทรกตาราง')} onClose={() => setDialog(null)} size="md"
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-outline">{t('ยกเลิก')}</button>
              <button type="button" onClick={addTable} className="btn-primary">{t('แทรก')}</button>
            </>
          )}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนคอลัมน์')}</label>
              <input type="number" min="1" max="8" value={grid.cols} autoFocus
                onChange={(e) => setGrid((g) => ({ ...g, cols: e.target.value }))} className="field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">{t('จำนวนแถว (รวมหัวตาราง)')}</label>
              <input type="number" min="1" max="30" value={grid.rows}
                onChange={(e) => setGrid((g) => ({ ...g, rows: e.target.value }))} className="field" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
