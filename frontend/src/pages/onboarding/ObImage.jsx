import { useEffect, useRef, useState } from 'react';
import { programApi } from '../../lib/onboardingProgram.js';

/**
 * รูปในเนื้อหาปฐมนิเทศ — โหลดตอนเลื่อนมาถึง และจำไว้ไม่โหลดซ้ำ
 *
 * รูปอยู่ในที่เก็บไฟล์ของโครงการ เสิร์ฟผ่าน API ที่ต้องมี Bearer เหมือนโลโก้
 * บริษัทของ E-Memo (LogoThumb) — แท็ก <img> ส่ง header ไม่ได้ จึงต้องดึงเป็น
 * blob ก่อนทุกครั้ง (กับดักเดิมของโมดูลนี้: iframe/img ชี้ตรงไป API ใช้ได้ที่
 * เครื่องตัวเองแต่ขึ้นหน้าว่างบน production)
 *
 * สองอย่างที่ทำให้วิธีนี้ไม่ทำให้หน้าหนัก:
 *   1. CACHE ระดับโมดูล — คีย์เดียวโหลดครั้งเดียวต่อการเปิดแท็บ สลับหน้ากลับไป
 *      กลับมาไม่ยิงซ้ำ (blob URL ของเดิมยังใช้ได้ ไม่ revoke)
 *   2. IntersectionObserver — แกลเลอรี "ชีวิตในไซต์งาน" มี 12 รูป ~2.5 MB
 *      ถ้าดึงพร้อมกันหมดตอนเปิดหน้าคือรอเป็นสิบวินาทีก่อนเห็นรูปแรก
 *
 * ไม่ revoke blob URL ตอน unmount โดยตั้งใจ: URL นั้นอยู่ใน CACHE ที่คนอื่นใช้ร่วม
 * การ revoke จะทำให้รูปเดิมของหน้าถัดไปกลายเป็นรูปเสีย ซึ่งแพงกว่าหน่วยความจำ
 * ไม่กี่เมกะไบต์ที่ปล่อยไว้จนปิดแท็บ
 */
const CACHE = new Map();     // imageKey → blob URL
const INFLIGHT = new Map();  // imageKey → Promise<blob URL>

const load = (key) => {
  if (CACHE.has(key)) return Promise.resolve(CACHE.get(key));
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = programApi.imageUrl(key)
    .then((url) => { CACHE.set(key, url); INFLIGHT.delete(key); return url; })
    .catch((e) => { INFLIGHT.delete(key); throw e; });
  INFLIGHT.set(key, p);
  return p;
};

/**
 * fit="contain" สำหรับภาพที่เป็น "ข้อมูล" ไม่ใช่บรรยากาศ
 *
 * ผังกระบวนการ Mango Anywhere ERP ในหน้าแนะนำแผนกคือแผนภาพที่มีกล่องและลูกศร
 * ริมขอบทุกด้าน — object-cover ตัดคอลัมน์ขวาหายไปทั้งแถว (Project Management
 * กลายเป็น "Project Managemen") ซึ่งไม่ใช่แค่ดูไม่สวย แต่คือข้อมูลที่หายไปจาก
 * หน้าจอ ภาพถ่ายบรรยากาศใช้ cover ได้ตามเดิม เพราะการครอบไม่ได้ลบความหมายอะไร
 */
export default function ObImage({
  imageKey, alt = '', className = '', ratio = 'aspect-[4/3]', eager = false, fit = 'cover',
}) {
  const [url, setUrl] = useState(() => (imageKey ? CACHE.get(imageKey) || null : null));
  const [failed, setFailed] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!imageKey) return undefined;
    const cached = CACHE.get(imageKey);
    if (cached) { setUrl(cached); return undefined; }
    setUrl(null);
    setFailed(false);
    let alive = true;
    const fetchIt = () => load(imageKey)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setFailed(true); });

    // เบราว์เซอร์เก่า/สภาพแวดล้อมทดสอบที่ไม่มี IntersectionObserver ต้องได้รูป
    // เหมือนกัน ไม่ใช่ช่องว่างถาวร — ถอยไปโหลดทันที
    //
    // INFLIGHT ก็นับเป็น "โหลดทันที" ด้วย: คารูเซลวาดสำเนาสามใบแรกต่อท้ายขบวน
    // (กลไกวงกลมของเขา) สำเนาพวกนั้นอยู่นอกกรอบ overflow-hidden จึงไม่มีทาง
    // intersect เลยแม้เลื่อนจนสุดหน้า — รอ observer คือกรอบเทาค้างถาวร ทั้งที่
    // ไฟล์กำลังโหลดอยู่แล้วให้ใบจริงในจังหวะเดียวกัน
    if (eager || INFLIGHT.has(imageKey) || typeof IntersectionObserver === 'undefined' || !boxRef.current) {
      fetchIt();
      return () => { alive = false; };
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fetchIt(); }
    }, { rootMargin: '300px' });
    io.observe(boxRef.current);
    return () => { alive = false; io.disconnect(); };
  }, [imageKey, eager]);

  if (!imageKey) return null;
  return (
    <div ref={boxRef}
      className={`relative overflow-hidden rounded-xl bg-slate-100 ${ratio} ${className}`}
      data-ob-image={imageKey}
      data-ob-image-state={failed ? 'failed' : url ? 'loaded' : 'pending'}>
      {url
        ? <img src={url} alt={alt}
          className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`} />
        : <span className={`absolute inset-0 ${failed ? '' : 'animate-pulse bg-slate-200/70'}`} />}
    </div>
  );
}

/** ไอคอนค่านิยม/รูปพอร์เทรต — กลม ขนาดเล็ก ไม่ใช่รูปเต็มกรอบ */
export function ObAvatar({ imageKey, alt = '', size = 56 }) {
  const [url, setUrl] = useState(() => (imageKey ? CACHE.get(imageKey) || null : null));
  useEffect(() => {
    if (!imageKey) return undefined;
    let alive = true;
    load(imageKey).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [imageKey]);
  if (!imageKey) return null;
  return (
    <span className="inline-block shrink-0 overflow-hidden rounded-full bg-slate-100 align-middle"
      style={{ width: size, height: size }}
      data-ob-image={imageKey} data-ob-image-state={url ? 'loaded' : 'pending'}>
      {url ? <img src={url} alt={alt} className="h-full w-full object-cover" /> : null}
    </span>
  );
}
