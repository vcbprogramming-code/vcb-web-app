import { useEffect, useState } from 'react';
import { perfApi, perfPrefs, downloadAs, mandayReportName } from '../../lib/performance.js';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';
import Icon from '../../components/Icon.jsx';
import { monthName, showYear } from './MonthPicker.jsx';
import { useT } from '../../lib/i18n.jsx';

const dnum = (iso) => Number(iso.slice(8, 10));
const dow = (iso) => new Date(iso + 'T00:00:00').getDay();

function Ring({ pct, color }) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg width="66" height="66" viewBox="0 0 66 66" className="shrink-0">
      <circle cx="33" cy="33" r={r} fill="none" stroke="#e8edf3" strokeWidth="7" />
      <circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 33 33)" />
      <text x="33" y="37" textAnchor="middle" className="fill-slate-800 text-[14px] font-extrabold">{pct}%</text>
    </svg>
  );
}

// compact month calendar coloured by daily fill (green full · amber partial · red
// missing · cream weekend · gray future/not-due)
function MiniCal({ daysFilled, today }) {
  if (!daysFilled?.length) return null;
  const first = daysFilled[0].date;
  const lead = dow(first); // blanks before day 1
  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((h) => <div key={h} className="text-center text-[8px] text-slate-300">{h}</div>)}
      {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
      {daysFilled.map((day) => {
        const future = day.date > today;
        let bg = '#eef2f8', fg = '#9aa5b4';
        if (day.weekend) { bg = '#fdf0d4'; fg = '#a9895a'; }
        else if (future) { bg = '#eef2f8'; fg = '#c2cad6'; }
        else if (day.total === 0) { bg = '#eef2f8'; }
        else if (day.filled >= day.total) { bg = '#1f9d55'; fg = '#fff'; }
        else if (day.filled > 0) { bg = '#e8b500'; fg = '#5a4500'; }
        else { bg = '#e0533a'; fg = '#fff'; }
        return (
          <div key={day.date} title={`${day.date} · ${day.filled}/${day.total}`}
            className={`flex h-5 items-center justify-center rounded-[3px] text-[8px] font-semibold ${day.date === today ? 'ring-1 ring-brand' : ''}`}
            style={{ background: bg, color: fg }}>
            {dnum(day.date)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * กิจกรรม/หมวดงานที่ลงบ่อยที่สุด — ตัวเลขคือ "วันทำงาน" ไม่ใช่จำนวนแถว
 *
 * ค่านี้ถ่วงน้ำหนักมาแล้ว (สองงานในวันเดียว = 0.5 ต่องาน) จึงต้องเรียกด้วยหน่วย
 * ที่ถูกต้อง ไม่งั้นคนอ่านว่าเป็น "ครั้ง" แล้วสงสัยว่าทำไมมีทศนิยม
 */
function TopList({ items, entries }) {
  const t = useT();
  const [all, setAll] = useState(false);
  if (!items?.length) {
    // มีบันทึกแต่ไม่ตรงทะเบียน กับไม่มีบันทึกเลย เป็นคนละเรื่องและแก้ต่างกัน
    return entries > 0 ? (
      <p className="px-2 py-5 text-center text-xs leading-relaxed text-slate-400">
        {t('บันทึก {n} รายการ แต่ไม่ตรงกับดัชนี', { n: entries })}
        <br />
        <span className="text-[10px]">{t('(เป็นวันหยุด/ลา หรือยังไม่ได้เพิ่มเข้าดัชนีงาน)')}</span>
      </p>
    ) : (
      <p className="px-2 py-5 text-center text-xs text-slate-400">{t('ยังไม่มีบันทึกในเดือนนี้')}</p>
    );
  }
  const shown = all ? items : items.slice(0, 5);
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1.5">
      {shown.map((it, i) => (
        <div key={i} className="text-xs" title={`${it.name} — ${it.count} ${t('วันทำงาน')} (${it.pct}%)`}>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-slate-700">{it.name}</span>
            <span className="shrink-0 font-semibold text-slate-500">
              {it.count} <span className="font-normal text-slate-400">{t('วันทำงาน')}</span> <span className="text-slate-300">({it.pct}%)</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((it.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setAll((v) => !v)} className="pt-0.5 text-[11px] text-brand hover:underline">
          {all ? t('ย่อ', null, 'list') : t('ดูทั้งหมด ({n})', { n: items.length })}
        </button>
      )}
    </div>
  );
}

const MODES = [['progress', 'ความคืบหน้า'], ['topact', 'กิจกรรมหลัก'], ['topcost', 'หมวดงานหลัก']];

export default function Dashboard({ cur, onOpenSite, canEntry = true }) {
  const t = useT();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // มุมมองเริ่มต้นมาจากค่าที่ตั้งไว้ในหน้าตั้งค่า (เก็บในเครื่อง)
  const [mode, setMode] = useState(() => perfPrefs.get().dashView || 'progress');

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(null);
    perfApi.adminSummary(cur.y, cur.m)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [cur.y, cur.m]);

  const prefs = perfPrefs.get();
  // แปลที่จุด render — ชื่อเดือนเป็นฉลากที่คนอ่าน ไม่ใช่ค่าที่เซิร์ฟเวอร์อ่านกลับ
  const monthOnly = t(monthName(cur.m));
  const monthFull = `${monthOnly} ${showYear(cur.y, prefs.yearFmt)}`;

  const head = (
    <div className="card">
      <h2 className="text-lg font-bold text-slate-800">{t('แดชบอร์ด')}</h2>
      <p className="mt-0.5 text-sm text-slate-500">{t('ภาพรวมการบันทึกการทำงานรายหน่วยงาน')} · {monthFull}</p>
    </div>
  );

  if (error) return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="space-y-3">{head}<div className="flex justify-center py-16"><Spinner label={t('กำลังโหลดภาพรวม…')} /></div></div>;
  const hidden = new Set(prefs.hiddenSites);
  const rows = (data.rows || []).filter((r) => !hidden.has(r.site_key));
  // ซ่อนไว้เองกับไม่มีสิทธิ์เลย เป็นทางตันสองแบบที่แก้ไม่เหมือนกัน — บอกให้ตรง
  const allHidden = (data.rows || []).length > 0;

  const ym = `${cur.y}-${String(cur.m).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {head}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {MODES.map(([k, label]) => (
            <button key={k} onClick={() => setMode(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {t(label)}
            </button>
          ))}
        </div>
        {/* รายงานของทั้งเดือนทุกโครงการในไฟล์เดียว — อยู่ตรงนี้เพราะคนมาดู
            ภาพรวมแล้วมักอยากได้ไฟล์ไปต่อทันที ไม่ต้องข้ามไปแท็บรายงาน */}
        {/* เดิมเป็นลิงก์ที่ href เป็น Promise (ไฟล์ต้องขอพร้อม token) กดแล้วไม่ได้ไฟล์
            ส่งออกเดือนที่หน้าจอกำลังแสดงอยู่ ไม่ใช่เดือนปัจจุบันของปฏิทิน */}
        <button type="button" onClick={() => downloadAs(perfApi.monthlyReportUrl(ym), mandayReportName(cur.y, cur.m)).catch((e) => toast.error(e.message))}
          className="btn-outline ml-auto !py-1.5 !text-sm"
          title={t('ส่งออกสรุปวันทำงานรายหมวดงาน/กิจกรรม สำหรับเดือนนี้ (Excel)')}>
          <Icon name="download" className="h-4 w-4" /> {t('รายงานวันทำงาน')}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card py-10 text-center">
          <h3 className="font-bold text-slate-700">{allHidden ? t('หน่วยงานทั้งหมดถูกซ่อนอยู่') : t('ยังไม่มีหน่วยงานในสิทธิ์ของคุณ')}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {allHidden ? t('เปิดหน่วยงานที่ต้องการได้ที่ ตั้งค่า › หน่วยงานที่แสดง') : t('ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ดูหน่วยงาน')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const color = s.color || '#2563eb';
            const started = s.support_started + s.operation_started;
            const isTop = mode === 'topact' || mode === 'topcost';
            return (
              <div key={s.site_key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-1.5" style={{ backgroundColor: color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-slate-800" style={{ color }}>{s.site_name}</h3>
                      <p className="truncate text-xs text-slate-400">{s.company || ''}</p>
                    </div>
                    {isTop ? (
                      // มุมมองงานหลัก/หมวดงานหลักไม่มีวงแหวน มุมขวาบอกจำนวนรายการแทน
                      <div className="shrink-0 text-right" title={t('พนักงานทั้งหมดในหน่วยงาน')}>
                        <b className="text-xl" style={{ color }}>{s.entries}</b>
                        <div className="text-[10px] text-slate-400">{t('รายการ')}</div>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2"
                        title={`${t('ความสมบูรณ์ของการบันทึก (เฉพาะวันทำงานที่ผ่านมา) ใน')}${monthFull}`}>
                        <Ring pct={s.fillRate} color={color} />
                        <div className="text-[10px] leading-tight text-slate-400">
                          {t('บันทึกครบ')}<br />
                          <b className="text-xs text-slate-800">{s.entries} / {s.fillRateDenom || 0}</b><br />
                          {t('ช่อง')}
                        </div>
                      </div>
                    )}
                  </div>

                  {isTop ? (
                    <div className="mt-3">
                      <TopList items={mode === 'topcost' ? s.topCostCodes : s.topActivities} entries={s.entries} />
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2 border-y border-slate-100 py-2 text-center">
                        <div>
                          <div className="text-base font-bold text-slate-900">{s.n_emp}</div>
                          <div className="text-[10px] text-slate-400">{t('พนักงาน')}</div>
                          <div className="text-[9px] text-slate-300">{s.n_support} {t('สนับสนุน')} · {s.n_operation} {t('ปฏิบัติการ')}</div>
                        </div>
                        <div>
                          <div className="text-base font-bold text-slate-900">{s.entries}</div>
                          <div className="text-[10px] text-slate-400">{t('รายการใน')} {monthOnly}</div>
                        </div>
                        <div>
                          <div className="text-base font-bold text-slate-900">{started} / {s.n_emp}</div>
                          <div className="text-[10px] text-slate-400">{t('เริ่มบันทึกแล้ว')}</div>
                          <div className="text-[9px] text-slate-300">{t('พนักงานที่ลงอย่างน้อย 1 วัน')}</div>
                        </div>
                      </div>
                      <div className="mt-3"><MiniCal daysFilled={s.daysFilled} today={data.today} /></div>
                    </>
                  )}

                  {canEntry ? (
                    <button onClick={() => onOpenSite?.(s.site_key)}
                      className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: color }}>
                      {t('เปิดบันทึก')} <Icon name="arrowRight" className="inline h-4 w-4 align-[-3px]" />
                    </button>
                  ) : (
                    // ปุ่มที่กดแล้วไม่มีสิทธิ์ทำอะไรคือทางตัน — บอกไปเลยว่าต้องขอสิทธิ์จากใคร
                    <p className="mt-3 rounded-xl bg-slate-50 py-2 text-center text-[11px] text-slate-500">
                      {t('มุมมองอย่างเดียว — ติดต่อแอดมินเพื่อขอสิทธิ์บันทึก')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
