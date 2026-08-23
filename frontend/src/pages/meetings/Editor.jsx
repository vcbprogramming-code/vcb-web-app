import { useEffect, useRef, useState } from 'react';
import { meetingsApi } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
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
  const [busy, setBusy] = useState(false);

  // Load the body once. Writing `value` back into the DOM on every keystroke
  // would move the caret to the start of the document as you type.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const emit = () => onChange(ref.current?.innerHTML || '');
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

  const link = () => {
    const url = window.prompt('ใส่ลิงก์ (ขึ้นต้นด้วย https://)');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast.error(t('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://')); return; }
    run('createLink', url);
  };

  /** A checklist line — the reference app's green tick, kept because action
   *  items are what people come back to minutes for. */
  const checklist = () => insert('<ul><li data-checked="false">☐ &nbsp;</li></ul>');

  const table = () => {
    const cols = Math.min(8, Math.max(1, Number(window.prompt('จำนวนคอลัมน์', '3')) || 0));
    const rows = Math.min(30, Math.max(1, Number(window.prompt('จำนวนแถว (รวมหัวตาราง)', '3')) || 0));
    if (!cols || !rows) return;
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
      const url = await meetingsApi.fileUrl(meetingId, r.data.id);
      insert(`<img src="${url}" alt="${file.name.replace(/"/g, '')}" />`);
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
        <Btn on={() => run('bold')} title={t('ตัวหนา')}><b>B</b></Btn>
        <Btn on={() => run('italic')} title={t('ตัวเอียง')}><i>I</i></Btn>
        <Btn on={() => run('underline')} title={t('ขีดเส้นใต้')}><u>U</u></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={() => run('insertUnorderedList')} title={t('หัวข้อย่อย')}>{t('• รายการ')}</Btn>
        <Btn on={() => run('insertOrderedList')} title={t('รายการมีเลข')}>{t('1. ลำดับ')}</Btn>
        <Btn on={checklist} title={t('รายการติ๊กถูก')}>{t('☐ ติ๊ก')}</Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={table} title={t('แทรกตาราง')}><Icon name="layers" className="inline h-4 w-4" /> {t('ตาราง')}</Btn>
        <label className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          title={meetingId ? 'แทรกรูป' : 'บันทึกรายงานก่อนจึงแทรกรูปได้'}>
          <Icon name="file" className="inline h-4 w-4" /> {busy ? 'กำลังอัปโหลด…' : 'รูป'}
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickImage(f); }} />
        </label>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn on={link} title={t('ใส่ลิงก์')}><Icon name="link" className="inline h-4 w-4" /> {t('ลิงก์')}</Btn>
        <Btn on={() => run('unlink')} title={t('ถอดลิงก์')}>{t('ถอดลิงก์')}</Btn>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        role="textbox"
        aria-multiline="true"
        aria-label={t('เนื้อหารายงานการประชุม')}
        className="mtg-body min-h-[340px] px-5 py-4 text-[15px] leading-relaxed text-slate-800 outline-none"
      />
    </div>
  );
}
