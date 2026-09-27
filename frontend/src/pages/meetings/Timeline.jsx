import { useEffect, useMemo, useState } from 'react';
import {
  meetingsApi, meetingDateText, meetingTimeText, MTG_NAVY,
  TH_MONTHS_ABBR, EN_MONTHS_ABBR,
} from '../../lib/meetings.js';
import { Modal } from '../../components/ui/index.js';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { useLang, useT } from '../../lib/i18n.jsx';

/**
 * เส้นเวลา — สองมุมมองตามระบบจริงของลูกค้า (renderTimeline ใน JavaScript.html)
 *
 *   แนวนอน   เลนละโครงการ จุดละการประชุม บนแกนเวลาร่วมอันเดียว
 *   ปฏิทินปี  12 เดือน จุดสีในวันที่มีประชุม
 *
 * ทั้งสองตอบคำถามที่รายการเรียงตามวันที่ตอบไม่ได้: "โครงการไหนเงียบไปสองเดือน"
 * และ "สัปดาห์นั้นเราประชุมกันกี่เรื่อง" — จังหวะของงาน ไม่ใช่ลำดับของเอกสาร
 *
 * ดึงรายการของตัวเองแบบไม่กรอง ไม่ใช้ rows ของหน้าแม่ที่ถูกกรองด้วยโครงการที่
 * เลือกและคำค้นอยู่ — เส้นเวลาที่แสดงเลนเดียวเพราะหน้าแม่กรองไว้ ไม่ใช่เส้นเวลา
 */
export default function Timeline({ groups = [], onOpen }) {
  const t = useT();
  const { lang } = useLang();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('horizontal');   // horizontal | calendar
  const [hidden, setHidden] = useState({});         // { groupId: true } = ปิดไว้
  // ปีที่ปฏิทินกำลังเปิด เก็บเป็นคริสต์ศักราชเพราะ Date คิดด้วยค่านี้ แต่ป้ายที่
  // คนอ่านเป็นพุทธศักราชเสมอ (ปุ่ม ← 2569 →)
  const [year, setYear] = useState(new Date().getFullYear());
  const [dayPick, setDayPick] = useState(null);     // { iso, items } วันที่มีหลายฉบับ

  useEffect(() => {
    let alive = true;
    meetingsApi.list({})
      .then((r) => { if (alive) setRows(r.data); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  // โครงการที่มีสิทธิ์เห็น ไม่รวมกล่องรอจัดเก็บ — มันเป็นคิวที่ต้องไล่ฟัง ไม่ใช่
  // โครงการที่มีจังหวะการประชุมของตัวเอง และบันทึกในกล่องที่จัดเก็บเข้าโครงการแล้ว
  // จะถูกพลอตสองครั้งบนวันเดียวกันถ้านับกล่องเป็นเลนด้วย
  const projects = useMemo(() => groups.filter((g) => !g.is_inbox), [groups]);

  /**
   * บันทึกที่พลอตได้ — ต้องมีวันที่จริง ไม่ใช่แถวภาพรวม และโครงการยังไม่ถูกปิด
   *
   * แถวหนึ่งอาจปรากฏในหลายเลน: บันทึกส่วนใหญ่ของลูกค้าอยู่ในกล่องรอจัดเก็บแล้วถูก
   * จัดเก็บเข้าโครงการด้วยป้าย ถ้าดูแต่ group_id โครงการอย่าง ERP หรือหลวงพระบาง
   * จะไม่มีจุดเลยทั้งที่แถบข้างนับให้แล้ว — เกณฑ์เดียวกับการ์ดฉบับล่าสุดหน้าแรก
   */
  const plotted = useMemo(() => {
    const out = [];
    for (const m of rows || []) {
      if (m.kind === 'overview') continue;
      const iso = m.meeting_date ? String(m.meeting_date).slice(0, 10) : '';
      if (!iso) continue;
      const homes = new Set();
      if (!m.is_inbox) homes.add(m.group_id);
      for (const tag of m.tags || []) homes.add(tag.id);
      for (const gid of homes) {
        if (hidden[gid]) continue;
        out.push({ ...m, iso, lane: gid });
      }
    }
    return out;
  }, [rows, hidden]);

  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const months = lang === 'en' ? EN_MONTHS_ABBR : TH_MONTHS_ABBR;

  const empty = (msg) => (
    <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">{msg}</p>
  );

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!rows) return <div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดเส้นเวลา…')} /></div>;

  const openOne = (id) => { setDayPick(null); onOpen?.(id); };

  const modeBtn = (key, icon, label) => (
    <button key={key} onClick={() => setMode(key)}
      style={mode === key ? { background: MTG_NAVY, borderColor: MTG_NAVY } : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
        mode === key ? 'text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
      <Icon name={icon} className="h-4 w-4" /> {t(label)}
    </button>
  );

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <Icon name="calendar" className="h-4 w-4 text-slate-400" /> {t('เส้นเวลา')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* ปุ่มปีมีเฉพาะโหมดปฏิทิน — แนวนอนย่อ/ขยายตามช่วงของข้อมูลเอง
              ไม่มีปีให้เลื่อน ปุ่มที่กดแล้วไม่เกิดอะไรขึ้นแย่กว่าไม่มีปุ่ม */}
          {mode === 'calendar' && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1 py-0.5">
              <button onClick={() => setYear((y) => y - 1)} aria-label={t('ปีก่อนหน้า')}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">←</button>
              <b className="px-1 text-sm font-bold text-slate-700">{year + 543}</b>
              <button onClick={() => setYear((y) => y + 1)} aria-label={t('ปีถัดไป')}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">→</button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {modeBtn('horizontal', 'chart', 'แนวนอน')}
            {modeBtn('calendar', 'calendar', 'ปฏิทินทั้งปี')}
          </div>
        </div>
      </header>

      {/* เปิด/ปิดโครงการทีละอัน สีเดียวกับแถบข้าง ปิดแล้วจุดหายทั้งสองโหมด */}
      <div className="flex flex-wrap gap-1.5">
        {projects.map((g) => {
          const off = !!hidden[g.id];
          return (
            <button key={g.id} onClick={() => setHidden((h) => ({ ...h, [g.id]: !h[g.id] }))}
              aria-pressed={!off} title={off ? t('แสดงโครงการนี้') : t('ซ่อนโครงการนี้')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                off ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-700'}`}>
              <span className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: off ? '#cbd5e1' : g.color }} />
              {g.name}
            </button>
          );
        })}
      </div>

      {mode === 'horizontal'
        ? <Horizontal items={plotted} projects={projects} months={months} onOpen={openOne} empty={empty} t={t} />
        : <YearGrid items={plotted} byId={byId} year={year} onPick={setDayPick} onOpen={openOne} empty={empty} t={t} />}

      {dayPick && (
        <Modal title={`${t('การประชุมวันที่')} ${dayPick.label}`} onClose={() => setDayPick(null)} size="md"
          footer={<button onClick={() => setDayPick(null)} className="btn-outline">{t('ปิด')}</button>}>
          <div className="space-y-2">
            {dayPick.items.map((m) => (
              <button key={`${m.id}-${m.lane}`} onClick={() => openOne(m.id)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:border-brand hover:bg-brand-tint">
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ background: byId.get(m.lane)?.color || '#94a3b8' }} />
                  {byId.get(m.lane)?.name}
                  {meetingTimeText(m) ? ` · ${meetingTimeText(m)}` : ''}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-slate-800">{m.title}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

/**
 * แนวนอน — เลนละโครงการบนแกนเวลาร่วมอันเดียว
 *
 * ตำแหน่งของจุดเป็นเปอร์เซ็นต์ของช่วงเวลาทั้งหมด ไม่ใช่พิกเซล เลนทุกเลนจึงใช้
 * แกนเดียวกันจริงและกว้างเท่าไรก็ยังตรงกัน เว้นขอบสองข้าง 3% ของช่วง ไม่อย่างนั้น
 * จุดแรกกับจุดสุดท้ายจะถูกขอบเลนตัดครึ่ง (ของเขาก็เว้น padMs เท่านี้)
 */
function Horizontal({ items, projects, months, onOpen, empty, t }) {
  if (!items.length) return empty(t('ไม่มีการประชุมที่มีวันที่ในโครงการที่เลือกไว้'));

  const dates = items.map((m) => m.iso).sort();
  const minD = new Date(`${dates[0]}T00:00:00`);
  const maxD = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const span = Math.max(1, maxD - minD);
  const pad = span * 0.03;
  const startMs = minD.getTime() - pad;
  const total = (maxD.getTime() + pad) - startMs;
  const pct = (iso) => ((new Date(`${iso}T00:00:00`).getTime() - startMs) / total) * 100;

  const byLane = new Map();
  for (const m of items) {
    if (!byLane.has(m.lane)) byLane.set(m.lane, []);
    byLane.get(m.lane).push(m);
  }

  // ขีดเดือนกำกับ + เส้นกริดตั้งที่ต้นเดือนทุกเดือน วางบนแกนเดียวกับจุด
  const ticks = [];
  const cursor = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (cursor <= maxD) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
    const at = pct(iso);
    if (at >= 0 && at <= 100) {
      ticks.push({ at, label: `${months[cursor.getMonth()]} ${(cursor.getFullYear() + 543) % 100}` });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const lanes = projects.filter((g) => (byLane.get(g.id) || []).length);
  if (!lanes.length) return empty(t('ไม่มีการประชุมที่มีวันที่ในโครงการที่เลือกไว้'));

  return (
    <div className="overflow-x-auto">
      {/* ต้องมีความกว้างขั้นต่ำ ไม่อย่างนั้นบนจอแคบเดือนสิบสองเดือนจะทับกันจนอ่านไม่ออก */}
      <div className="min-w-[46rem]">
        <div className="relative">
          {/* เส้นกริดพาดทุกเลน วาดใต้จุด ไม่รับการคลิก */}
          <div className="pointer-events-none absolute inset-y-0 left-[11.5rem] right-0">
            {ticks.map((k) => (
              <div key={k.at} className="absolute inset-y-0 border-l border-dashed border-slate-200"
                style={{ left: `${k.at.toFixed(2)}%` }} />
            ))}
          </div>
          {lanes.map((g) => {
            const pts = (byLane.get(g.id) || []).slice()
              .sort((a, b) => a.iso.localeCompare(b.iso));
            return (
              <div key={g.id} className="flex items-center gap-2 py-1">
                <div className="flex w-44 shrink-0 items-center gap-1.5 pr-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{g.name}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{pts.length}</span>
                </div>
                <div className="relative h-8 flex-1 rounded-lg bg-slate-50">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
                  {pts.map((m) => (
                    <button key={`${m.id}-${m.iso}`} onClick={() => onOpen(m.id)}
                      title={`${m.title} — ${meetingDateText(m)}`}
                      aria-label={`${m.title} ${meetingDateText(m)}`}
                      className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white transition hover:h-4 hover:w-4"
                      style={{ left: `${pct(m.iso).toFixed(2)}%`, background: g.color }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* แกนเดือนอยู่ล่างสุด ใช้ระยะซ้ายเท่ากับความกว้างป้ายชื่อเลน จึงตรงกับจุด */}
        <div className="flex gap-2 pt-1">
          <div className="w-44 shrink-0" />
          <div className="relative h-5 flex-1 border-t border-slate-200">
            {ticks.map((k) => (
              <span key={k.at} className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-400"
                style={{ left: `${k.at.toFixed(2)}%` }}>{k.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * ปฏิทินทั้งปี — 12 เดือน จุดสีในวันที่มีประชุม
 *
 * จุดต่อวันไม่เกินสามจุด เกินกว่านั้นขึ้น "+N": ช่องวันหนึ่งกว้างไม่ถึงสองเซนติเมตร
 * ยัดจุดที่สี่เข้าไปก็ได้แถวจุดที่นับไม่ได้อยู่ดี
 */
function YearGrid({ items, byId, year, onPick, onOpen, empty, t }) {
  const byDate = new Map();
  for (const m of items) {
    if (!m.iso.startsWith(String(year))) continue;
    if (!byDate.has(m.iso)) byDate.set(m.iso, []);
    byDate.get(m.iso).push(m);
  }
  if (!byDate.size) {
    return empty(`${t('ไม่มีการประชุมในปี')} ${year + 543}`);
  }

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const full = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {full.map((name, mo) => {
        const firstDow = new Date(year, mo, 1).getDay();
        const days = new Date(year, mo + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDow; i += 1) cells.push(<div key={`pad${i}`} />);
        for (let d = 1; d <= days; d += 1) {
          const iso = `${year}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const list = byDate.get(iso) || [];
          const isToday = iso === todayIso;
          if (!list.length) {
            cells.push(
              <div key={iso} className={`flex h-7 flex-col items-center justify-start rounded text-[10px] leading-tight ${
                isToday ? 'font-bold text-brand ring-1 ring-brand' : 'text-slate-400'}`}>{d}</div>
            );
            continue;
          }
          const label = `${d} ${full[mo]} ${year + 543}`;
          cells.push(
            <button key={iso}
              onClick={() => (list.length === 1 ? onOpen(list[0].id) : onPick({ iso, label, items: list }))}
              title={list.map((m) => m.title).join(', ')}
              className={`flex h-7 flex-col items-center justify-start rounded bg-slate-50 text-[10px] font-semibold leading-tight transition hover:bg-brand-tint ${
                isToday ? 'text-brand ring-1 ring-brand' : 'text-slate-700'}`}>
              {d}
              <span className="mt-px flex items-center gap-px">
                {list.slice(0, 3).map((m, i) => (
                  <span key={`${m.id}-${m.lane}-${i}`} className="h-1.5 w-1.5 rounded-full"
                    style={{ background: byId.get(m.lane)?.color || '#94a3b8' }} />
                ))}
                {list.length > 3 && <span className="text-[8px] text-slate-400">+{list.length - 3}</span>}
              </span>
            </button>
          );
        }
        return (
          <div key={name} className="rounded-xl border border-slate-100 p-2">
            <p className="mb-1 text-center text-xs font-bold text-slate-600">{name}</p>
            <div className="grid grid-cols-7 gap-px text-center">
              {DOW_TH.map((l, i) => (
                <div key={`${l}${i}`} className="text-[9px] font-medium text-slate-300">{l}</div>
              ))}
              {cells}
            </div>
          </div>
        );
      })}
    </div>
  );
}
