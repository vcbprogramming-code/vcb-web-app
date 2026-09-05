-- ═══════════════════════════════════════════════════════════════════════════
-- ทะเบียนประเภทวงเงิน 10 ประเภท ตามระบบจริงของลูกค้า
--
-- ของเราเก็บประเภทวงเงินเป็นข้อความอิสระ 5 แบบ ('L/G (BG)', 'LGM (L/G)', 'T/L',
-- 'B/E (AVAL)', 'P/N') ซึ่งเป็น "ชื่อกล่องบนหน้าจอ" ไม่ใช่ประเภทวงเงินจริง —
-- ธนาคารออกวงเงิน 10 ประเภท แล้วหน้าจอถึงค่อยพับรวมบางประเภทเป็นกล่องเดียว
--
-- ตารางนี้เก็บสองคอลัมน์ที่ดูซ้ำแต่ไม่ซ้ำกัน (เอกสารข้อกำหนดฟังก์ชัน §4.4):
--   kind     = ตระกูลของวงเงิน (LG / TL / AVAL / …)
--   doc_kind = ป้ายสั้นที่พิมพ์บนเอกสาร (BG / T/L / B/E / …)
-- แมปกันตรง ๆ ไม่ได้ (LG→BG, LGM→L/G, AVAL→B/E, PNPOST→PN-post) จึงเก็บทั้งคู่
-- ไว้ที่เดียว แทนที่จะให้ API หน้าจอ และรายงานทุกฉบับคำนวณซ้ำกันเอง
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists facility_types (
  no        smallint primary key,      -- เลขประเภทที่ facilities.facility_no อ้างถึง
  code      text not null unique,
  name_th   text not null,
  name_en   text,
  kind      text not null,             -- ตระกูล: LG · TL · LGM · AVAL · PN · ML · DLC · PNPOST
  doc_kind  text not null,             -- ป้ายบนเอกสาร: BG · T/L · L/G · B/E · P/N · M/L · DLC · PN-post
  is_active boolean not null default true,
  sort_order smallint
);

insert into facility_types (no, code, name_th, name_en, kind, doc_kind, sort_order) values
  ( 1, 'LG-CON',  'หนังสือค้ำประกันสัญญา 5%',              'Performance Guarantee (5%)',      'LG',     'BG',      1),
  ( 2, 'LG-ADV',  'หนังสือค้ำประกัน Advance 15%',          'Advance Payment Guarantee (15%)', 'LG',     'BG',      2),
  ( 3, 'LG-RET',  'หนังสือค้ำเงินประกันผลงาน',              'Retention Guarantee',             'LG',     'BG',      3),
  ( 4, 'TL',      'วงเงิน T/L (หักค่างาน)',                 'Term / Standby Loan',             'TL',     'T/L',     4),
  ( 5, 'LGM',     'L/G วัสดุ/สาธารณูปโภค',                  'L/G Materials / Utilities',       'LGM',    'L/G',     5),
  ( 6, 'AVAL',    'B/E รับรอง/อาวัลตั๋ว',                   'B/E / Aval',                      'AVAL',   'B/E',     6),
  ( 7, 'PN',      'P/N Against (ขายลดค่างาน)',              'Promissory Note (discounting)',   'PN',     'P/N',     7),
  ( 8, 'ML',      'วงเงิน M/L (เงินกู้)',                    'M/L Loan',                        'ML',     'M/L',     8),
  ( 9, 'DLC',     'วงเงิน DLC (เลตเตอร์ออฟเครดิตในประเทศ)',  'Domestic L/C (DLC)',              'DLC',    'DLC',     9),
  (10, 'PN-POST', 'P/N Post (เฉพาะ CVE)',                  'P/N Post-financing',              'PNPOST', 'PN-post', 10)
on conflict (no) do update set
  code = excluded.code, name_th = excluded.name_th, name_en = excluded.name_en,
  kind = excluded.kind, doc_kind = excluded.doc_kind, sort_order = excluded.sort_order;

-- facility_no เคยเป็นข้อความอิสระ ตอนนี้ชี้ไปที่ทะเบียนจริง
alter table facilities alter column facility_no type smallint using nullif(btrim(facility_no), '')::smallint;

comment on table facility_types is
  'ประเภทวงเงินสินเชื่อ 10 ประเภทตามที่ธนาคารออกให้ · หน้าจอพับบางประเภทรวมเป็นกล่องเดียว ดู FOLD ใน credit.routes.js';
