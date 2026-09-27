import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  meetingsApi, meetingDateText, meetingTimeText, inRange, MTG_NAVY,
  summarySection, summaryBullets, sourceLabel,
  readReadingSize, writeReadingSize,
} from '../../lib/meetings.js';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import AccessPanel from './AccessPanel.jsx';
import MeetingDetail from './MeetingDetail.jsx';
import MeetingForm from './MeetingForm.jsx';
import Timeline from './Timeline.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * รายงานการประชุม — สามคอลัมน์แบบระบบจริงของลูกค้า
 *
 *   แถบข้าง (โครงการ) │ รายการการประชุม │ เอกสารที่เปิดอยู่
 *
 * โครงสร้างนี้ไม่ใช่เรื่องรูปลักษณ์: แถบข้างเป็นสารบัญที่คงอยู่ คนทำงานกระโดด
 * ข้ามโครงการไปมาตลอดวัน ถ้ารายการโครงการเป็นชิปแถวเดียวข้างบน พอโครงการเกิน
 * สิบชื่อมันก็ตัดบรรทัดกินพื้นที่จนอ่านเอกสารไม่ได้
 *
 * ค้นหาครอบทั้งเนื้อความโดยเจตนา คนเข้ามาที่นี่เพื่อหามติหรือชื่อคน ไม่ใช่
 * ชื่อเรื่องที่เขาจำได้อยู่แล้ว
 */
export default function Meetings() {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const confirm = useConfirm();
  const [sp, setSp] = useSearchParams();
  const [boot, setBoot] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  // ?project= / ?meeting= เป็นชื่อพารามิเตอร์ของลิงก์ที่แจกกัน (เหมือนของเขา)
  // แต่ยังรับ ?group= / ?id= ที่เคยแจกไปแล้วด้วย ลิงก์เก่าต้องไม่ตาย
  const [group, setGroup] = useState(sp.get('project') || sp.get('group') || '');
  const [q, setQ] = useState('');
  const [range, setRange] = useState('all');
  const [openId, setOpenId] = useState(sp.get('meeting') || sp.get('id') || null);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  // ต้องประกาศรวมกับ hook อื่นตรงนี้ ไม่ใช่ใต้ทางออกก่อนกำหนดด้านล่าง — พอ
  // ข้อมูลมาถึงแล้วเรนเดอร์รอบสองผ่านทางออกนั้นไป จำนวน hook จะเพิ่มขึ้นหนึ่ง
  // ตัว React จึงล้มทั้งหน้า ("Rendered more hooks than during the previous render")
  const [access, setAccess] = useState(false);
  const [settings, setSettings] = useState(false);    // แผงตั้งค่าของโมดูล
  // ขนาดตัวอักษรสำหรับอ่านบันทึก เก็บต่อเครื่องแบบของเขา อ่านค่าตอนติดตั้งครั้งเดียว
  const [size, setSize] = useState(() => readReadingSize());
  const [groupForm, setGroupForm] = useState(null);   // null | 'new' | กลุ่มที่จะเปลี่ยนชื่อ
  const [summary, setSummary] = useState(null);       // บทสรุปของฉบับล่าสุดในโครงการที่เลือก
  // มุมมองเส้นเวลา — แทนที่รายการกับเอกสาร ไม่ใช่แทนที่แถบข้าง (สารบัญยังต้องอยู่)
  const [timeline, setTimeline] = useState(false);
  /**
   * สัญญาณว่า "เอกสารที่เปิดอยู่เปลี่ยนไปแล้ว ไปอ่านใหม่"
   *
   * MeetingDetail อ่านเอกสารเมื่อ id เปลี่ยน แต่การกดบันทึกในกล่องแก้ไขไม่ได้
   * เปลี่ยน id — มันแก้ฉบับเดิม ผลคือหลังกดบันทึก รายการข้าง ๆ อัปเดตชื่อเรื่องใหม่
   * ให้เห็น แต่ตัวเอกสารยังแสดงข้อความเก่าอยู่ คนที่เพิ่งแก้เองจึงเห็นงานของตัวเอง
   * ไม่ขึ้น (เจอจาก meetings-flows.ui.mjs: ประวัติการทำงานไม่มีแถว "ย้ายโครงการ"
   * ที่เพิ่งเกิด เพราะข้อมูลในหน้ายังเป็นชุดก่อนบันทึก)
   */
  const [docVersion, setDocVersion] = useState(0);
  // ?project= อย่างเดียวหมายถึง "เปิดฉบับล่าสุดของโครงการนี้" ครั้งเดียวตอนเข้า
  // ไม่ใช่ดึงผู้อ่านกลับไปฉบับล่าสุดทุกครั้งที่เขากดปิด
  const wantLatest = useRef(Boolean(sp.get('project')) && !sp.get('meeting') && !sp.get('id'));

  const load = useCallback(() => meetingsApi.list({ groupId: group, q })
    .then((r) => setRows(r.data))
    .catch((e) => setError(e.message)), [group, q]);

  const reload = useCallback(() => {
    meetingsApi.bootstrap().then((r) => setBoot(r.data)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const timer = setTimeout(load, q ? 300 : 0); return () => clearTimeout(timer); }, [load, q]);
  useEffect(() => {
    const next = {};
    if (group) next.project = group;
    if (openId) next.meeting = openId;
    setSp(next, { replace: true });
  }, [group, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupsById = useMemo(
    () => new Map((boot?.groups || []).map((g) => [g.id, g])), [boot]);

  const shown = useMemo(() => (rows || []).filter((r) => inRange(r, range)), [rows, range]);

  /** ฉบับล่าสุดของแต่ละโครงการ — การ์ดหน้าแรก */
  // นับ "ฉบับล่าสุดของโครงการ" จากทุกที่ที่ฉบับนั้นปรากฏ ไม่ใช่แค่กลุ่มที่มันอยู่:
  // บันทึกส่วนใหญ่ของลูกค้าอยู่ในกล่องรอจัดเก็บแล้วถูกจัดเก็บเข้าโครงการด้วยป้าย
  // (59 จาก 82 ฉบับ) ถ้าดูแต่ group_id การ์ดหน้าแรกจะโชว์ฉบับเก่ากว่าที่รายการ
  // ของโครงการนั้นแสดงอยู่ และโครงการที่มีแต่ฉบับที่จัดเก็บเข้ามา (ERP, หลวงพระบาง,
  // ลาดหลุมแก้ว, ชวนา) จะไม่มีการ์ดเลยทั้งที่แถบข้างนับให้แล้ว
  const latestPerGroup = useMemo(() => {
    const by = new Map();
    const put = (gid, m) => {
      const cur = by.get(gid);
      if (!cur || String(m.meeting_date || '') > String(cur.meeting_date || '')) by.set(gid, m);
    };
    for (const m of rows || []) {
      if (m.kind === 'overview') continue;
      if (!m.is_inbox) put(m.group_id, m);
      for (const tag of m.tags || []) put(tag.id, m);
    }
    return by;
  }, [rows]);

  const latestOfGroup = group ? (latestPerGroup.get(group)
    || (rows || []).find((r) => r.kind !== 'overview')) : null;

  // ดึงเนื้อหาของฉบับล่าสุดมาสกัดบทสรุปผู้บริหาร เฉพาะตอนที่การ์ดนั้นอยู่บนจอ
  useEffect(() => {
    if (!latestOfGroup || openId) { setSummary(null); return; }
    let alive = true;
    setSummary({ id: latestOfGroup.id, loading: true });
    meetingsApi.get(latestOfGroup.id)
      .then((r) => { if (alive) setSummary({ id: latestOfGroup.id, html: r.data.content || '' }); })
      .catch(() => { if (alive) setSummary({ id: latestOfGroup.id, html: '' }); });
    return () => { alive = false; };
  }, [latestOfGroup?.id, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ลิงก์ ?project= พาไปฉบับล่าสุดของโครงการนั้น ทำครั้งเดียวเมื่อรายการมาถึง
  useEffect(() => {
    if (!wantLatest.current || !rows) return;
    wantLatest.current = false;
    const first = rows.find((r) => r.kind !== 'overview') || rows[0];
    if (first) setOpenId(first.id);
  }, [rows]);

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}<button onClick={() => window.location.reload()} className="ml-2 font-semibold underline">{t('ลองใหม่')}</button>
      </div>
    );
  }
  if (!boot || !rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดรายงานการประชุม…')} /></div>;

  const { groups, canEdit } = boot;
  const projects = groups.filter((g) => !g.is_inbox);
  const inboxes = groups.filter((g) => g.is_inbox);
  // แถบข้างแสดงเฉพาะโครงการที่มีบันทึกให้ผู้ใช้คนนี้เห็นจริง ๆ — ตามระบบของลูกค้า
  // (หน้าจอเขามี 8 โครงการ ทั้งที่ทะเบียนมี 9: Business Development ที่ยังไม่มี
  // บันทึกไม่ขึ้น) กลุ่มที่ว่างยังอยู่ในทะเบียน เลือกได้ตอนสร้างหรือย้ายบันทึก และ
  // เปิดจากแผงสิทธิ์การเข้าถึงได้ตามเดิม
  //
  // กลุ่มที่กำลังเปิดอยู่ต้องไม่หายไปใต้เท้าตัวเอง: คนที่เพิ่งกด "เพิ่มโครงการ"
  // จะถูกพาเข้ากลุ่มใหม่ทันที ถ้าซ่อนตามกฎศูนย์ก็เท่ากับกดสร้างแล้วไม่เกิดอะไรขึ้น
  // ส่วนกล่องรอจัดเก็บขึ้นเสมอแม้เป็นศูนย์ คนที่จะต่อ Fathom ต้องเห็นปลายทาง
  const sideProjects = projects.filter((g) => g.count + (g.tagged_count || 0) > 0 || g.id === group);
  const allCount = boot.allTotal ?? boot.total;

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
      load(); reload();
    } catch (e) { toast.error(e.message); }
  };

  /** ลิงก์ถาวรของโครงการ — เปิดทีไรก็ได้ฉบับล่าสุด ณ เวลานั้น ไม่ใช่ฉบับที่
   *  ล่าสุดตอนคัดลอก ต่างจากลิงก์ของเอกสารที่ชี้ฉบับเดียวตายตัว */
  const copyProjectLink = async (gid) => {
    const link = `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(gid)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t('คัดลอกลิงก์ฉบับล่าสุดแล้ว'));
    } catch { toast.error(link); }
  };

  const pick = (gid) => {
    setGroup(gid === group ? '' : gid);
    setOpenId(null);
    setRange('all');
    // เลือกโครงการคือการขอดูรายการของโครงการนั้น ไม่ใช่ขอดูเส้นเวลาที่กรองแล้ว —
    // ถ้าค้างอยู่ในเส้นเวลา คนกดจะไม่เห็นอะไรเปลี่ยนเลยนอกจากสีของแถวในแถบข้าง
    setTimeline(false);
  };

  /** เปลี่ยนขนาดตัวอักษร — จำไว้ทันที ไม่ต้องมีปุ่มบันทึก การตั้งค่าที่ต้องกด
   *  บันทึกอีกทีคือการตั้งค่าที่คนลืมกดแล้วคิดว่าระบบไม่จำ */
  const pickSize = (v) => { setSize(v); writeReadingSize(v); };

  const rangeBtn = (r, label) => {
    const n = (rows || []).filter((x) => inRange(x, r)).length;
    return (
      <button key={r} onClick={() => setRange(r)}
        style={range === r ? { background: MTG_NAVY, borderColor: MTG_NAVY } : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition ${
          range === r ? 'text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
        {t(label)}
        <span className={`text-xs ${range === r ? 'opacity-80' : 'text-slate-400'}`}>{n}</span>
      </button>
    );
  };

  const headLabel = group ? (groupsById.get(group)?.name || t('ทุกการประชุม')) : t('ทุกการประชุม');

  /** ชิปแหล่งที่มา — แยกสีสองบริการเหมือนของเขา คนกวาดตาหารายการที่มาจาก
   *  เครื่องถอดเสียงได้โดยไม่ต้องอ่านตัวหนังสือ */
  const SourceChip = ({ m }) => {
    const src = sourceLabel(m);
    if (!src) return null;
    return (
      <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${
        src === 'Fathom' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>
        {src}
      </span>
    );
  };

  /** แถวหนึ่งในแถบข้าง */
  const SideRow = ({ id, name, nameEn, color, count, on, renameable }) => (
    <div onClick={() => pick(id)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } }}
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
        on ? 'bg-brand-tint ring-1 ring-brand' : 'hover:bg-slate-50'}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800">{name}</span>
        {/* ชื่ออังกฤษเก็บอยู่ในฐานข้อมูล (name_en) มาตั้งแต่ต้นแต่ไม่เคยแสดง — ของเขา
            แสดงเป็นบรรทัดรอง และคนทำงานกับที่ปรึกษาต่างชาติต้องใช้ชื่อนี้คุยกัน */}
        {nameEn && <span className="block truncate text-[11px] leading-tight text-slate-400">{nameEn}</span>}
      </span>
      {renameable && (
        <button type="button" title={t('เปลี่ยนชื่อโครงการ')} aria-label={t('เปลี่ยนชื่อโครงการ')}
          onClick={(e) => { e.stopPropagation(); setGroupForm(groupsById.get(id)); }}
          className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-white hover:text-brand group-hover:opacity-100 focus:opacity-100">
          <Icon name="edit" className="h-3.5 w-3.5" />
        </button>
      )}
      <span className="shrink-0 text-xs font-medium text-slate-400">{count}</span>
    </div>
  );

  const Card = ({ m }) => {
    const g = groupsById.get(m.group_id);
    return (
      <button onClick={() => setOpenId(m.id)}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
          openId === m.id ? 'border-brand bg-brand-tint' : 'border-slate-200 bg-white hover:border-slate-300'} ${
          m.visible === false ? 'opacity-70' : ''}`}>
        {/* บรรทัดบนของเขาคือ "แถวข้อมูลประจำตัว": จุดสีแทนชื่อโครงการ (ชื่อเต็ม
            อยู่ในแถบข้างอยู่แล้วและกินบรรทัดทั้งบรรทัด) ตามด้วยวันที่ซึ่งเป็น
            สิ่งที่คนกวาดตาหาจริง ๆ แล้วจึงเป็นป้ายต่าง ๆ */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g?.color || '#94a3b8' }}
            title={g?.name} />
          <span className="font-medium">
            {meetingDateText(m, lang, t('ภาพรวม'))}{meetingTimeText(m) ? ` · ${meetingTimeText(m)}` : ''}
          </span>
          {m.pinned && <Icon name="pin" className="h-3.5 w-3.5 text-amber-500" title={t('ปักหมุด')} />}
          {m.visible === false && <span className="chip bg-slate-100 text-slate-500">{t('ซ่อน')}</span>}
          {m.kind === 'overview' && <span className="chip bg-indigo-50 text-indigo-600">{t('ภาพรวม')}</span>}
          <SourceChip m={m} />
          {m.attachment_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-slate-400" title={t('ไฟล์แนบ')}>
              <Icon name="paperclip" className="h-3.5 w-3.5" />{m.attachment_count}
            </span>
          )}
          {m.comment_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-slate-400" title={t('ความเห็น')}>
              <Icon name="chat" className="h-3.5 w-3.5" />{m.comment_count}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-800">{m.title}</div>
        {m.excerpt && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{m.excerpt}</div>}
      </button>
    );
  };

  /** การ์ด "ฉบับล่าสุด" ที่กดเข้าไปอ่านได้ */
  // `as` = โครงการที่การ์ดใบนี้ยืนแทน ต้องส่งมาเมื่อบันทึกนั้นอยู่ในกล่องรอจัดเก็บ
  // แล้วถูกจัดเก็บเข้าโครงการ ไม่อย่างนั้นการ์ดของ ERP จะพาดหัวว่า "กล่องรอจัดเก็บ
  // · Transkriptor" ทั้งที่หัวข้อด้านบนบอกว่านี่คือฉบับล่าสุดของแต่ละโครงการ
  const DashCard = ({ m, as, children }) => {
    const g = as || groupsById.get(m.group_id);
    return (
      // การ์ดนี้เป็น div ไม่ใช่ button เพราะบทสรุปที่ดึงมาอาจมีลิงก์หรือย่อหน้า
      // อยู่ข้างใน — ของพวกนั้นอยู่ใน <button> ไม่ได้ตามสเปก HTML
      <div onClick={() => setOpenId(m.id)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(m.id); } }}
        className="flex w-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
        style={{ borderLeftColor: g?.color || '#94a3b8', borderLeftWidth: 4 }}>
        <span className="text-xs font-semibold text-slate-500">{g?.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-brand">
          <Icon name="calendar" className="h-3.5 w-3.5" />
          {meetingDateText(m, lang, t('ภาพรวม'))}{meetingTimeText(m) ? ` · ${meetingTimeText(m)}` : ''}
          {m.pinned && <Icon name="pin" className="h-3.5 w-3.5 text-amber-500" />}
          <SourceChip m={m} />
        </span>
        <span className="mt-1.5 text-sm font-bold text-slate-800">{m.title}</span>
        {children || (m.excerpt && <span className="mt-1 line-clamp-4 text-xs leading-relaxed text-slate-500">{m.excerpt}</span>)}
        <span className="mt-3 text-xs font-semibold text-brand">{t('อ่านบันทึก →')}</span>
      </div>
    );
  };

  const dashboard = () => {
    if (rows.length === 0) {
      return (
        <p className="rounded-2xl border border-dashed border-slate-200 py-20 text-center text-sm text-slate-500">
          {/* telling someone to pick from a list that is empty is a dead end */}
          {q ? t('ไม่พบการประชุมที่ตรงกับคำค้น') : t('ยังไม่มีการประชุมให้อ่าน — กด “เพิ่มการประชุม” เพื่อเริ่มฉบับแรก')}
        </p>
      );
    }
    // เลือกโครงการเดียว → ฉบับล่าสุดของโครงการนั้น พร้อมบทสรุปผู้บริหาร
    if (group && latestOfGroup) {
      const html = summary?.id === latestOfGroup.id ? summary.html : undefined;
      const sec = html ? summarySection(html) : '';
      const bullets = html && !sec ? summaryBullets(html, 4) : [];
      return (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: groupsById.get(group)?.color }} />
              {groupsById.get(group)?.name} — {t('การประชุมล่าสุด')}
            </h2>
            <button onClick={() => copyProjectLink(group)} className="btn-outline !py-1.5 !text-xs"
              title={t('ลิงก์ที่เปิดทีไรก็ได้ฉบับล่าสุดของโครงการนี้เสมอ')}>
              <Icon name="link" className="h-3.5 w-3.5" /> {t('คัดลอกลิงก์ฉบับล่าสุด')}
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {t('บทสรุปผู้บริหารและประเด็นสำคัญจากการประชุมครั้งล่าสุด — กดเพื่ออ่านฉบับเต็ม')}
          </p>
          <DashCard m={latestOfGroup} as={groupsById.get(group)}>
            {html === undefined
              ? <span className="mt-2 block text-xs text-slate-400">{t('กำลังโหลดบทสรุป…')}</span>
              : sec ? (
                <span className="mt-2 block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('บทสรุปผู้บริหาร')}
                  </span>
                  <span className="mtg-body mtg-summary block text-xs leading-relaxed text-slate-600"
                    dangerouslySetInnerHTML={{ __html: sec }} />
                </span>
              ) : bullets.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              ) : (
                <span className="mt-1 line-clamp-3 text-xs text-slate-500">
                  {latestOfGroup.excerpt || t('เปิดเพื่ออ่านบันทึกฉบับเต็ม')}
                </span>
              )}
          </DashCard>
        </section>
      );
    }
    // ทุกการประชุม → ฉบับล่าสุดของแต่ละโครงการ อย่างมากหกใบ เกินกว่านั้นมันเลิก
    // เป็น "มีอะไรใหม่" แล้วกลายเป็นรายการอีกอันหนึ่ง
    const cards = projects
      .map((g) => ({ g, m: latestPerGroup.get(g.id) })).filter((c) => c.m)
      .sort((a, b) => String(b.m.meeting_date || '').localeCompare(String(a.m.meeting_date || '')))
      .slice(0, 6);
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">{t('การประชุมล่าสุด')}</h2>
          <p className="text-sm text-slate-500">
            {t('บันทึกการประชุมครั้งล่าสุดของแต่ละโครงการ — กดการ์ดใดก็ได้เพื่ออ่านฉบับเต็ม')}
          </p>
        </div>
        {cards.length === 0
          ? <p className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
              {t('ยังไม่มีการประชุมให้แสดง')}
            </p>
          : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map(({ g, m }) => <DashCard key={g.id} m={m} as={g} />)}
            </div>
          )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {/* ── แถบหัวโมดูล ───────────────────────────────────────────────────
          น้ำเงินเข้มเต็มความกว้างเหมือนระบบจริงของลูกค้า: ชื่อกลุ่มบริษัททางซ้าย
          ช่องค้นหายาวทางขวา เพราะการค้นหาคือสิ่งที่คนทำบ่อยที่สุดในโมดูลนี้ —
          มันเคยอยู่กลางหน้าใต้ตัวกรอง ซึ่งต้องเลื่อนหาก่อนทุกครั้ง */}
      <header className="rounded-2xl px-4 py-3 text-white sm:px-5" style={{ background: MTG_NAVY }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-base font-bold tracking-wide">VCB Group</span>
              <span className="text-white/40">|</span>
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
                {t('รายงานการประชุม')}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-white/60">
              {t('กลุ่มวิจิตรภัณฑ์ก่อสร้าง · รายงานการประชุมภายใน')}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none lg:w-96">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาการประชุม')}
                placeholder={t('ค้นหาการประชุม, มติ, บุคคล…')}
                className="w-full rounded-lg border border-white/20 bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-white/50 outline-none transition focus:border-white/50 focus:bg-white/15" />
            </div>
            {/* ปุ่มเฟืองเปิด "แผงตั้งค่า" ของโมดูลแบบของเขา ไม่ใช่กระโดดเข้าแผงสิทธิ์
                โดยตรงอย่างเดิม — ข้างในมีภาษาและขนาดตัวอักษรที่ทุกคนใช้ได้ ส่วนสิทธิ์
                โครงการเป็นหนึ่งรายการในนั้นและขึ้นเฉพาะผู้ที่จัดการได้ ปุ่มจึงต้อง
                ไม่ถูกซ่อนจากคนอ่านทั่วไปอีก */}
            <button onClick={() => setSettings(true)}
              title={t('ตั้งค่า')} aria-label={t('ตั้งค่า')}
              className="shrink-0 rounded-lg border border-white/20 p-2 text-white/80 transition hover:bg-white/10 hover:text-white">
              <Icon name="settings" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* เส้นเวลาต้องการความกว้าง: สิบสองเดือนหรือแปดเลนบนคอลัมน์ 1fr ของสามคอลัมน์
          อ่านไม่ได้จริง ตอนเปิดเส้นเวลาจึงยุบคอลัมน์รายการ (เส้นเวลาเป็นตัวเลือก
          รายการอยู่แล้ว กดจุดแล้วเปิดฉบับนั้น) แต่แถบข้างยังอยู่เพราะเป็นสารบัญ */}
      <div className={`grid grid-cols-1 gap-4 xl:items-start ${timeline
        ? 'xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]'
        : 'xl:grid-cols-[minmax(0,15rem)_minmax(0,21rem)_minmax(0,1fr)]'}`}>
        {/* ── แถบข้าง: โครงการ ─────────────────────────────────────────── */}
        <aside className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          {canEdit && (
            <button onClick={() => setEditing('new')} className="btn-primary w-full !py-2 !text-sm">
              <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มการประชุม')}
            </button>
          )}
          {boot.canManage && (
            <button onClick={() => setGroupForm('new')} className="btn-outline w-full !py-2 !text-sm">
              <Icon name="plus" className="h-4 w-4" /> {t('เพิ่มโครงการ')}
            </button>
          )}
          {/* ปุ่มเส้นเวลาอยู่หัวแถบข้างเหมือนของเขา — มันเป็นมุมมองที่สามของข้อมูล
              ชุดเดียวกัน ไม่ใช่โครงการหนึ่ง จึงไม่อยู่ในรายชื่อโครงการข้างล่าง */}
          <button onClick={() => { setTimeline((v) => !v); setOpenId(null); }}
            aria-pressed={timeline}
            title={t('มุมมองเส้นเวลาของทุกโครงการ')}
            style={timeline ? { background: MTG_NAVY, borderColor: MTG_NAVY } : undefined}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              timeline ? 'text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            <Icon name="chart" className="h-4 w-4" /> {t('เส้นเวลา')}
          </button>
          <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t('โครงการ')}</p>
          <div className="space-y-0.5">
            <SideRow id="" name={t('ทุกการประชุม')} nameEn="All meetings"
              color="#0b3d62" count={allCount} on={group === ''} />
            {sideProjects.map((g) => (
              <SideRow key={g.id} id={g.id} name={g.name} nameEn={g.name_en}
                color={g.color} count={g.count + (g.tagged_count || 0)}
                on={group === g.id} renameable={boot.canManage} />
            ))}
          </div>
          {/* กล่องรอจัดเก็บอยู่แยก: มันเป็นคิวที่ต้องไล่ฟัง ไม่ใช่ที่ที่บันทึก
              การประชุมอยู่ และต้องขึ้นแม้จำนวนเป็นศูนย์ — คนที่ต่อ Fathom เข้ามา
              ต้องเห็นว่าปลายทางอยู่ตรงไหนก่อนจะมีอะไรมาถึง */}
          {inboxes.length > 0 && (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <div className="space-y-0.5">
                {inboxes.map((g) => (
                  <div key={g.id} onClick={() => pick(g.id)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.id); } }}
                    title={t('บันทึกเสียงที่ยังไม่ได้จัดเก็บเข้าโครงการ')}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                      group === g.id ? 'bg-slate-100 ring-1 ring-slate-400' : 'hover:bg-slate-50'}`}>
                    <Icon name="inbox" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-600">{g.name}</span>
                      {g.name_en && <span className="block truncate text-[11px] leading-tight text-slate-400">{g.name_en}</span>}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400">{g.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* ── รายการ ────────────────────────────────────────────────────── */}
        {!timeline && (
        <section className="space-y-2">
          <p className="text-sm font-bold text-slate-700">
            {headLabel} <span className="font-medium text-slate-400">· {shown.length} {t('รายการ')}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {rangeBtn('all', 'ทั้งหมด')}
            {rangeBtn('week', 'สัปดาห์นี้')}
            {rangeBtn('month', 'เดือนนี้')}
          </div>
          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              {q ? t('ไม่พบการประชุมที่ตรงกับคำค้น')
                : range !== 'all' ? t('ไม่มีการประชุมในช่วงเวลานี้')
                  : t('ยังไม่มีการประชุมในโครงการนี้')}
            </p>
          )}
          {shown.map((m) => <Card key={m.id} m={m} />)}
        </section>
        )}

        {/* ── เอกสาร (หรือเส้นเวลา) ─────────────────────────────────────── */}
        <div className="min-w-0">
          {timeline ? (
            <Timeline groups={groups}
              onOpen={(id) => { setTimeline(false); setOpenId(id); }} />
          ) : openId ? (
            <MeetingDetail
              id={openId} canEdit={canEdit} canManage={boot.canManage} groups={groups}
              readingSize={size} refresh={docVersion}
              onClose={() => setOpenId(null)}
              onEdit={(row) => setEditing(row)}
              onDelete={removeRow}
              onChanged={() => { load(); reload(); }}
            />
          ) : dashboard()}
        </div>
      </div>

      {editing && (
        <MeetingForm
          row={editing === 'new' ? null : editing}
          groups={groups}
          defaultGroupId={group || groups[0]?.id}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setOpenId(id); setDocVersion((v) => v + 1); load(); reload(); }}
        />
      )}
      {groupForm && (
        <GroupForm
          row={groupForm === 'new' ? null : groupForm}
          onClose={() => setGroupForm(null)}
          onSaved={(gid) => { setGroupForm(null); reload(); if (gid) setGroup(gid); }}
        />
      )}
      {settings && (
        <SettingsPanel
          size={size} onSize={pickSize} canManage={boot.canManage}
          onAccess={() => setAccess(true)} onClose={() => setSettings(false)}
        />
      )}
      {access && <AccessPanel onClose={() => { setAccess(false); load(); reload(); }} />}
    </div>
  );
}

/**
 * เพิ่ม / เปลี่ยนชื่อโครงการ
 *
 * เส้นทาง createGroup / updateGroup มีอยู่ในเซิร์ฟเวอร์ตั้งแต่ migration 0045
 * แต่ไม่เคยมีหน้าจอ — ผู้ดูแลจึงเพิ่มโครงการเองไม่ได้เลย ต้องให้เราไปแทรกให้ทีละ
 * ครั้ง คำอธิบายด้านบนกล่องมาจากของเขาตรง ๆ: นี่คือการเพิ่มแถวในแถบข้าง ไม่ใช่
 * การสร้างเอกสารอะไรขึ้นมา คนมักคาดว่ากดแล้วจะได้ไฟล์
 */
function GroupForm({ row, onClose, onSaved }) {
  const t = useT();
  const toast = useToast();
  const editing = Boolean(row);
  const [form, setForm] = useState({
    name: row?.name || '',
    nameEn: row?.name_en || '',
    cadence: row?.cadence || 'รายเดือน',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError(t('กรุณากรอกชื่อโครงการ')); return; }
    setBusy(true);
    try {
      const body = { name: form.name.trim(), name_en: form.nameEn.trim(), cadence: form.cadence };
      if (editing) {
        await meetingsApi.updateGroup(row.id, body);
        toast.success(t('บันทึกแล้ว'));
        onSaved(row.id);
      } else {
        const r = await meetingsApi.createGroup(body);
        toast.success(t('เพิ่มโครงการแล้ว'));
        onSaved(r.data?.id);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title={editing ? t('เปลี่ยนชื่อโครงการ') : t('เพิ่มโครงการ')}
      onClose={busy ? undefined : onClose}
      size="md"
      footer={(
        <>
          <button type="button" onClick={onClose} className="btn-outline">{t('ยกเลิก')}</button>
          <button type="submit" form="mtg-group-form" disabled={busy} className="btn-primary">
            {busy ? t('กำลังบันทึก…') : editing ? t('บันทึก') : t('เพิ่มโครงการ')}
          </button>
        </>
      )}
    >
      <form id="mtg-group-form" onSubmit={submit} className="space-y-3">
        {!editing && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {t('เป็นการเพิ่มแถวใหม่ในแถบข้างเพื่อใช้จัดเก็บการประชุมและบันทึกเสียงเท่านั้น ไม่ได้สร้างเอกสารหรือไฟล์ใด')}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            {t('ชื่อโครงการ (ไทย)')} <span className="text-red-500">*</span>
          </label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus
            placeholder={t('เช่น โครงการหลวงพระบาง')} className="field" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ชื่ออังกฤษ')}</label>
          <input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)}
            placeholder="e.g. Luang Prabang Project" className="field" />
          <p className="mt-1 text-xs text-slate-400">{t('ใช้เป็นบรรทัดรองในแถบข้าง และใช้อ้างอิงภายใน')}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">{t('ความถี่')}</label>
          <select value={form.cadence} onChange={(e) => set('cadence', e.target.value)} className="field">
            <option value="รายเดือน">{t('รายเดือน')}</option>
            <option value="รายไตรมาส">{t('รายไตรมาส')}</option>
            <option value="ตามความจำเป็น">{t('ตามความจำเป็น')}</option>
          </select>
        </div>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  );
}
