import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { meetingsApi, thaiDate } from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { PageHeader } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import MeetingDetail from './MeetingDetail.jsx';
import MeetingForm from './MeetingForm.jsx';
import { useT } from '../../lib/i18n.jsx';

/**
 * รายงานการประชุม — the list, and one meeting open beside it.
 *
 * Search covers the whole body on purpose: people come here looking for a
 * decision or a name, not a title they already remember.
 */
export default function Meetings() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState(sp.get('group') || '');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(sp.get('id') || null);
  const [editing, setEditing] = useState(null); // null | 'new' | row

  const load = useCallback(() => meetingsApi.list({ groupId: group, q })
    .then((r) => setRows(r.data))
    .catch((e) => setError(e.message)), [group, q]);

  useEffect(() => { meetingsApi.bootstrap().then((r) => setBoot(r.data)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);
  useEffect(() => {
    const next = {};
    if (group) next.group = group;
    if (openId) next.id = openId;
    setSp(next, { replace: true });
  }, [group, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupsById = useMemo(
    () => new Map((boot?.groups || []).map((g) => [g.id, g])), [boot]);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}<button onClick={() => window.location.reload()} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!boot || !rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดรายงานการประชุม…')} /></div>;

  const { groups, canEdit } = boot;
  const chip = (on) => `rounded-full border px-3 py-1.5 text-sm font-medium transition ${
    on ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`;

  const removeRow = async (r) => {
    const ok = await confirm({
      title: t('ลบรายงานการประชุม'),
      message: `ลบ "${r.title}"?\nไฟล์แนบ ความเห็น และประวัติทุกเวอร์ชันของรายงานฉบับนี้จะถูกลบไปด้วย`,
      confirmLabel: t('ลบ'), danger: true,
    });
    if (!ok) return;
    try {
      const res = await meetingsApi.remove(r.id);
      toast.success(res?.data?.removedFiles ? `ลบแล้ว · ไฟล์ที่ถูกลบด้วย ${res.data.removedFiles} ไฟล์` : 'ลบแล้ว');
      if (openId === r.id) setOpenId(null);
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('รายงานการประชุม')}
        subtitle={`บันทึกการประชุมแยกตามโครงการและฝ่าย · ${boot.total} ฉบับ`}
        right={canEdit ? (
          <button onClick={() => setEditing('new')} className="btn-primary !py-2 !text-sm">
            <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มรายงาน')}
          </button>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setGroup('')} className={chip(group === '')}>
          {t('ทุกกลุ่ม')} <span className="ml-1 text-xs opacity-70">{boot.total}</span>
        </button>
        {groups.filter((g) => !g.is_inbox).map((g) => (
          <button key={g.id} onClick={() => setGroup(group === g.id ? '' : g.id)} className={chip(group === g.id)}>
            {g.name} <span className="ml-1 text-xs opacity-70">{g.count + (g.tagged_count || 0)}</span>
          </button>
        ))}
        {/* the inboxes sit apart: they are a queue to work through, not a place
            minutes belong */}
        {groups.some((g) => g.is_inbox) && <span className="mx-1 h-5 w-px bg-slate-200" />}
        {groups.filter((g) => g.is_inbox).map((g) => (
          <button key={g.id} onClick={() => setGroup(group === g.id ? '' : g.id)}
            title={t('บันทึกเสียงที่ยังไม่ได้จัดเก็บเข้ากลุ่ม')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              group === g.id ? 'border-slate-600 bg-slate-600 text-white'
                : 'border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-500'}`}>
            <Icon name="inbox" className="h-3.5 w-3.5" />
            {g.name.replace('กล่องรอจัดเก็บ · ', '')}
            <span className="text-xs opacity-70">{g.count}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหารายงานการประชุม')}
          placeholder={t('ค้นหาชื่อเรื่อง มติ ผู้เข้าประชุม หรือข้อความในรายงาน…')} className="field !pl-9" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,340px)_1fr] xl:items-start">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t('พบ')} {rows.length} {t('ฉบับ')}</p>
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              {q ? 'ไม่พบรายงานที่ตรงกับคำค้น' : 'ยังไม่มีรายงานในกลุ่มนี้'}
            </p>
          )}
          {rows.map((r) => {
            const g = groupsById.get(r.group_id);
            return (
              <button key={r.id} onClick={() => setOpenId(r.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  openId === r.id ? 'border-brand bg-brand-tint' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {g && <span className="chip" style={{ backgroundColor: `${g.color}1a`, color: g.color }}>{g.name}</span>}
                  {r.pinned && <Icon name="pin" className="h-3.5 w-3.5 text-amber-500" title={t('ปักหมุด')} />}
                  {!r.visible && <span className="chip bg-slate-100 text-slate-500">{t('ยังไม่เผยแพร่')}</span>}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{r.title}</div>
                <div className="text-xs text-slate-500">
                  {thaiDate(r.meeting_date)}{r.time_label ? ` · ${r.time_label}` : ''}
                  {r.attachment_count > 0 && ` · ไฟล์แนบ ${r.attachment_count}`}
                  {r.comment_count > 0 && ` · ความเห็น ${r.comment_count}`}
                </div>
                {r.excerpt && <div className="mt-1 line-clamp-2 text-xs text-slate-500">{r.excerpt}</div>}
              </button>
            );
          })}
        </div>

        <div className="min-w-0">
          {openId ? (
            <MeetingDetail
              id={openId} canEdit={canEdit} groups={groups}
              onClose={() => setOpenId(null)}
              onEdit={(row) => setEditing(row)}
              onDelete={removeRow}
              onChanged={load}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 py-20 text-center text-sm text-slate-500">
              {t('เลือกรายงานทางซ้ายเพื่ออ่าน')}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <MeetingForm
          row={editing === 'new' ? null : editing}
          groups={groups}
          defaultGroupId={group || groups[0]?.id}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setOpenId(id); load(); }}
        />
      )}
    </div>
  );
}
