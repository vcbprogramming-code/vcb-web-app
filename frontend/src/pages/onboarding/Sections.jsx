import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { pick } from '../../lib/onboardingProgram.js';
import { useT } from '../../lib/i18n.jsx';
import { chrome } from '../../lib/onboardingChrome.js';
import ObImage, { ObAvatar } from './ObImage.jsx';
import OrgChart from './OrgChart.jsx';

/**
 * ตัววาด section ของหน้าเนื้อหาปฐมนิเทศ — แปดชนิดตามพอร์ทัลที่บริษัทใช้อยู่
 *
 * ต้นฉบับเป็น Apps Script ที่ต่อสตริง HTML แล้วยัดใส่ innerHTML ฝั่งเรารับมาเป็น
 * "ข้อมูล" (ob_sections.data) แล้ววาดด้วย React เอง — ไม่รับ HTML ดิบข้ามมา
 * เพราะนั่นคือการเปิดช่อง XSS ให้เนื้อหาในฐานข้อมูลโดยไม่จำเป็น
 *
 * ── เรื่องภาษา อ่านก่อนแก้ ──────────────────────────────────────────────────
 * เนื้อหาหน้าเหล่านี้ในระบบของลูกค้า **ไม่มีคำแปลไทย**: ชื่อคน 184 คนในผังองค์กร
 * ป้ายฝ่ายที่ไซต์งาน caption แกลเลอรี และชื่องานเลี้ยงบริษัท ล้วนเป็นอังกฤษใน
 * โหมดไทยของเขาเอง เราจึงคงอังกฤษไว้ตรงตัว ไม่แปลเพิ่ม — คำแปลที่เราคิดขึ้นเอง
 * คือข้อมูลที่ลูกค้าไม่ได้เขียนและตรวจไม่ได้
 *
 * ข้อความที่ *มี* คำแปลใน TH_DICT ของเขา มาจากเซิร์ฟเวอร์เป็นคู่ field (x / x_th)
 * แล้วเลือกด้วย pick() ตรงจุดที่วาด ส่วนคำ chrome ที่ตัววาดเป็นคนใส่เอง (Head
 * Office, Reports to, Led by, …) ผ่าน chrome() ใน lib/onboardingChrome.js —
 * คัดมาจาก TH_DICT ของเขาเท่าที่เขามี ที่เขาไม่มีก็เป็นอังกฤษเหมือนหน้าจอของเขา
 * จริง ไม่ใช่เราแปลให้
 *
 * คำที่เป็นของ *เรา* จริง ๆ (ป้าย aria ของคารูเซล ป้ายบอกว่าระยะยังล็อกอยู่)
 * ยังใช้ t() ตามระบบ i18n ของแอปเหมือนทุกหน้า และมีคำอังกฤษคู่ใน lib/en.js
 */

/** ย่อหน้าหลายย่อหน้า: body เป็นอาเรย์ คู่กับ body_th ที่ยาวเท่ากัน (ช่องว่าง = null) */
function Paragraphs({ lang, body, bodyTh, className = 'text-sm leading-relaxed text-slate-600' }) {
  const list = Array.isArray(body) ? body : body ? [body] : [];
  const th = Array.isArray(bodyTh) ? bodyTh : bodyTh ? [bodyTh] : [];
  return list.map((p, i) => <p key={i} className={className}>{pick(lang, p, th[i])}</p>);
}

/** หัว section — eyebrow / หัวข้อ / คำโปรย ชุดเดียวใช้ทุกชนิด */
function SectionHead({ lang, section }) {
  const d = section.data || {};
  const eyebrow = pick(lang, d.eyebrow, d.eyebrow_th);
  const heading = pick(lang, section.heading, section.heading_th);
  const sub = pick(lang, section.subheading, section.subheading_th);
  if (!eyebrow && !heading && !sub) return null;
  return (
    <div className="space-y-1">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-brand">{eyebrow}</p>}
      {heading && <h3 className="text-lg font-bold text-slate-800">{heading}</h3>}
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

/** ลิงก์ท้าย section — ไปหน้าอื่นในโปรแกรม หรือออกไปเอกสารภายนอก */
function SectionLink({ lang, link, onNavigate }) {
  const label = pick(lang, link.label, link.label_th);
  if (link.url) {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        {label} <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onNavigate?.(link.page)}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
      {label} <Icon name="arrowRight" className="h-3.5 w-3.5" />
    </button>
  );
}

// ── ข้อความ ────────────────────────────────────────────────────────────────
function TextSection({ lang, section, onNavigate }) {
  const d = section.data || {};
  return (
    <div className="card space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="space-y-2">
        <Paragraphs lang={lang} body={d.body} bodyTh={d.body_th} />
      </div>
      {Array.isArray(d.bullets) && d.bullets.length > 0 && (
        <ul className="space-y-1.5">
          {d.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <Icon name="check" className="mt-1 h-3 w-3 shrink-0 text-brand" />
              {pick(lang, b, d.bullets_th?.[i])}
            </li>
          ))}
        </ul>
      )}
      {d.footer && (
        <p className="border-t border-slate-100 pt-2 text-sm font-medium italic text-slate-500">
          {pick(lang, d.footer, d.footer_th)}
        </p>
      )}
      {/* รูปใน section ข้อความคือแผนภาพ (ผังกระบวนการ ERP) ไม่ใช่ภาพบรรยากาศ —
          ต้องเห็นครบทั้งผัง จึง contain ไม่ใช่ cover ที่ตัดขอบทิ้ง */}
      {d.image?.imageKey && (
        <ObImage imageKey={d.image.imageKey} alt={d.image.alt || ''}
          ratio="aspect-[16/10]" className="bg-white" fit="contain" />
      )}
      {d.link && <div><SectionLink lang={lang} link={d.link} onNavigate={onNavigate} /></div>}
    </div>
  );
}

// ── สารต้อนรับจากท่านกรรมการผู้จัดการ ───────────────────────────────────────
function QuoteSection({ lang, section }) {
  const d = section.data || {};
  return (
    <div className="card space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="flex items-start gap-4">
        {d.portrait?.imageKey && <ObAvatar imageKey={d.portrait.imageKey} alt={d.attribution || ''} size={64} />}
        <blockquote className="min-w-0 flex-1 border-l-4 border-brand/30 pl-4">
          <p className="italic text-slate-700">{pick(lang, d.quote, d.quote_th)}</p>
          <footer className="mt-2 text-sm font-medium text-slate-500">
            — {pick(lang, d.attribution, d.attribution_th)}
          </footer>
        </blockquote>
      </div>
    </div>
  );
}

// ── วัฒนธรรมและค่านิยม ──────────────────────────────────────────────────────
function ValuesSection({ lang, section }) {
  const d = section.data || {};
  return (
    <div className="space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(d.values || []).map((v) => (
          <div key={v.name} className="card space-y-2">
            <div className="flex items-center gap-3">
              {v.icon?.imageKey && <ObAvatar imageKey={v.icon.imageKey} alt={v.name} size={40} />}
              <h4 className="font-bold text-slate-800">{pick(lang, v.name, v.name_th)}</h4>
            </div>
            <p className="text-sm text-slate-600">{pick(lang, v.body, v.body_th)}</p>
            <ul className="space-y-1">
              {(v.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <Icon name="check" className="mt-1 h-3 w-3 shrink-0 text-brand" />
                  {pick(lang, b, v.bullets_th?.[i])}
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">
              {pick(lang, v.footer, v.footer_th)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── คารูเซล (ผลงานของเรา · งานเลี้ยงบริษัท) ─────────────────────────────────
/**
 * คารูเซลภาพ — เลื่อนเองทุก 5 วินาที และปัดเองได้
 *
 * ของเขาเป็น "ขบวนรถไฟ": แถบเดียวที่ translateX ไปเรื่อย ๆ โดยมีสำเนาสามใบแรก
 * ต่อท้ายไว้ให้วนได้ไม่มีรอยต่อ ทั้งหมดอยู่ในกรอบ overflow:hidden
 *
 * ของเราเปลี่ยนกลไกเป็น **กล่องที่เลื่อนได้จริง** (overflow-x + scroll-snap)
 * ไม่ใช่เพราะสวยกว่า แต่เพราะ translateX ในกรอบ hidden ทำให้สไลด์ที่ยังไม่ถึงคิว
 * มีตำแหน่งจริงอยู่นอกขอบจอ — บนจอโทรศัพท์ 390px ชุดตรวจจอเล็กของระบบจับได้ว่า
 * "มีของล้นออกนอกจอโดยไม่ได้ตั้งใจ" (img.h-full → 489px · 609px · 728px) เกณฑ์
 * ของชุดนั้นคือ ของที่กว้างเกินจอต้องเลื่อนอยู่ใน *กล่องของตัวเอง* ไม่ใช่ถูกตัดทิ้ง
 * เฉย ๆ ซึ่งตรงกับสิ่งที่ผู้ใช้มือถือคาดหวังจากแถบรูปอยู่แล้ว: ปัดดูได้ด้วยนิ้ว
 *
 * ผลพลอยได้: ไม่ต้องมีสไลด์สำเนาอีกต่อไป และจำนวนที่เห็นพร้อมกันยุบตามความกว้าง
 * จอได้ (1 ใบบนมือถือ · 2 บนแท็บเล็ต · 3 บนจอใหญ่) — สามใบบนจอ 390px คือรูป
 * กว้างใบละ 120px ซึ่งดูอะไรไม่ออก
 *
 * วนกลับไปใบแรกเมื่อถึงใบสุดท้าย (ของเขาวนโดยไม่มีรอยต่อ ของเราเลื่อนกลับให้เห็น)
 * หยุดเลื่อนอัตโนมัติเมื่อเมาส์อยู่บนกรอบ หรือเมื่อผู้ใช้กำลังปัดเอง
 */
const INTERVAL_MS = 5000;
function TrackRecordSection({ lang, section }) {
  const t = useT();
  const d = section.data || {};
  const slides = d.slides || [];
  const trackRef = useRef(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);

  /** เลื่อนให้สไลด์ลำดับ n มาอยู่ซ้ายสุดของกรอบ */
  const goTo = (n) => {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[n];
    if (!child) return;
    track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    setI(n);
  };
  const step = () => goTo((i + 1) % slides.length);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const id = setInterval(() => {
      if (paused.current) return;
      const track = trackRef.current;
      if (!track) return;
      // ถึงปลายแถบแล้ว (ใบท้าย ๆ โผล่ครบ) ก็วนกลับไปใบแรก ไม่ใช่ดันต่อจนชนขอบ
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      const next = atEnd ? 0 : (i + 1) % slides.length;
      goTo(next);
    }, INTERVAL_MS);
    return () => clearInterval(id);
    // goTo อ่าน i ปัจจุบันผ่าน closure — ผูก effect กับ i ไว้ให้ตรงกัน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slides.length]);

  if (!slides.length) return null;

  return (
    <div className="space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="relative" data-ob-carousel data-carousel-index={i}
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
        onTouchStart={() => { paused.current = true; }}>
        <div ref={trackRef}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden rounded-xl pb-1">
          {slides.map((s, idx) => (
            <div key={`${s.image?.imageKey}-${idx}`}
              className="w-[86%] shrink-0 snap-start sm:w-[48%] lg:w-[32%]">
              {/* eager ทุกใบ: ใบที่ยังไม่ถูกเลื่อนมาถึงอยู่นอกกรอบที่มองเห็น
                  IntersectionObserver จึงไม่ยิง — รอมันคือกรอบเทาค้างจนกว่าจะ
                  ปัดไปถึง ซึ่งเป็นภาพที่พนักงานอ่านว่า "รูปเสีย" */}
              <ObImage imageKey={s.image?.imageKey} alt={pick(lang, s.caption, s.caption_th) || ''}
                eager />
              {s.caption && (
                <div className="mt-1.5 text-center text-xs font-medium text-slate-500">
                  {pick(lang, s.caption, s.caption_th)}
                </div>
              )}
            </div>
          ))}
        </div>
        {slides.length > 1 && (
          <button type="button" onClick={step}
            aria-label={t('ภาพถัดไป')}
            data-ob-carousel-next
            className="absolute right-2 top-1/3 rounded-full bg-white/90 p-2 text-slate-600 shadow-md transition hover:bg-white hover:text-brand">
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── แกลเลอรี (ชีวิตในไซต์งาน) ───────────────────────────────────────────────
function GallerySection({ lang, section }) {
  const d = section.data || {};
  const images = d.images || [];
  return (
    <div className="card space-y-3">
      <SectionHead lang={lang} section={section} />
      {d.body && <p className="text-sm leading-relaxed text-slate-600">{pick(lang, d.body, d.body_th)}</p>}
      {images.length > 0 && (
        <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {images.map((im, i) => (
            <figure key={`${im.imageKey}-${i}`} className="space-y-1.5">
              <ObImage imageKey={im.imageKey}
                alt={pick(lang, im.caption, im.caption_th) || pick(lang, section.heading, section.heading_th) || ''} />
              {im.caption && (
                <figcaption className="text-center text-xs font-medium text-slate-500">
                  {pick(lang, im.caption, im.caption_th)}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// ── การ์ดสองใบท้ายหน้าจบ (รู้จักทีมของเรา / ชีวิตในไซต์งาน) ─────────────────
/**
 * externalCta ของ section นี้ชี้ไปยัง Apps Script deployment เดิมของลูกค้า
 *
 * ผู้เรียกที่รู้ว่าตัวเองมีปุ่มกลับพอร์ทัลอยู่แล้ว (หน้าจบ — ดู Completion.jsx)
 * ส่ง externalCta: false มาปิดมัน เพราะระบบเราคือสิ่งที่มาแทนพอร์ทัลนั้น การลอก
 * ลิงก์มาตรง ๆ คือพาพนักงานกลับไปหาระบบเก่า
 */
function FeatureGridSection({ lang, section, onNavigate, extraActions, externalCta = true }) {
  const d = section.data || {};
  const showCta = externalCta !== false && d.externalCta?.url;
  return (
    <div className="space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(d.features || []).map((f) => (
          <div key={f.title} className="card space-y-2">
            {f.image?.imageKey && <ObImage imageKey={f.image.imageKey} alt={f.image.alt || f.title} ratio="aspect-[16/9]" />}
            <h4 className="font-bold text-slate-800">{pick(lang, f.title, f.title_th)}</h4>
            <p className="text-sm text-slate-600">{pick(lang, f.body, f.body_th)}</p>
            {f.link && <SectionLink lang={lang} link={f.link} onNavigate={onNavigate} />}
          </div>
        ))}
      </div>
      {(showCta || extraActions) && (
        <div className="card flex flex-wrap items-center justify-center gap-3">
          {extraActions}
          {showCta && (
            <a href={d.externalCta.url} target="_blank" rel="noopener noreferrer" className="btn-outline">
              {chrome(lang, 'Return to VCB Portal')} <Icon name="arrowUpRight" className="h-4 w-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── การ์ดสามระยะในหน้าแนะนำแผนก ─────────────────────────────────────────────
function PhaseLinksSection({ lang, section, phaseState, onOpenPhase }) {
  const t = useT();
  const d = section.data || {};
  return (
    <div className="space-y-3">
      <SectionHead lang={lang} section={section} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(d.phases || []).map((p) => {
          const st = phaseState?.(p.page) || {};
          return (
            <button key={p.page} type="button" onClick={() => onOpenPhase?.(p.page)}
              className={`card flex items-center justify-between gap-2 text-left transition hover:border-brand/40 ${
                st.complete ? 'border-emerald-300 bg-emerald-50/40' : ''}`}>
              <span className="min-w-0 text-sm font-semibold text-slate-700">
                {pick(lang, p.label, p.label_th)}
              </span>
              {st.complete
                ? <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-500" />
                : st.locked
                  ? <Icon name="lock" className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-label={t('ยังล็อกอยู่')} />
                  : <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-slate-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * section หนึ่งอัน — เลือกตัววาดตามชนิด
 *
 * ชนิดที่ไม่รู้จักไม่วาดอะไรเลยและไม่ throw: เนื้อหามาจากฐานข้อมูล การเพิ่มชนิด
 * ใหม่เข้าไปวันหนึ่งต้องไม่ทำให้หน้าทั้งหน้าพัง (ErrorBoundary จะกินทั้งหน้า)
 */
export default function Section({ section, lang, ctx = {} }) {
  const common = { lang, section, ...ctx };
  switch (section.type) {
    case 'text': return <TextSection {...common} />;
    case 'quote': return <QuoteSection {...common} />;
    case 'values': return <ValuesSection {...common} />;
    case 'trackrecord': return <TrackRecordSection {...common} />;
    case 'gallery': return <GallerySection {...common} />;
    case 'featuregrid': return <FeatureGridSection {...common} />;
    case 'phaselinks': return <PhaseLinksSection {...common} />;
    case 'orgchart': return <OrgChart {...common} />;
    // 'deptgrid' ตั้งใจไม่มีที่นี่: การ์ดเลือกแผนกวาดโดย DepartmentPicker ใน
    // Program.jsx ซึ่งเป็นที่เดียวที่ถือประตูกั้น "เอกสารต้องครบก่อน" และรู้ว่า
    // แผนกไหนถูกเลือกอยู่ — ตัววาดที่สองสำหรับข้อมูลชุดเดียวกันคือสองพฤติกรรมที่
    // จะเพี้ยนจากกันวันหนึ่ง DepartmentPicker อ่าน deptgrid.depts ตรงจากที่นี่แล้ว
    default: return null;
  }
}
