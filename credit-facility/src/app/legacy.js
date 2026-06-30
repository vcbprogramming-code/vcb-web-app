var D=null, VIEW='fac', editId=null, kindFilter='';
var _cardsLastHtml='';  // fingerprint: skip cards innerHTML swap when unchanged
// Direct setter (used by the settings modal's checkbox).
function setDark(on){
  document.body.classList.toggle('dark',!!on);
  try{localStorage.setItem('vcb-dark',on?'1':'0');}catch(e){}
}
// Apply persisted dark-mode preference as early as possible.
(function(){try{if(localStorage.getItem('vcb-dark')==='1') document.body.classList.add('dark');}catch(e){}})();
// ---------- Language (i18n) ----------
// Thai<->English UI translation done at the DOM level: only rendered text and
// a couple of attributes (placeholder/title) are rewritten, never the data or
// JS logic — so status comparisons, label-matching and stored values keep
// running on Thai internally. A node is translated only if EVERY Thai run in it
// resolves to a known phrase (the "leftover Thai" guard below), so free-text
// user data (company/beneficiary names, descriptions) is never corrupted.
var LANG='th'; try{LANG=localStorage.getItem('vcb-lang')||'th';}catch(e){}
// Exact whole-node dictionary (standalone UI strings). Where a Thai word is
// overloaded, the value reflects its most common standalone use.
var I18N_DICT={
 'กลุ่มวิจิตรภัณฑ์ก่อสร้าง · ติดตามวงเงินสินเชื่อทุกโครงการ':'Vichitphan Construction Group · Track credit facilities across all projects',
 'ตั้งค่า':'Settings','ผู้บริหาร':'Manager','ยังไม่ระบุผู้ใช้':'No user identified',
 'แดชบอร์ด':'Dashboard','ผู้เยี่ยมชม':'Guest','🔑 เข้าสู่ระบบด้วย Google':'🔑 Sign in with Google',
 'วงเงิน':'Limit','สินเชื่อ (Facilities)':'Facilities','รายการ':'Items',
 'สินเชื่อ (Credit Ledger)':'Credit Ledger','วางแผน':'Planning','สินเชื่อ (T-bar)':'Cash Plan (T-bar)',
 'บริษัท':'Company','ทุกบริษัท':'All companies','ประเภทวงเงิน':'Facility type','ทุกประเภท':'All types',
 'โครงการ':'Project','ทุกโครงการ':'All projects','ระยะเวลา':'Time period','ทุกระยะเวลา':'All periods',
 'ครบใน 7 วัน':'Due within 7 days','เดือนนี้':'This month','เดือนหน้า':'Next month','เกินกำหนด':'Overdue',
 'สถานะ':'Status','ทุกสถานะ':'All statuses','คำขอใหม่':'New','อยู่ระหว่างเสนออนุมัติ':'Pending approval',
 'อนุมัติแล้ว':'Approved','ชำระแล้ว':'Settled','🔍 ค้นหา…':'🔍 Search…',
 'ค้นหา รหัส / รายละเอียด / ผู้รับเงิน':'Search by code / details / payee',
 '＋ เพิ่มคำขอสินเชื่อ':'＋ Add credit request','＋ บันทึกการใช้วงเงิน':'＋ Record facility usage',
 'กำลังโหลดข้อมูล…':'Loading data…',
 'เพิ่มคำขอสินเชื่อ':'Add credit request','ประเภทสินเชื่อ':'Credit type','จำนวนเงิน (บาท)':'Amount (THB)',
 '— เลือกบริษัท —':'— Select company —','— เลือกโครงการ —':'— Select project —','— เลือกประเภท —':'— Select type —',
 'วันที่เริ่ม':'Start date','จำนวนวัน':'Days','เช่น 120':'e.g. 120','วันครบกำหนด':'Due date',
 'ผู้รับผลประโยชน์':'Beneficiary','เช่น บริษัท สิริวัฒน์ ค้าเหล็ก จำกัด':'e.g. Siriwat Steel Trading Co., Ltd.',
 'เลขที่เอกสารอ้างอิง':'Reference doc no.','เช่น PO:20260000170 / BT-001/69':'e.g. PO:20260000170 / BT-001/69',
 'วันที่เอกสารอ้างอิง (ช่วง)':'Reference doc date (range)','dd/mm/yyyy — ถึง':'dd/mm/yyyy — to',
 'เอกสารแนบ & สถานะ':'Attachment & status','เอกสารแนบ (อีเมล / แหล่งที่มา)':'Attachment (email / source)',
 'เช่น อีเมล จาก คุณ… / แหล่งที่มา':'e.g. email from… / source','หมวดค่าใช้จ่าย':'Cost category',
 'เช่น ทราย / ค่าแรง / คอนกรีต':'e.g. sand / labor / concrete','วันที่เอกสารแนบ (ช่วง)':'Attachment date (range)',
 'สว่าง':'Light','มืด':'Dark','ค้นหา…':'Search…','กลับไปหน้าหลัก VCB Connect':'Back to VCB Connect home',
 '🔵 คำขอใหม่':'🔵 New','🟡 อยู่ระหว่างเสนออนุมัติ':'🟡 Pending approval','🟢 อนุมัติแล้ว':'🟢 Approved',
 '✅ ชำระแล้ว (ปิดรายการ)':'✅ Settled (closed)','หมายเหตุ':'Note','รายละเอียดเพิ่มเติม…':'Additional details…',
 'ยกเลิก':'Cancel','💾 บันทึก':'💾 Save',
 'รายละเอียดรายการสินเชื่อ':'Credit item details','🗑 ลบ':'🗑 Delete','✏️ แก้ไข':'✏️ Edit',
 'วันที่ขอ':'Request date','จำนวนเงิน':'Amount','ชำระเมื่อ':'Settled on',
 'บันทึกการใช้วงเงิน':'Record facility usage',
 'จำนวนเงิน (บาท) — ใส่ค่าลบเมื่อปลด/คืนวงเงิน':'Amount (THB) — enter a negative value to release/return the facility',
 'เลขที่อ้างอิง':'Reference no.','เช่น BT-001/69':'e.g. BT-001/69','รายละเอียด / คู่ค้า':'Details / counterparty',
 'ยืนยัน':'Confirm','ตกลง':'OK',
 'ตั้งค่า / Settings':'Settings','การแสดงผล / Display':'Display','โหมดสี / Theme':'Theme',
 '☀ สว่าง':'☀ Light','🌙 มืด':'🌙 Dark','ภาษา / Language':'Language','ไทย':'Thai',
 'แดชบอร์ด / Dashboard':'Dashboard','วงเงินสินเชื่อ / Credit lines':'Credit lines',
 'เลือกพาเนลที่ต้องการแสดงบนแดชบอร์ด · Choose which panels to show':'Choose which panels to show on the dashboard',
 'ส่วนกลาง':'Non-project','(รวม DLC)':'(incl. DLC)',
 'ครบกำหนด / Due dates':'Due dates','สถานะ / Status':'Status',
 'ภายใน 1 สัปดาห์':'Within 1 week','เสนออนุมัติ':'Proposed',
 'หมวดค่าใช้จ่าย / Cost categories':'Cost categories',
 'ลำดับในรายการ = ลำดับที่แสดงในเมนู · กด ▲▼ เพื่อย้าย · กด × เพื่อลบ':'List order = display order in the menu · Use ▲▼ to reorder · Use × to delete',
 'พิมพ์ชื่อหมวดใหม่…':'Type a new category name…','＋ เพิ่มหมวด':'＋ Add category','ปิด':'Close',
 'ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย':'No categories yet — add your first one',
 'ย้ายขึ้น':'Move up','ย้ายลง':'Move down','ลบ':'Delete','⟳ กำลังบันทึก…':'⟳ Saving…',
 'กำลังบันทึก…':'Saving…','บันทึกไม่สำเร็จ':'Save failed',
 'ตั้งงบหมวดค่าใช้จ่าย':'Set cost-category budget','งบประมาณ (บาท)':'Budget (THB)',
 '— เว้นว่างเพื่อยกเลิกงบ':'— leave blank to remove the budget','หมายเหตุ (ที่มา / cashflow)':'Note (source / cashflow)',
 '— ไม่บังคับ':'— optional','เช่น cashflow ที่ส่งธนาคารตอนขอวงเงิน':'e.g. cashflow submitted to the bank when applying for the facility',
 'ปรับวงเงิน / ใช้ไป':'Adjust limit / used','วงเงิน (บาท)':'Limit (THB)','ใช้ไป (บาท)':'Used (THB)',
 '— เว้นว่างเพื่อใช้ค่าที่คำนวณอัตโนมัติจากรายการ':'— leave blank to use the value auto-calculated from the items',
 'ไม่มีข้อมูลวงเงินตามเงื่อนไข':'No facilities match the filters','ประเภท':'Type','ใช้ไป':'Used',
 'คงเหลือ':'Remaining','การใช้':'Utilization','ตั้งเอง (override) — ไม่ได้คำนวณจากรายการ':'Manual override — not calculated from items',
 'จำนวน (บาท)':'Amount (THB)','ครบกำหนด':'Due','รายละเอียด':'Details','เอกสารแนบ':'Attachment',
 'ยังไม่มีคำขอสินเชื่อ':'No credit requests yet','↳ บันทึกใช้วงเงินแล้ว':'↳ Facility usage recorded',
 'ดู':'View','แก้ไข':'Edit','วันที่':'Date','เลขที่เอกสาร':'Document no.',
 'รายละเอียด / ผู้รับผลประโยชน์':'Details / beneficiary','เริ่ม':'Start','ครบ':'Due','ไม่มีรายการเคลื่อนไหว':'No transactions',
 'ครบกำหนดเดือนนี้':'Due this month','ครบกำหนดเดือนหน้า':'Due next month',
 'วงเงินสินเชื่อ':'Credit Facilities','สถานะคำขอ':'Request status','สถานะ & ครบกำหนด':'Status & due dates',
 '— ไม่มีข้อมูล':'— No data','ครบกำหนด — เดือนนี้':'Due — this month','ครบกำหนด — เดือนหน้า':'Due — next month',
 'ใหม่ / เสนอ / อนุมัติ':'New / Proposed / Approved','ดูรายการ →':'View list →',
 'ใหม่':'New','เสนอ':'Proposed','อนุมัติ':'Approved',
 'ดูรายการครบกำหนดใน 7 วัน':'View items due within 7 days','ดูรายการครบกำหนดเดือนนี้':'View items due this month',
 'ดูรายการครบกำหนดเดือนหน้า':'View items due next month','ดูรายการสินเชื่อทั้งหมด':'View all credit items',
 'ดูรายละเอียดวงเงิน B/E (รวม L/G วัสดุ/สาธารณูปโภค)':'View B/E facility details (incl. L/G materials/utilities)',
 'ค้ำสัญญา 5%':'Contract guarantee 5%','ค้ำ Advance 15%':'Advance guarantee 15%','ค้ำประกันผลงาน':'Performance guarantee',
 'แผนการเงิน':'Cash plan','กำลังโหลด':'Loading','＋ เพิ่มส่วน':'＋ Add section','คัดลอกจากเดือนก่อน':'Copy from previous month',
 'ไม่มีรายการครบกำหนดในเดือนนี้':'No items due this month','ไม่ชำระงวดนี้':"Don't pay this period",
 'ตัดออกจากส่วนนี้':'Remove from this section','ลบส่วนนี้':'Delete this section','ลบส่วนนี้?':'Delete this section?',
 'ยอด P/N':'P/N amount','วัน':'Days','ดอกเบี้ย':'Interest','รวมดอกเบี้ย':'Total interest','เลขที่':'No.',
 'จำนวน':'Amount','รวม':'Total','รับเงินค่างานสุทธิ':'Net work payment received','ค่างาน':'Work value',
 'เริ่มต้น':'Start','รวมรับ':'Total in','รวมจ่าย':'Total out','ขอเบิก P/N':'Draw P/N',
 'รับเงินค่างาน + หักหนี้':'Receive work payment + deduct debt','ขอออก Aval จัดสรร':'Issue allocated Aval',
 'งวดผสม':'Mixed period','วันที่ส่งงาน':'Work-submission date','— เลือกโครงการเพื่อโหลดรายการ —':'— Select a project to load items —',
 'ทุกโครงการมีแผนในเดือนนี้แล้ว':'All projects already have a plan this month','ทุกโครงการมีแผนแล้ว':'All projects already have a plan',
 'เลือกโครงการเพื่อสร้างแผน 3 ส่วน พร้อม B/E + P/N ที่ครบกำหนดเดือนนี้':'Select a project to create a 3-section plan with B/E + P/N items due this month',
 'หัก TL':'Deduct TL','หัก ML':'Deduct ML','หัก PN':'Deduct PN','หัก PN ขอเบิกใหม่':'Deduct PN (new draw)','หัก Segment CVE':'Deduct Segment CVE',
 '(auto จาก P/N แถว "ค่างานรับสุทธิ" เท่านั้น)':'(auto from the P/N "net work payment" row only)',
 'เลือกรายการที่จะเพิ่มเข้าส่วนนี้':'Select items to add to this section','ไม่มีรายการที่ยังไม่ถูกจัดเข้าส่วนใด':'No unallocated items remaining',
 'ไม่พบส่วนปลายทาง':'Destination section not found','ล่วงหน้า (ยังไม่ครบ — ชำระก่อน)':'Advance (not yet due — pay early)',
 'เลือกโครงการที่จะเพิ่มเข้าแผน':'Select a project to add to the plan','โครงการทั้งหมดมีแผนเดือนนี้แล้ว':'All projects already have a plan this month',
 'ใส่ได้สูงสุด 5 ส่วนต่อเดือน':'Maximum of 5 sections per month','กำลังเพิ่มส่วน…':'Adding section…','เพิ่มส่วนแล้ว':'Section added',
 'เบิก P/N เข้าโครงการ จากค่างาน/เงินประกัน/ผลงานแล้วเสร็จ':'Draw P/N into the project from work payment / retention / completed work',
 'รับชำระค่างาน หักด้วย TL / ML / PN / Segment':'Receive work payment, deduct TL / ML / PN / Segment',
 'ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ':'Issue Aval (B/E) to pay vendors/materials','＋ เพิ่มโครงการ —':'＋ Add project —',
 '(ไม่ระบุหมวด)':'(No category)','✓ ในงบ':'✓ Within budget','— ไม่ได้ตั้ง':'— Not set',
 '— ยังไม่มีงบที่ตั้งไว้ในโครงการนี้ —':'— No budget set for this project yet —','# รายการ':'# items',
 'งบประมาณ':'Budget','% ใช้':'% used','ตั้ง/แก้ไขงบประมาณ':'Set / edit budget','สรุปหมวดค่าใช้จ่าย':'Cost-category summary',
 'รายการกลุ่มนี้ยังไม่ได้ระบุหมวด — แก้คำขอให้กรอกหมวดก่อน แล้วค่อยตั้งงบ':'This group has no category — edit the requests to add a category first, then set a budget',
 'ส่งออกไฟล์ Excel ตามตัวกรองปัจจุบัน?':'Export an Excel file using the current filters?','กำลังสร้างไฟล์…':'Generating file…',
 '📥 ส่งออก':'📥 Export','ดาวน์โหลดไฟล์ Excel แล้ว':'Excel file downloaded',
 'แก้ไขคำขอ':'Edit request','กรอกข้อมูลที่จำเป็น (*) ให้ครบ':'Please fill in all required (*) fields',
 'วันที่เอกสารแนบต้องเป็นรูปแบบ dd/mm/yyyy':'Attachment date must be in dd/mm/yyyy format',
 'วันที่เอกสารอ้างอิงต้องเป็นรูปแบบ dd/mm/yyyy':'Reference doc date must be in dd/mm/yyyy format',
 'แก้ไขคำขอแล้ว':'Request updated','บันทึกคำขอแล้ว':'Request saved',
 'ยืนยันอนุมัติรายการนี้? วงเงินจะถูกนับเป็นใช้ไปและดอกเบี้ยจะเริ่มเดิน':'Confirm approval of this item? The amount will count as used and interest will start accruing',
 'ลบรายการนี้? วงเงินที่ใช้ไปจะถูกปล่อยคืน':'Delete this item? The used amount will be released',
 'ลบรายการแล้ว':'Item deleted','บันทึกรายการแล้ว':'Transaction saved',
 'ยืนยันชำระ/ปิดรายการนี้? วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน':'Confirm settling/closing this item? The facility will be released and interest will stop accruing',
 'ปิดรายการแล้ว':'Item closed','ชำระ':'Settle','บันทึก':'Save','กรอกวงเงินให้ถูกต้อง':'Enter a valid limit',
 'กรอกยอดใช้ไปให้ถูกต้อง':'Enter a valid used amount','กรอกงบให้ถูกต้อง':'Enter a valid budget',
 'ปรับเรียบร้อย':'Adjusted successfully','ปรับ':'Adjust','ตั้งงบแล้ว':'Budget set','ยกเลิกงบแล้ว':'Budget removed',
 'ไม่สำเร็จ':'Failed','ระบุอัตราไม่ได้':'Rate unavailable',
 'อัตราดอกเบี้ยของวงเงินนี้ไม่ได้ระบุเป็นตัวเลข (เช่น MLR)':"This facility's interest rate is not given as a number (e.g. MLR)",
 'บันทึกการตั้งค่าแล้ว':'Settings saved','ไม่มีข้อมูลวงเงินคงเหลือสำหรับโครงการ/ประเภทนี้':'No remaining-facility data for this project/type',
 '— ไม่มีรายการที่ตรง — ใช้คำที่พิมพ์เอง':'— No matches — use the typed text'
};
// Fragment overrides (for Thai glued to numbers/data). Applied longest-first
// only when the whole-node lookup misses; values here win over I18N_DICT for
// the in-sentence sense of a word (e.g. รายการ = "items" in "5 รายการ").
var I18N_EXTRA={
 'รายการ':'items','บาท':'THB','ใช้ไปแล้ว':'Used','คงเหลือใช้ได้':'Available','คงเหลือ':'remaining',
 'ดูรายละเอียดวงเงิน':'View facility details:','แสดงเฉพาะ:':'Showing only:','รวมยอดค้างชำระ':'Total outstanding',
 'เกินกำหนดค้าง':'overdue outstanding','เกินวงเงินคงเหลือ':'Exceeds remaining facility','เกินวงเงิน':'Over limit',
 'หลังคำขอนี้เหลือ':'after this request','หลังคำขอนี้':'after this request','ใช้ไป':'used','ใช้':'used',
 'งวดที่':'Period','ย้ายไปส่วน':'Move to section','มีอยู่ในแผนเดือนนี้แล้ว':'already has a plan this month',
 'มีอยู่ในแผนแล้ว':'is already in the plan','มีอยู่ในแผน':'is already in the plan','เพิ่มโครงการ':'Added project:',
 'โครงการ':'Project','ผิดพลาด:':'Error:','บันทึกไม่สำเร็จ:':'Save failed:','บันทึกไม่สำเร็จ':'Save failed',
 'ลบไม่สำเร็จ:':'Delete failed:','เพิ่มไม่สำเร็จ:':'Add failed:','ส่งออกไม่สำเร็จ:':'Export failed:',
 'โหลดข้อมูลไม่สำเร็จ:':'Failed to load data:','โหลดแผนไม่สำเร็จ:':'Failed to load plan:',
 'โหลดข้อมูลล่าสุดไม่สำเร็จ — แสดงข้อมูลจากแคช':'Failed to load latest data — showing cached',
 'ไม่สำเร็จ:':'failed:','ไม่สำเร็จ':'failed','แก้ไข':'Edited','อยู่แล้ว':'already exists','มีหมวด':'Category',
 'หมวด':'Category','เกินงบ':'over budget','ใกล้เต็มงบ':'near budget limit','ใกล้เต็ม':'near full',
 'ยังไม่ตั้งงบ':'no budget set','คำนวณอัตโนมัติ:':'Auto-calculated:','วัน':'days','ปี':'yr','ถึง':'to',
 'ยืนยัน':'Confirm','คำขอนี้?':'this request?','(ประมาณ)':'(est.)','เงินประกันผลงาน':'Performance retention',
 'ค่างานรับสุทธิ':'Net work payment received','ผลงานแล้วเสร็จ ณ':'Completed work as of','งวด':'period',
 'กำลังเพิ่มโครงการ':'Adding project','โปรดรอสักครู่':'please wait',
 'เปลี่ยนโครงการ — เก็บโครงสร้าง 3 ส่วน แต่เปลี่ยนชื่อโครงการ':'Change project — keep the 3-section structure but change the project',
 'ยังไม่มีส่วน — กด':'No sections yet — press','เพื่อเริ่ม':'to start','ไม่มีรายการในส่วนนี้':'No items in this section',
 '— กด ＋ เพิ่ม':' — press ＋ Add','ไม่พบแผนเดือนก่อนของ':'No previous-month plan found for',
 'เลือกประเภทงวดสำหรับ':'Select period type for','เลือกโครงการเพื่อโหลดรายการ':'Select a project to load items',
 'รวมทุกโครงการ · รับ':'All projects · in','จ่าย':'out','รับ':'in','เพิ่ม':'Add','แล้ว':'',
 'แสดง':'Showing'
};
var _i18nMap={}; (function(){var k; for(k in I18N_DICT)_i18nMap[k]=I18N_DICT[k]; for(k in I18N_EXTRA)_i18nMap[k]=I18N_EXTRA[k];})();
var _i18nFrags=Object.keys(_i18nMap).sort(function(a,b){return b.length-a.length;});
// Thai letters/vowels/tones only — deliberately excludes ฿ (U+0E3F, the baht
// sign) and Thai digits so money strings like "฿1,234" don't read as leftover
// untranslated Thai and block a translation.
var _THAI=/[ก-ฺเ-๎]/;
// Return the English form of a string, or null to leave it untouched.
function _trStr(s){
  if(!s||!_THAI.test(s))return null;
  var key=s.replace(/^\s+|\s+$/g,'');
  if(I18N_DICT[key]!==undefined)return s.replace(key,I18N_DICT[key]);
  var out=s,i;
  for(i=0;i<_i18nFrags.length;i++){var f=_i18nFrags[i]; if(out.indexOf(f)>=0)out=out.split(f).join(_i18nMap[f]);}
  if(_THAI.test(out))return null;   // leftover Thai = unknown/data -> don't translate
  return out===s?null:out;
}
function _trText(t){
  if(LANG!=='en')return;
  var p=t.parentNode; if(p){var nn=p.nodeName; if(nn==='SCRIPT'||nn==='STYLE'||nn==='TEXTAREA')return;}
  var nv=_trStr(t.nodeValue);
  if(nv!=null){ if(t.__th===undefined)t.__th=t.nodeValue; t.nodeValue=nv; }
}
function _trAttr(el,a,k){
  if(!el.getAttribute)return; var v=el.getAttribute(a); if(!v)return;
  var nv=_trStr(v); if(nv!=null){ if(el[k]===undefined)el[k]=v; el.setAttribute(a,nv); }
}
function _i18nSweep(root){
  if(LANG!=='en'||!root)return;
  if(root.nodeType===3){_trText(root);return;}
  if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false),n,list=[];
  while(n=w.nextNode())list.push(n);
  for(var i=0;i<list.length;i++)_trText(list[i]);
  if(root.nodeType===1){_trAttr(root,'placeholder','__thPh');_trAttr(root,'title','__thTi');}
  var els=root.querySelectorAll?root.querySelectorAll('[placeholder],[title]'):[];
  for(var j=0;j<els.length;j++){_trAttr(els[j],'placeholder','__thPh');_trAttr(els[j],'title','__thTi');}
}
function _i18nRestore(root){
  if(!root)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null,false),n;
  while(n=w.nextNode()){if(n.__th!==undefined)n.nodeValue=n.__th;}
  var els=root.querySelectorAll?root.querySelectorAll('[placeholder],[title]'):[];
  for(var j=0;j<els.length;j++){var e=els[j]; if(e.__thPh!==undefined)e.setAttribute('placeholder',e.__thPh); if(e.__thTi!==undefined)e.setAttribute('title',e.__thTi);}
}
var _i18nObs=null;
function _i18nStart(){
  if(typeof MutationObserver!=='undefined'&&!_i18nObs){
    _i18nObs=new MutationObserver(function(muts){
      if(LANG!=='en')return;
      for(var i=0;i<muts.length;i++){var m=muts[i];
        if(m.type==='characterData'){_trText(m.target);}
        else{for(var j=0;j<m.addedNodes.length;j++)_i18nSweep(m.addedNodes[j]);}
      }
    });
    _i18nObs.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(LANG==='en')_i18nSweep(document.body);
}
function setLang(v){
  v=(v==='en')?'en':'th';
  try{localStorage.setItem('vcb-lang',v);}catch(e){}
  LANG=v;
  document.documentElement.setAttribute('lang',v);
  if(v==='en')_i18nSweep(document.body); else _i18nRestore(document.body);
}
// Translate static chrome now (if EN) and watch for dynamically rendered nodes.
_i18nStart();
// Dashboard layout preferences (saved to localStorage, applied live by
// re-rendering the overview cards). Every panel is individually toggleable:
//   lines  — credit-line panels: tl, bg, ml (long-term) · be, pn (revolving)
//            (DLC is folded into B/E, so it has no panel of its own; ส่วนกลาง is
//             a project-level scope, not a credit line — it lives in the project filter)
//   due    — ครบกำหนด panels: week (ภายใน 1 สัปดาห์), this (เดือนนี้), next (เดือนหน้า)
//   status — สถานะ panels: new (คำขอใหม่), proposed (เสนออนุมัติ), approved (อนุมัติ)
// All default ON, so the full layout is the default; a section disappears when
// all of its panels are switched off.
var DASH_LINE_KEYS=['tl','bg','ml','be','pn'];
var DASH_DUE_KEYS=['week','this','next'];
var DASH_STATUS_KEYS=['new','proposed','approved'];
function getDashPrefs(){
  var def={
    lines:{tl:true,bg:true,ml:false,be:true,pn:true},
    due:{week:false,this:true,next:true},
    status:{new:false,proposed:true,approved:true}
  };
  try{
    var raw=localStorage.getItem('vcb-dashprefs'); if(!raw) return def;
    var p=JSON.parse(raw)||{};
    return {
      lines:Object.assign({},def.lines,p.lines||{}),
      due:Object.assign({},def.due,p.due||{}),
      status:Object.assign({},def.status,p.status||{})
    };
  }catch(e){return def;}
}
function saveDashPrefs(p){
  try{localStorage.setItem('vcb-dashprefs',JSON.stringify(p));}catch(e){}
  if(D) cards();
}
function setDashLine(key,on){var p=getDashPrefs(); p.lines[key]=!!on; saveDashPrefs(p);}
function setDuePanel(key,on){var p=getDashPrefs(); p.due[key]=!!on; saveDashPrefs(p);}
function setStatusPanel(key,on){var p=getDashPrefs(); p.status[key]=!!on; saveDashPrefs(p);}
// Refresh the segmented light/dark button on/off classes.
function _segDarkSync(){
  var darkOn=document.body.classList.contains('dark');
  var l=document.getElementById('segLight'), d=document.getElementById('segDark');
  if(l) l.classList.toggle('on',!darkOn);
  if(d) d.classList.toggle('on',darkOn);
}
// Wrap setDark so the segmented buttons stay in sync.
(function(){var _orig=setDark; setDark=function(on){_orig(on); _segDarkSync();};})();
// Settings-modal scratch state for the category editor.
var _settingsCats=[];
function renderSettingsCats(){
  var box=document.getElementById('setCatList'); if(!box) return;
  if(!_settingsCats.length){ box.innerHTML='<div class="muted" style="grid-column:1/-1;padding:8px 4px;font-size:12px">ยังไม่มีหมวด — เพิ่มหมวดแรกได้เลย</div>'; return; }
  var h=''; for(var i=0;i<_settingsCats.length;i++){
    var nm=String(_settingsCats[i]).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
    h+='<div class="catrow"><span class="ord">'+(i+1)+'.</span><span class="nm" title="'+nm+'">'+nm+'</span>'
      +'<button type="button" class="miniBtn" onclick="catMove('+i+',-1)" '+(i===0?'disabled':'')+' title="ย้ายขึ้น">▲</button>'
      +'<button type="button" class="miniBtn" onclick="catMove('+i+',1)" '+(i===_settingsCats.length-1?'disabled':'')+' title="ย้ายลง">▼</button>'
      +'<button type="button" class="miniBtn del" onclick="catRemove('+i+')" title="ลบ">×</button>'
      +'</div>';
  }
  box.innerHTML=h;
}
function catAdd(){
  var inp=document.getElementById('setCatNew'); if(!inp) return;
  var nm=String(inp.value||'').trim(); if(!nm) return;
  // Avoid duplicates (case-sensitive — names are short Thai labels).
  for(var i=0;i<_settingsCats.length;i++) if(_settingsCats[i]===nm){ toast('มีหมวด "'+nm+'" อยู่แล้ว'); return; }
  _settingsCats.push(nm); inp.value=''; renderSettingsCats();
}
function catRemove(i){
  if(i<0||i>=_settingsCats.length) return;
  _settingsCats.splice(i,1); renderSettingsCats();
}
function catMove(i,dir){
  var j=i+dir; if(j<0||j>=_settingsCats.length) return;
  var t=_settingsCats[i]; _settingsCats[i]=_settingsCats[j]; _settingsCats[j]=t;
  renderSettingsCats();
}
// Open the settings modal: pre-fill all controls from current state.
function openSettings(){
  _segDarkSync();
  var lang='th';try{lang=localStorage.getItem('vcb-lang')||'th';}catch(e){}
  document.getElementById('setLang').value=lang;
  // Dashboard prefs: individual show/hide checkboxes for every panel.
  var dp=getDashPrefs();
  DASH_LINE_KEYS.forEach(function(k){var el=document.getElementById('dl_'+k); if(el) el.checked=dp.lines[k]!==false;});
  DASH_DUE_KEYS.forEach(function(k){var el=document.getElementById('du_'+k); if(el) el.checked=dp.due[k]!==false;});
  DASH_STATUS_KEYS.forEach(function(k){var el=document.getElementById('st_'+k); if(el) el.checked=dp.status[k]!==false;});
  // Categories: show the currently-active list (server-managed if any, else defaults).
  _settingsCats=(D && D.costCategories && D.costCategories.length) ? D.costCategories.slice() : COST_CATEGORY_DEFAULTS.slice();
  renderSettingsCats();
  document.getElementById('ovlSettings').classList.add('on');
}
function saveSettings(){
  // Persist categories to the sheet (the only thing that needs a round-trip;
  // dark/chart/lang are already saved on toggle).
  var list=_settingsCats.slice();
  var btn=document.getElementById('setSave'); var oldHtml=btn.innerHTML;
  btn.disabled=true; btn.innerHTML='⟳ กำลังบันทึก…';
  google.script.run.withSuccessHandler(function(r){
    btn.disabled=false; btn.innerHTML=oldHtml;
    if(r && r.ok){
      // Update local cache so the new list is live immediately without a full reload.
      if(D) D.costCategories=list;
      close_('ovlSettings');
      toast('บันทึกการตั้งค่าแล้ว ('+(r.count||0)+' หมวด)');
      if(D) render();
    } else toast(r&&r.error||'บันทึกไม่สำเร็จ');
  }).withFailureHandler(function(e){
    btn.disabled=false; btn.innerHTML=oldHtml;
    toast('ผิดพลาด: '+(e.message||e));
  }).setCostCategories({list:list});
}
function money(n){n=Number(n)||0;return n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0});}
// Strip commas and parse — used wherever an amount input is read.
function moneyVal(s){return parseFloat(String(s||'').replace(/,/g,''))||0;}
// Live thousands-separator formatter while typing. Preserves caret roughly.
function fmtMoneyInput(el){
  var caret=el.selectionStart||0;
  var raw=el.value, before=raw.slice(0,caret).replace(/,/g,'').length;
  var sign=raw.charAt(0)==='-'?'-':'';
  raw=raw.replace(/[^0-9.]/g,'');
  var parts=raw.split('.'); if(parts.length>2)parts=[parts[0],parts.slice(1).join('')];
  parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
  el.value=sign+parts.join('.');
  // Restore caret: count digits before, then re-walk formatted string.
  var seen=0,pos=el.value.length;
  for(var i=0;i<el.value.length;i++){if(el.value[i]!==','&&el.value[i]!=='-'){seen++;if(seen>before){pos=i;break;}}}
  try{el.setSelectionRange(pos,pos);}catch(_){}
}
// Parse a due value into a Date. Handles dd/MM/yyyy (from the sheet) and
// Excel date serials; returns null for blanks / unparseable values.
function parseDue(s){
  if(s==null||s==='')return null;
  var m=String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m)return new Date(+m[3],+m[2]-1,+m[1]);
  if(/^\d{4,6}$/.test(String(s))){var d=new Date(Date.UTC(1899,11,30)+(+s)*864e5);return isNaN(d)?null:d;}
  return null;
}
// Is the due date within the next 7 days (today through today+7, inclusive)?
// Independent of dueBucket — a row can be both "this month" AND "due in 7 days".
function isDueWithin7(s){
  var d=parseDue(s); if(!d)return false;
  var n=new Date();
  var t0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  var t7=new Date(t0.getTime()+7*86400000);
  return d>=t0 && d<=t7;
}
// Bucket a due value relative to today: 'overdue' | 'this' | 'next' | 'later' | ''.
function dueBucket(s){
  var d=parseDue(s); if(!d)return '';
  var n=new Date(), tY=n.getFullYear(), tM=n.getMonth();
  var dY=d.getFullYear(), dM=d.getMonth();
  // The whole current month counts as "this month" even if the day has
  // already passed (still unpaid / postponed). Overdue = before this month.
  if(dY<tY||(dY===tY&&dM<tM))return 'overdue';
  if(dY===tY&&dM===tM)return 'this';
  var nx=new Date(tY,tM+1,1);
  if(dY===nx.getFullYear()&&dM===nx.getMonth())return 'next';
  return 'later';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on');},2600);}
// Small floating "saving…" pill, shown whenever there's at least one pending background save.
var _savingN=0;
function bumpSaving(delta){
  _savingN=Math.max(0,_savingN+delta);
  var el=document.getElementById('savingBadge');
  if(!el){
    el=document.createElement('div');
    el.id='savingBadge';
    el.style.cssText='position:fixed;top:14px;right:14px;background:rgba(31,56,100,.92);color:#fff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;display:none;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:opacity .15s';
    el.innerHTML='<span style="display:inline-block;animation:spin 1s linear infinite">⟳</span> กำลังบันทึก…';
    document.body.appendChild(el);
    // One-shot keyframes for the spinner glyph.
    if(!document.getElementById('savingKf')){
      var st=document.createElement('style');st.id='savingKf';
      st.textContent='@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
  }
  el.style.display=_savingN>0?'block':'none';
}
function close_(id){document.getElementById(id).classList.remove('on');}
// On mobile, tapping the dimmed area above a bottom-sheet modal dismisses it
// (native phone feel). Skips clicks inside .modal — those are content taps.
document.addEventListener('click', function(e){
  if(!document.documentElement.classList.contains('is-mobile')) return;
  var ovl=e.target.closest('.ovl');
  if(ovl && e.target===ovl) ovl.classList.remove('on');
});
function typeName(no){var t=(D.facTypes||[]).find(function(x){return String(x.no)===String(no);});return t?t.th:('#'+no);}
function typeKind(no){var t=(D.facTypes||[]).find(function(x){return String(x.no)===String(no);});return t?t.kind:'';}
// Short document label (เอกสาร) for the colour pill — B/E, P/N, L/G, T/L.
function kindShort(no){return ({LG:'BG',LGM:'L/G',TL:'T/L',AVAL:'B/E',PN:'P/N',ML:'M/L',DLC:'DLC'})[typeKind(no)]||typeKind(no)||'-';}
function kindPill(no){return '<span class="pill '+esc(typeKind(no))+'">'+esc(kindShort(no))+'</span>';}
function projTh(code){var p=(D.projects||[]).find(function(x){return x.code===code;});return p?p.th:code;}
// Project name without the "(joint venture)" suffix — the บริษัท column already shows it.
function projThShort(code){return String(projTh(code)).replace(/\s*\([^)]*\)\s*/g,'').trim();}
// One status → {css colour class, label} map for the 3 statuses + settled.
function statusMeta(s){
  s=String(s);
  if(s==='คำขอใหม่')               return {k:'st-ใหม่',     l:'คำขอใหม่'};
  if(s==='อยู่ระหว่างเสนออนุมัติ') return {k:'st-รออนุมัติ', l:'อยู่ระหว่างเสนออนุมัติ'};
  if(s==='อนุมัติแล้ว'||s.toLowerCase()==='active') return {k:'st-อนุมัติ', l:'อนุมัติแล้ว'};
  if(s==='ชำระแล้ว')               return {k:'st-อนุมัติ',  l:'ชำระแล้ว'};
  if(s.toLowerCase()==='void')     return {k:'st-ไม่อนุมัติ',l:'ยกเลิก'};
  return {k:'st-ใหม่', l:s||'—'};
}
function statusPill(s){
  var m=statusMeta(s);
  return '<span class="pill stp '+m.k+'"><span class="dot"></span>'+esc(m.l)+'</span>';
}
function txnStatusPill(t){
  var m=statusMeta(t.status);
  var extra=(t.status==='ชำระแล้ว'&&t.paidDate)?' '+esc(t.paidDate):'';
  return '<span class="pill stp '+m.k+'"><span class="dot"></span>'+esc(m.l)+extra+'</span>';
}
// เอกสารแนบ cell text: source + optional document date / range, else "-".
function attachText(r){
  var s=r.source||'';
  if(r.docFrom) s+=(s?' | ':'')+r.docFrom+(r.docTo?'–'+r.docTo:'');
  return s||'-';
}
function projName(c){var p=(D.projects||[]).find(function(x){return x.code===c;});return p?p.code+' · '+p.th:c;}

google.script.run.withSuccessHandler(function(d){D=d;init();}).withFailureHandler(function(e){
  document.getElementById('body').innerHTML='<div class="ctr">โหลดข้อมูลไม่สำเร็จ: '+esc(e.message||e)+'</div>';}).getData();

function init(){
  document.getElementById('me').innerHTML = D.me.email
    ? esc(D.me.email)+(D.me.isManager?' · <b>ผู้บริหาร</b>':'') : 'ยังไม่ระบุผู้ใช้';
  fill('fProj',D.projects,true); fill('rProj',D.projects,false); fill('tProj',D.projects,false);
  fillTypes('fType',true); fillTypes('rType',false); fillTypes('tType',false);
  // Request modal: placeholders + company dropdown (auto-filled, read-only).
  ph('rProj','— เลือกโครงการ —'); ph('rType','— เลือกประเภท —');
  var comps=[]; D.projects.forEach(function(p){var c=projCompany(p.code);
    if(comps.indexOf(c)<0)comps.push(c);});
  document.getElementById('rCo').innerHTML='<option value="">— เลือกบริษัท —</option>'
    +comps.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  // Filter-bar บริษัท select uses the same distinct list.
  document.getElementById('fCo').innerHTML='<option value="">ทุกบริษัท</option>'
    +comps.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  // Restore last-used filter selections AND last-viewed tab so F5 doesn't
  // erase the user's working context.
  restoreFilters();
  try{var savedView=localStorage.getItem('vcb-view');
    if(savedView==='fac'||savedView==='txn'||savedView==='plan')setView(savedView);
    else setView('fac');
  }catch(e){setView('fac');}
}
// Prepend a disabled, selected placeholder so the select shows it by default.
function ph(id,txt){var s=document.getElementById(id);
  var o=document.createElement('option');o.value='';o.textContent=txt;o.disabled=true;o.selected=true;
  s.insertBefore(o,s.firstChild);s.value='';}
function fill(id,arr,all){var s=document.getElementById(id);s.innerHTML=(all?'<option value="">ทุกโครงการ</option>':'')
  +arr.map(function(p){return '<option value="'+p.code+'">'+esc(p.code+' · '+p.th)+'</option>';}).join('');}
function fillTypes(id,all){var s=document.getElementById(id);s.innerHTML=(all?'<option value="">ทุกประเภท</option>':'')
  +D.facTypes.map(function(t){return '<option value="'+t.no+'">'+esc(t.no+'. '+t.th)+'</option>';}).join('');}

// Snapshot every filter/month/kind selection to localStorage so F5 doesn't
// reset the user's drill-down. Called at the top of render() — overhead is
// trivial (a few DOM reads + one JSON.stringify + one setItem).
function persistFilters(){
  try{
    localStorage.setItem('vcb-filters',JSON.stringify({
      p:document.getElementById('fProj').value,
      co:document.getElementById('fCo').value,
      t:document.getElementById('fType').value,
      d:document.getElementById('fDue').value,
      s:document.getElementById('fStatus').value,
      q:document.getElementById('fQ').value,
      pm:planMonth, kf:kindFilter
    }));
  }catch(e){}
}
// Restore the saved filter selections on page load. Runs in init() after the
// dropdowns are populated but BEFORE the first render, so the very first
// render sees the user's last-used filters.
function restoreFilters(){
  try{
    var raw=localStorage.getItem('vcb-filters'); if(!raw)return;
    var st=JSON.parse(raw);
    function set(id,v){var el=document.getElementById(id); if(el && v!=null) el.value=v;}
    set('fProj',st.p); set('fCo',st.co); set('fType',st.t);
    set('fDue',st.d); set('fStatus',st.s); set('fQ',st.q);
    if(st.pm) planMonth=st.pm;
    if(typeof st.kf==='string') kindFilter=st.kf;
  }catch(e){}
}
function setView(v){VIEW=v;try{localStorage.setItem('vcb-view',v);}catch(e){}
  document.querySelectorAll('.tab').forEach(function(b){b.classList.toggle('on',b.dataset.v===v);});
  // Status filter only applies to the ledger/plan views, not the Facilities table.
  document.getElementById('fStatus').style.display = v==='fac'?'none':'';
  // Add buttons are always available — both modals let the user pick the
  // project/facility, so they must not vanish when a card jumps to a view
  // (e.g. Facilities) that has no inline "add" of its own.
  document.getElementById('addReqBtn').style.display = '';
  document.getElementById('addTxnBtn').style.display = '';
  render();}

function cards(){
  // The overview cards always show every facility line (scoped only by the
  // project filter). They intentionally ignore the facility-type filter:
  // clicking a card SETS that filter to drill into the table below, and the
  // cards must stay a constant at-a-glance summary, not collapse to one box.
  var q=flt();
  var f=D.facilities.filter(function(x){
    return (!q.p||x.project===q.p)&&matchCo(x.project,q);});

  // T/L, P/N, B/E each get their own box. The three หนังสือค้ำประกัน (#1-3)
  // are grouped into ONE "BG" box — hover shows each line separately.
  // L/G วัสดุ/สาธารณูปโภค (#5, LGM) is NOT a separate box — it shares the bank's
  // credit cap with B/E (#6, AVAL), so we fold #5's limit+used into agg[6]
  // below and the combined total is shown under the B/E card.
  var bgParts=[
   {no:1, label:'ค้ำสัญญา 5%'},
   {no:2, label:'ค้ำ Advance 15%'},
   {no:3, label:'ค้ำประกันผลงาน'}
  ];
  // 8 = M/L, 9 = DLC — new credit-line types, placeholders until the master
  // sheet supplies facilities with those numbers (see Seed.js).
  var agg={}; [1,2,3,4,5,6,7,8,9].forEach(function(n){agg[n]={lim:0,used:0};});
  f.forEach(function(x){var a=agg[x.facilityNo];if(a){a.lim+=x.limit;a.used+=x.used;}});
  // Fold L/G วัสดุ/สาธารณูปโภค (#5) and DLC (#9) into B/E (#6) — both share the
  // B/E credit cap, so they're shown inside the B/E box rather than as their own.
  agg[6].lim+=agg[5].lim+agg[9].lim; agg[6].used+=agg[5].used+agg[9].used;
  agg[5]={lim:0,used:0}; agg[9]={lim:0,used:0};

  var rq=(D.transactions||[]).filter(function(r){return (!q.p||r.project===q.p)&&matchCo(r.project,q);});
  var cNew=0,cWait=0,cAppr=0, aNew=0,aWait=0,aAppr=0;
  rq.forEach(function(r){var amt=Number(r.amount)||0;
    if(r.status==='คำขอใหม่'){cNew++;aNew+=amt;}
    else if(r.status==='อยู่ระหว่างเสนออนุมัติ'){cWait++;aWait+=amt;}
    else if(r.status==='อนุมัติแล้ว'||String(r.status).toLowerCase()==='active'){cAppr++;aAppr+=amt;}});

  // Amounts coming due (bills/notes to be paid), respecting the project filter.
  // 7-day window is additive — a row can be both 'this' month and within 7 days.
  var dueThis=0,dueNext=0,dueOver=0,cntThis=0,cntNext=0,due7=0,cnt7=0;
  (D.transactions||[]).forEach(function(t){
    if(q.p&&t.project!==q.p)return;
    if(!matchCo(t.project,q))return;
    var sl=String(t.status).toLowerCase();
    if(t.status==='ชำระแล้ว'||sl==='void')return; // settled/cancelled aren't due
    var amt=Number(t.amount)||0; if(amt<=0)return; // only outstanding instruments to pay
    var b=dueBucket(t.due);
    if(b==='this'){dueThis+=amt;cntThis++;}
    else if(b==='next'){dueNext+=amt;cntNext++;}
    else if(b==='overdue')dueOver+=amt;
    if(isDueWithin7(t.due)){due7+=amt;cnt7++;}
  });

  // Render one overview box (handles the no-data state). `accent` = top bar.
  // Per-line accent colours live in the LINES catalogue below; KPI cards pass
  // their own. The rest of the app keeps the brand --navy/--orange/--bad palette.
  function box(label,a,click,tip,accent){
    var st=' style="border-top:3px solid '+accent+'"';
    var pct=a.lim>0?Math.min(100,Math.round(a.used/a.lim*100)):(a.used>0?100:0);
    var avail=a.lim-a.used;
    var open='<div class="c act"'+st+' '+click+' title="'+esc(tip)+'"><div class="lbl">'+esc(label)+'</div>';
    if(a.lim===0 && a.used===0)
      return open+'<div class="val sm muted" style="margin-top:auto">— ไม่มีข้อมูล</div></div>';
    var used=pct>=100?'var(--bad)':pct>=80?'var(--orange)':'var(--blue)';
    return open
      +'<div class="val sm">฿'+money(avail)+'</div>'
      +'<div class="vizslot"><div class="meter"><i class="'+(pct>=100?'full':pct>=80?'hi':'')
        +'" style="width:'+pct+'%"></i></div></div>'
      +'<div class="muted" style="font-size:11px;margin-top:5px">ใช้ไปแล้ว '+pct+'%</div></div>';
  }
  // Sum the limit/used across a set of facility numbers (a "credit line" may
  // bundle several — e.g. BG = the three หนังสือค้ำประกัน #1-3).
  function aggOf(nos){var r={lim:0,used:0};nos.forEach(function(n){if(agg[n]){r.lim+=agg[n].lim;r.used+=agg[n].used;}});return r;}
  // BG hover tooltip: break the combined box down into its three guarantee lines.
  var bgTip=bgParts.map(function(z){var a=agg[z.no];
    var av=a.lim-a.used, pc=a.lim>0?Math.min(100,Math.round(a.used/a.lim*100)):(a.used>0?100:0);
    return '• '+z.label+': คงเหลือ ฿'+money(av)+' (ใช้ '+pc+'%)';}).join('\n');

  // Credit-line catalogue for the two วงเงินสินเชื่อ sections. Each entry maps a
  // dashboard box to one or more facility numbers. These are credit-line TYPES —
  // a different dimension from project/scope (ส่วนกลาง etc. live in the project
  // filter, not here). M/L (#8) is a new type and renders a "— ไม่มีข้อมูล"
  // placeholder until data arrives; DLC is folded into B/E (#6 above), no own box.
  // `key` matches the Settings show/hide checkboxes; order here = display order.
  var LINES=[
    {key:'tl',  sec:'lt',  label:'T/L', nos:[4],     accent:'#7FB069', click:'onclick="jumpFac(4)"',  tip:'ดูรายละเอียดวงเงิน T/L'},
    {key:'bg',  sec:'lt',  label:'BG',  nos:[1,2,3], accent:'#B59FD6', click:'onclick="jumpBG()"',   tip:bgTip},
    {key:'ml',  sec:'lt',  label:'M/L', nos:[8],     accent:'#9CCB7A', click:'onclick="jumpFac(8)"',  tip:'ดูรายละเอียดวงเงิน M/L'},
    {key:'be',  sec:'rev', label:'B/E', nos:[6],     accent:'#F0A95F', click:'onclick="jumpBE()"',   tip:'ดูรายละเอียดวงเงิน B/E (รวม L/G วัสดุ/สาธารณูปโภค + DLC)'},
    {key:'pn',  sec:'rev', label:'P/N', nos:[7],     accent:'#6FC1E0', click:'onclick="jumpFac(7)"',  tip:'ดูรายละเอียดวงเงิน P/N'}
  ];
  var pf=getDashPrefs();
  function lineSection(sec){
    var inner='';
    LINES.forEach(function(L){
      if(L.sec!==sec) return;
      if(pf.lines[L.key]===false) return;   // user hid this line in Settings
      inner+=box(L.label,aggOf(L.nos),L.click,L.tip,L.accent);
    });
    return inner;
  }

  // One ครบกำหนด card. bucket feeds jumpDue() → the matching fDue filter value.
  function dueCard(label,amt,cnt,bucket,accent,extra){
    return '<div class="c act kpi-bad" onclick="jumpDue(\''+bucket+'\')" title="ดูรายการ'+esc(label)+'" style="border-top:3px solid '+accent+'">'
      +'<div class="lbl">'+esc(label)+'</div><div class="val sm">฿'+money(amt)+'</div>'
      +'<div class="muted" style="font-size:12px;margin-top:4px">'+cnt+' รายการ'+(extra||'')+'</div>'
      +'<div class="go">ดูรายการ →</div></div>';
  }
  // สถานะ card. Colours mirror the status pills (amber pending / green approved).
  function statusBox(label,cnt,amt,status,accent){
    return '<div class="c act" onclick="jumpStatus(\''+status+'\')" title="ดูรายการสถานะ '+esc(label)+'" style="border-top:3px solid '+accent+'">'
      +'<div class="lbl">'+esc(label)+'</div>'
      +'<div class="val sm">'+cnt+' รายการ</div>'
      +'<div class="muted" style="font-size:12px;margin-top:4px">฿'+money(amt)+'</div>'
      +'<div class="go">ดูรายการ →</div></div>';
  }
  function grp(ttl,inner){
    return '<section class="grp"><h4 class="grp-ttl">'+ttl+'</h4><div class="grp-row">'+inner+'</div></section>';
  }

  // Assemble the visible sections. Every panel is individually toggleable in
  // Settings; a whole section vanishes when all of its panels are switched off.
  var html='';
  var ltInner=lineSection('lt');  if(ltInner)  html+=grp('วงเงินสินเชื่อ (วงเงินกู้ระยะยาว)', ltInner);
  var revInner=lineSection('rev'); if(revInner) html+=grp('วงเงินสินเชื่อ (วงเงินหมุนเวียน)', revInner);
  var dueInner='';
  if(pf.due.week) dueInner+=dueCard('ครบกำหนด — ภายใน 1 สัปดาห์',due7,cnt7,'7d','#E89A3C');
  if(pf.due.this) dueInner+=dueCard('ครบกำหนด — เดือนนี้',dueThis,cntThis,'this','#F2D04A',dueOver>0?' · เกินกำหนดค้าง ฿'+money(dueOver):'');
  if(pf.due.next) dueInner+=dueCard('ครบกำหนด — เดือนหน้า',dueNext,cntNext,'next','#E37D7D');
  if(dueInner) html+=grp('ครบกำหนด', dueInner);
  var stInner='';
  if(pf.status.new)      stInner+=statusBox('คำขอใหม่',cNew,aNew,'คำขอใหม่','#6CA0F0');
  if(pf.status.proposed) stInner+=statusBox('อยู่ระหว่างเสนออนุมัติ',cWait,aWait,'อยู่ระหว่างเสนออนุมัติ','#E0B341');
  if(pf.status.approved) stInner+=statusBox('อนุมัติ',cAppr,aAppr,'อนุมัติแล้ว','#5BC279');
  if(stInner) html+=grp('สถานะ', stInner);
  // Skip the DOM swap when the cards would be byte-identical to what's already
  // there — keeps the bar-rise animation from re-playing on tab switches / sort
  // clicks (it should only fire when data or filters actually change the cards).
  if(html!==_cardsLastHtml){
    document.getElementById('cards').innerHTML=html;
    _cardsLastHtml=html;
  }
}

function flt(){return{p:document.getElementById('fProj').value,t:document.getElementById('fType').value,
  s:document.getElementById('fStatus').value,d:document.getElementById('fDue').value,
  co:document.getElementById('fCo').value,k:kindFilter,
  q:document.getElementById('fQ').value.trim().toLowerCase()};}
function matchCo(project,q){return !q.co||projCompany(project)===q.co;}
// Status filter: q may be one status, or a comma-joined set (e.g. the
// "pending = new + proposed" dashboard panel passes both at once).
function matchStatus(s,q){return !q||String(q).split(',').indexOf(String(s))>=0;}
function matchKind(facilityNo,q){
  // q.k may be a single kind ("AVAL") or comma-separated ("AVAL,LGM") to cover
  // facility groups that share a credit cap (B/E + L/G วัสดุ).
  if(!q.k)return true;
  var k=typeKind(facilityNo);
  return String(q.k).split(',').indexOf(k)>=0;
}

// Reset every drill-down filter (type / due / status / search) so a box click
// starts from a clean slate. The project scope (fProj) is the user's own
// deliberate choice and is intentionally left alone.
function resetDrillFilters(){
  document.getElementById('fType').value='';
  document.getElementById('fDue').value='';
  document.getElementById('fStatus').value='';
  document.getElementById('fQ').value='';
  kindFilter='';
}

// From a due KPI box: show ONLY that due window in the Transactions list.
function jumpDue(bucket){
  resetDrillFilters();
  document.getElementById('fDue').value=bucket;
  setView('txn');
}

// From a facility box: show ONLY that facility type in the Facilities table.
function jumpFac(no){
  resetDrillFilters();
  document.getElementById('fType').value=String(no);
  setView('fac');
}

// From the status box: show the merged ledger, unfiltered.
function jumpReq(){
  resetDrillFilters();
  setView('txn');
}
// From a single request-status box (3-panel dashboard mode): show ONLY that
// status in the Transactions list.
function jumpStatus(status){
  resetDrillFilters();
  document.getElementById('fStatus').value=status;
  setView('txn');
}
// BG box groups the 3 guarantee lines (LG-kind: #1, #2, #3) — filter to them
// via the invisible kindFilter (no single facility number to pin the dropdown to).
function jumpBG(){
  resetDrillFilters();
  kindFilter='LG';
  setView('fac');
}
// B/E + L/G วัสดุ + DLC share a single bank credit cap on the dashboard card, so
// the drill-in mirrors that by filtering to all three kinds (AVAL + LGM + DLC) —
// invisible kindFilter, same approach as BG. Picking "6. B/E รับรอง/อาวัลตั๋ว"
// from the dropdown manually still gives just facility #6 for fine-grained drill.
function jumpBE(){
  resetDrillFilters();
  kindFilter='AVAL,LGM,DLC';
  setView('fac');
}

function render(){
  if(!D)return;
  persistFilters();   // snapshot filter selections + planMonth + kindFilter on every render
  cards();            // dashboard cards sit on top of every view
  var b=document.getElementById('body');
  if(VIEW==='fac')b.innerHTML=facTable();
  else if(VIEW==='plan'){b.innerHTML=planTable();planAfterRender();}
  else b.innerHTML=txnTable();
}

// ---- column sorting (1st click asc, 2nd desc, 3rd off) ----
var sortState={fac:{c:-1,d:0},txn:{c:-1,d:0}};
function sortBy(tbl,idx){
  var s=sortState[tbl];
  if(s.c===idx){s.d=(s.d+1)%3;if(s.d===0)s.c=-1;}
  else{s.c=idx;s.d=1;}
  render();
}
function applySort(tbl,rows,acc){
  var s=sortState[tbl];
  if(s.c<0||!acc[s.c])return rows;
  var f=acc[s.c],dir=s.d===2?-1:1;
  return rows.slice().sort(function(a,b){
    var x=f(a),y=f(b);
    if(typeof x==='number'&&typeof y==='number')return (x-y)*dir;
    x=String(x).toLowerCase();y=String(y).toLowerCase();
    return x<y?-dir:x>y?dir:0;
  });
}
function sHdr(tbl,idx,label,cls){
  var s=sortState[tbl],car=s.c===idx?(s.d===1?' ▲':' ▼'):'';
  return '<th'+(cls?' class="'+cls+'"':'')+' style="cursor:pointer;user-select:none" '
    +'onclick="sortBy(\''+tbl+'\','+idx+')">'+label+car+'</th>';
}

function facTable(){
  var q=flt(); var rows=D.facilities.filter(function(x){
    return (!q.p||x.project===q.p)&&matchCo(x.project,q)&&(!q.t||String(x.facilityNo)===q.t)
      &&matchKind(x.facilityNo,q)
      &&(!q.q||(typeName(x.facilityNo)+x.project).toLowerCase().indexOf(q.q)>=0);});
  if(!rows.length)return '<div class="ctr">ไม่มีข้อมูลวงเงินตามเงื่อนไข</div>';
  rows.sort(function(a,b){return a.project<b.project?-1:a.project>b.project?1:a.facilityNo-b.facilityNo;});
  rows=applySort('fac',rows,[
    function(x){return projTh(x.project);},
    function(x){return projCompany(x.project);},
    function(x){return kindShort(x.facilityNo);},
    function(x){return Number(x.limit)||0;},
    function(x){return Number(x.used)||0;},
    function(x){return Number(x.available)||0;},
    function(x){return x.limit>0?x.used/x.limit:0;}
  ]);
  // Column widths keep the table evenly spread but slightly compact so บริษัท and ประเภท sit closer together.
  // Prepend the category-summary panel — same data context the user gets on
  // the Credit Ledger tab. Budget tracking belongs above both tables since
  // it's about credit usage, which applies across both views.
  var h=categorySummary(D.transactions||[])
    +'<table style="table-layout:auto"><colgroup>'
      +'<col style="width:4%">'
      +'<col style="width:15%"><col style="width:17%"><col style="width:9%">'
      +'<col style="width:11%"><col style="width:11%"><col style="width:11%">'
      +'<col style="width:17%"><col style="width:5%">'
    +'</colgroup><thead><tr><th>#</th>'
    +sHdr('fac',0,'โครงการ')+sHdr('fac',1,'บริษัท')+sHdr('fac',2,'ประเภท','kind')
    +sHdr('fac',3,'วงเงิน','num')+sHdr('fac',4,'ใช้ไป','num')+sHdr('fac',5,'คงเหลือ','num')
    +sHdr('fac',6,'การใช้')+'<th></th></tr></thead><tbody>';
  rows.forEach(function(x,idx){
    var pct=x.limit>0?Math.min(100,Math.round(x.used/x.limit*100)):0;
    var cls=pct>=100?'full':pct>=80?'hi':'';
    var lbl=(projTh(x.project)+' · '+kindShort(x.facilityNo)).replace(/'/g,'');
    var usedMark=x.usedOverridden?'<span title="ตั้งเอง (override) — ไม่ได้คำนวณจากรายการ" style="color:var(--orange);margin-left:4px;font-weight:700">✱</span>':'';
    h+='<tr><td>'+(idx+1)+'</td><td>'+esc(projThShort(x.project))+'</td><td>'+esc(projCompany(x.project))+'</td><td class="kind">'+kindPill(x.facilityNo)+'</td>'
      +'<td class="num">'+money(x.limit)+'</td><td class="num">'+money(x.used)+usedMark+'</td>'
      +'<td class="num" style="color:'+(x.available<0?'var(--bad)':x.available===0?'var(--warn)':'var(--ok)')+'">'+money(x.available)+'</td>'
      +'<td><div class="meter"><i class="'+cls+'" style="width:'+pct+'%"></i></div><span class="muted">'+pct+'%'+(x.available<0?' ⚠ เกินวงเงิน':'')+'</span></td>'
      +'<td><button class="iconbtn ico-edit" title="ปรับวงเงิน / ใช้ไป" onclick="openLimit(\''+esc(x.project)+'\','+x.facilityNo+',\''+esc(lbl)+'\','+(Number(x.limit)||0)+','+(Number(x.used)||0)+','+(x.usedOverridden?1:0)+')"></button></td></tr>';
  });
  return h+'</tbody></table>';
}
// Adjust a facility's credit limit, and/or pin its "used" amount via override.
// Limit changes call setLimit; used changes call setUsedOverride. Only fields
// that actually changed fire an RPC — saves audit-log noise on no-op clicks.
function openLimit(project,facilityNo,label,curLim,curUsed,isUsedOv){
  document.getElementById('lmInfo').textContent=label;
  var inpL=document.getElementById('lmVal');
  inpL.value=Number(curLim).toLocaleString('en-US');
  var inpU=document.getElementById('lmUsed');
  // Prefill with the override value when one's in effect; otherwise blank, and
  // surface the auto-calc number as a placeholder so the user knows what they
  // would be replacing.
  inpU.value=isUsedOv?Number(curUsed).toLocaleString('en-US'):'';
  inpU.placeholder='คำนวณอัตโนมัติ: '+Number(curUsed).toLocaleString('en-US');
  document.getElementById('lmSave').onclick=function(){
    var v=moneyVal(inpL.value);
    if(isNaN(v)||v<0){toast('กรอกวงเงินให้ถูกต้อง');return;}
    var rawU=String(inpU.value||'').trim();
    var hasU=rawU!=='';
    var uVal=hasU?moneyVal(rawU):null;
    if(hasU&&(isNaN(uVal)||uVal<0)){toast('กรอกยอดใช้ไปให้ถูกต้อง');return;}

    var origLim=Number(curLim)||0;
    var origUsedOv=isUsedOv?(Number(curUsed)||0):null;
    var newUsedOv=hasU?uVal:null;
    var calls=[];
    if(v!==origLim) calls.push({fn:'setLimit',args:{project:project,facilityNo:facilityNo,limit:v}});
    if(origUsedOv!==newUsedOv) calls.push({fn:'setUsedOverride',args:{project:project,facilityNo:facilityNo,used:hasU?uVal:''}});
    if(!calls.length){close_('ovlLim');return;}
    (function run(){
      if(!calls.length){close_('ovlLim');reload('ปรับเรียบร้อย');return;}
      var c=calls.shift();
      google.script.run
        .withSuccessHandler(function(r){
          if(!r||!r.ok){toast(r&&r.error||'ไม่สำเร็จ');return;}
          run();
        })
        .withFailureHandler(function(e){toast('ผิดพลาด: '+(e.message||e));})
        [c.fn](c.args);
    })();
  };
  document.getElementById('ovlLim').classList.add('on');
}

function reqTable(){
  var q=flt(); var rows=D.requests.filter(function(r){
    return (!q.p||r.project===q.p)&&(!q.t||String(r.facilityNo)===q.t)&&matchStatus(r.status,q.s)
      &&(!q.q||(r.company+r.note+r.beneficiary+r.requester).toLowerCase().indexOf(q.q)>=0);});
  rows.sort(function(a,b){return a.id<b.id?1:-1;});
  var h='<table><thead><tr><th>#</th><th>วันที่ขอ</th><th>บริษัท</th><th>โครงการ</th><th>ประเภท</th><th class="num">จำนวน (บาท)</th><th>ครบกำหนด</th><th>รายละเอียด</th><th>เอกสารแนบ</th><th>สถานะ</th><th></th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="11" class="ctr">ยังไม่มีคำขอสินเชื่อ</td></tr>';
  rows.forEach(function(r,idx){
    // Over-request flag: compare against the line's remaining available now.
    var av=facAvail(r.project,r.facilityNo);
    var over=(av!=null && Number(r.amount)>av);
    var overBadge=over?'<span class="badge-over" title="คงเหลือ ฿'+money(av)+'">เกินวงเงิน ฿'+money(Number(r.amount)-av)+'</span>':'';
    var linkNote=r.linkedTxn?'<div class="muted" style="font-size:11px">↳ บันทึกใช้วงเงินแล้ว</div>':'';
    var edited=(r.updated&&r.updated!==r.date)
      ?'<span class="editsub">แก้ไข '+esc(r.updated)+'</span>'
      :'<span class="editsub" style="visibility:hidden"> </span>';
    var pur=esc(r.note||'—');
    h+='<tr><td>'+(idx+1)+'</td>'
      +'<td>'+esc(r.date)+edited+'</td>'
      +'<td>'+esc(projCompany(r.project))+'</td>'
      +'<td>'+esc(projTh(r.project))+'</td>'
      +'<td>'+kindPill(r.facilityNo)+'</td>'
      +'<td class="num">'+money(r.amount)+overBadge+'</td>'
      +'<td>'+esc(r.maturity||'—')+'</td>'
      +'<td><div class="trunc" title="'+pur+'">'+pur+'</div></td>'
      +'<td>'+esc(attachText(r))+'</td>'
      +'<td>'+statusPill(r.status)+linkNote+'</td>'
      +'<td><div class="iconrow">'
        +'<button class="iconbtn ico-eye" title="ดู" onclick="viewReq(\''+r.id+'\')"></button>'
        +'<button class="iconbtn ico-edit" title="แก้ไข" onclick="editReq(\''+r.id+'\')"></button>'
        +'<button class="iconbtn del ico-trash" title="ลบ" onclick="delReq(\''+r.id+'\')"></button>'
      +'</div></td></tr>';
  });
  return h+'</tbody></table>';
}

/* ---------- Monthly Cash Plan ---------- */
// Replicates the T-bar layout: left = expected receipts (income) minus
// compulsory deductions; right = list of due items being paid this period.
// Each (project, month) holds up to 5 numbered periods sorted by date.
var planCache={}; // {projectCode: [periods]} for the current month
var prevPlanCache={}; // {projectCode: [periods]} for the PREVIOUS month — for PN carry-over defaults
var planMonth=''; // current selected month YYYY-MM
function planMonthOptions(){
  // last 6 months + this + next 6 — covers historical and forecast
  var out=[],now=new Date();
  for(var i=-6;i<=6;i++){
    var d=new Date(now.getFullYear(),now.getMonth()+i,1);
    var y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2);
    out.push({v:y+'-'+m,l:('0'+(d.getMonth()+1)).slice(-2)+'/'+(y+543).toString().slice(-2)});
  }
  return out;
}
function planTable(){
  if(!planMonth){
    var d=new Date(); planMonth=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2);
  }
  // Ensure spin keyframes are available immediately for the loading badge.
  if(!document.getElementById('savingKf')){
    var st=document.createElement('style');st.id='savingKf';
    st.textContent='@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  var monthSel='<select id="planMonth" onchange="onPlanMonth(this.value)">'
    +planMonthOptions().map(function(o){
      return '<option value="'+o.v+'"'+(o.v===planMonth?' selected':'')+'>'+esc(o.l)+'</option>';
    }).join('')+'</select>';
  // Tip when no specific project is filtered → all projects appear stacked.
  var q=flt();
  var scope=q.p?('โครงการ: '+esc(projTh(q.p))):'ทุกโครงการ';
  // Render the empty-state template OR cached cards immediately — no "กำลังโหลด…"
  // text wait. If a fetch is pending, the small spinner in the toolbar shows
  // that the picker dropdown's project list might still be updating.
  var hasCached=planCache && Object.keys(planCache).length>0;
  var initialBody=hasCached
    ? '<div class="ctr muted" style="padding:10px;font-size:11px">— จะอัปเดตเมื่อโหลดเสร็จ —</div>'
    : renderTemplateCard();
  // Inline project picker — always available at the top of the tab. Replaces
  // the old "＋ เพิ่มโครงการ" → modal flow with a one-click dropdown. Options
  // are filtered to projects not yet in the current month's plan.
  var addable=(D.projects||[]).filter(function(p){return !planCache[p.code]||!planCache[p.code].length;});
  var addOpts='<option value="">＋ เพิ่มโครงการ —</option>'
    +addable.map(function(p){return '<option value="'+esc(p.code)+'">'+esc(p.code+' · '+p.th)+'</option>';}).join('');
  var pickerHtml=addable.length
    ? '<select id="planAddSel" onchange="if(this.value){var v=this.value;this.value=\'\';planAddProject(v);}" style="padding:5px 10px;font-size:13px;background:var(--orange);color:#fff;border-radius:6px;border:0;font-weight:600;cursor:pointer">'+addOpts+'</select>'
    : '<span class="muted" style="font-size:12px">ทุกโครงการมีแผนแล้ว</span>';
  var h=''
    +'<div style="display:flex;gap:10px;align-items:center;margin:8px 0 14px;flex-wrap:wrap">'
      +'<div class="secttl" style="margin:0">แผนการเงิน · '+scope+' · เดือน '+monthSel+'</div>'
      +pickerHtml
      +'<span id="planLoading" class="muted" style="font-size:11px;display:none;align-items:center;gap:5px">'
        +'<span style="display:inline-block;width:13px;height:13px;border:2px solid var(--bd);border-top-color:var(--brand2);border-radius:50%;animation:spin 0.7s linear infinite"></span>'
        +'กำลังโหลด</span>'
      +'<div id="planSum" style="margin-left:auto;font-size:13px"></div>'
    +'</div>'
    +'<div id="planBody" class="plan">'+initialBody+'</div>';
  return h;
}
function onPlanMonth(v){planMonth=v;planAfterRender();}
// Group periods by project so we can render one big table per project.
function planGroupByProject(rows){
  var g={};(rows||[]).forEach(function(p){(g[p.project]=g[p.project]||[]).push(p);});
  return g;
}
// Projects shown in the plan = only those the user has explicitly added a
// period for this month. Filters narrow further (project / company).
function planVisibleProjects(){
  var q=flt();
  return Object.keys(planCache).filter(function(code){
    if(!planCache[code]||!planCache[code].length)return false;
    if(q.p && code!==q.p)return false;
    if(q.co && projCompany(code)!==q.co)return false;
    return true;
  });
}
// Projects available to ADD this month = all projects MINUS the ones already added.
function planAddableProjects(){
  var q=flt();
  var present={};planVisibleProjects().forEach(function(c){present[c]=1;});
  return (D.projects||[]).filter(function(p){
    if(present[p.code])return false;
    if(q.p && p.code!==q.p)return false;
    if(q.co && projCompany(p.code)!==q.co)return false;
    return true;
  });
}
function planPickProject(){
  var opts=planAddableProjects();
  if(!opts.length){toast('โครงการทั้งหมดมีแผนเดือนนี้แล้ว');return;}
  // Build a tiny inline picker (we reuse the confirm modal as a host for choices).
  var html=opts.map(function(p){
    return '<button class="btn ghost" style="display:block;width:100%;text-align:left;margin:4px 0" '
      +'onclick="planAddProject(\''+esc(p.code)+'\')">'+esc(p.code+' · '+p.th)+'</button>';
  }).join('');
  document.getElementById('cfTitle').textContent='เลือกโครงการที่จะเพิ่มเข้าแผน';
  document.getElementById('cfMsg').innerHTML=html;
  document.getElementById('cfOk').style.display='none';
  document.getElementById('ovlConfirm').classList.add('on');
}
var _planAddingProj=null;  // project code currently being added (null if none)
// Optimistic + parallel project-add: build the 3 period objects locally with
// client-side IDs, push to cache, render ONCE (real card appears instantly),
// then fire 3 saveCashPlanPeriod calls in parallel in the background. Sheet
// catches up while the user is already interacting with the card.
function planAddProject(proj){
  document.getElementById('cfOk').style.display='';        // restore for next confirm
  close_('ovlConfirm');
  var existing=planCache[proj]||[];
  if(existing.length){toast('โครงการ '+proj+' มีอยู่ในแผนแล้ว');return;}
  var startIdx=existing.reduce(function(m,p){return Math.max(m,p.periodIdx);},0)+1;
  var allElig=planEligibleItems(proj).map(function(t){return t.id;});
  var types=['income','deduction','income'];
  var incomeOrd=0;
  var periods=types.map(function(type,i){
    var idx=startIdx+i;
    var p={id:'PL-'+Date.now()+'-'+i+'-'+Math.floor(Math.random()*1000),
      project:proj,month:planMonth,periodIdx:idx,
      periodLabel:(type==='income')?('งวดที่ '+(++incomeOrd)):'',
      periodType:type,periodDate:'',income:0,workRef:'',paidIds:[],
      deductions:[],incomeBreak:[],avalAmount:0,
      newPNAmount:0,newPNNote:'',note:''};
    if(type==='income'){
      p.incomeBreak=planDefaultIncome();
      // First income section claims every eligible item this month.
      if(i===0) p.paidIds=allElig.slice();
    } else if(type==='deduction'){
      p.deductions=planDefaultDeductions();
      // Carry over previous month's issued P/N into "หัก PN" on the first
      // such period (same logic as the old planAddPeriod default).
      var prevPn=planPrevPnTotal(proj);
      if(prevPn>0){
        for(var j=0;j<p.deductions.length;j++){
          if(p.deductions[j].label.indexOf('หัก PN')===0 && p.deductions[j].label.indexOf('ใหม่')<0){
            p.deductions[j].amount=prevPn; break;
          }
        }
      }
    }
    return p;
  });
  planCache[proj]=periods;
  renderPlanBody();                       // INSTANT — real card visible now
  toast('เพิ่มโครงการ '+proj+' แล้ว');
  // Fire all 3 saves in parallel; UI doesn't wait.
  bumpSaving(periods.length);
  periods.forEach(function(p){
    google.script.run
      .withSuccessHandler(function(){bumpSaving(-1);})
      .withFailureHandler(function(e){bumpSaving(-1);toast('บันทึก '+p.periodIdx+' ไม่สำเร็จ: '+(e.message||e));})
      .saveCashPlanPeriod(p);
  });
}
function planPrevMonth(){
  var ym=planMonth.split('-'),y=+ym[0],m=+ym[1]-1;
  if(m<1){m=12;y--;} return y+'-'+('0'+m).slice(-2);
}
var planFetchedMonth=''; // last month we successfully fetched
function planAfterRender(){
  function setLoading(on){
    var el=document.getElementById('planLoading');
    if(el) el.style.display=on?'inline-flex':'none';
  }
  // 1. Render from cache instantly so the table doesn't blink to empty on tab switches.
  if(planCache && Object.keys(planCache).length>0) renderPlanBody();
  // 2. Skip the network round-trip if we've already loaded this month and nothing is pending.
  if(planFetchedMonth===planMonth && Object.keys(planCache).length>0 && _savingN===0) return;
  // 3. Otherwise, refresh in the background — the template card is already
  //    visible so the user can pick a project while data loads.
  setLoading(true);
  google.script.run.withSuccessHandler(function(rows){
    if(_savingN>0){setLoading(false);return;}    // don't clobber pending edits
    planCache=planGroupByProject(rows);
    planFetchedMonth=planMonth;
    google.script.run.withSuccessHandler(function(prev){
      prevPlanCache=planGroupByProject(prev);
      setLoading(false);
      renderPlanBody();
    }).withFailureHandler(function(){setLoading(false);prevPlanCache={};renderPlanBody();})
      .getCashPlan('',planPrevMonth());
  }).withFailureHandler(function(e){
    setLoading(false);
    if(!planCache || Object.keys(planCache).length===0){
      var el=document.getElementById('planBody');
      if(el)el.innerHTML='<div class="ctr">โหลดแผนไม่สำเร็จ: '+esc(e.message||e)+'</div>';
    } else {
      toast('โหลดข้อมูลล่าสุดไม่สำเร็จ — แสดงข้อมูลจากแคช');
    }
  }).getCashPlan('',planMonth);
}
// Sum of P/N issued (ขอทำ P/N) across all periods in a given project, previous month.
// Only the "ค่างานรับสุทธิ" row counts — that's the real P/N being discounted.
// "เงินประกันผลงาน" and "ผลงานแล้วเสร็จ" rows are forecasts/info, not actual P/N sales.
function planPrevPnTotal(proj){
  var list=prevPlanCache[proj]||[];
  return list.reduce(function(sum,p){
    var inc=p.incomeBreak||[];
    return sum+inc.reduce(function(s,r){
      if(String(r.label||'').indexOf('ค่างานรับสุทธิ')!==0) return s;
      return s+(Number(r.pnAmount)||0);
    },0);
  },0);
}
// Default deductions every new period starts with (matches the bank's T-bar).
function planDefaultDeductions(){
  return [
    {label:'หัก TL',amount:0},
    {label:'หัก ML',amount:0},
    {label:'หัก PN',amount:0},
    {label:'หัก PN ขอเบิกใหม่',amount:0},
    {label:'หัก Segment CVE',amount:0}
  ];
}
// Period types matching the bank T-bar's sectioning:
//   income     — "ขอเบิก P/N" (3 work-value rows + ขอทำ P/N column)
//   deduction  — "รับเงินค่างาน + หักหนี้" (single income + 5 deductions + คงเหลือ)
//   aval       — "ขอออก Aval จัดสรร" (single amount)
function planPickType(proj){
  var opts=[
    {v:'income',    l:'ขอเบิก P/N',                d:'เบิก P/N เข้าโครงการ จากค่างาน/เงินประกัน/ผลงานแล้วเสร็จ'},
    {v:'deduction', l:'รับเงินค่างาน + หักหนี้',   d:'รับชำระค่างาน หักด้วย TL / ML / PN / Segment'},
    {v:'aval',      l:'ขอออก Aval จัดสรร',         d:'ออก Aval (B/E) จ่ายผู้ขาย/วัสดุ'}
  ];
  var html=opts.map(function(o){
    return '<button class="btn ghost" style="display:block;width:100%;text-align:left;margin:4px 0" '
      +'onclick="planAddPeriod(\''+esc(proj)+'\',\''+o.v+'\')">'
      +'<b>'+esc(o.l)+'</b><div class="muted" style="font-size:11px">'+esc(o.d)+'</div></button>';
  }).join('');
  document.getElementById('cfTitle').textContent='เลือกประเภทงวดสำหรับ '+esc(proj);
  document.getElementById('cfMsg').innerHTML=html;
  document.getElementById('cfOk').style.display='none';
  document.getElementById('ovlConfirm').classList.add('on');
}
function planAddPeriod(proj,type,onDone,suppressRender){
  // Close type picker if it was open.
  document.getElementById('cfOk').style.display='';close_('ovlConfirm');
  type=type||'income';
  var list=planCache[proj]||[];
  var next=list.reduce(function(m,p){return Math.max(m,p.periodIdx);},0)+1;
  if(next>5){toast('ใส่ได้สูงสุด 5 ส่วนต่อเดือน');if(onDone)onDone();return;}
  // "งวดที่ N" labels only count income sections — deductions/aval aren't a
  // งวด, they're bank-flow sections. So a fresh 2nd income gets "งวดที่ 2"
  // even if it's section 3 overall (1=income, 2=deduction, 3=income).
  var incomeOrdinal=(type==='income')
    ? list.filter(function(x){return x.periodType==='income';}).length+1
    : 0;
  var p={project:proj,month:planMonth,periodIdx:next,
    periodLabel:(type==='income')?('งวดที่ '+incomeOrdinal):'',
    periodType:type,periodDate:'',income:0,workRef:'',paidIds:[],
    deductions:[],incomeBreak:[],avalAmount:0,
    newPNAmount:0,newPNNote:'',note:''};
  if(type==='income'){
    p.incomeBreak=planDefaultIncome();
    // First income section claims EVERY eligible item this month (B/E + P/N alike)
    // that isn't already owned by another section. No more AVAL-only split — an
    // item can only be paid once, so the user moves things to the deduction
    // section explicitly (via the → button) if they want to delay payment.
    var hasIncome=list.some(function(x){return x.periodType==='income';});
    if(!hasIncome){
      var claimed={};
      list.forEach(function(x){if(Array.isArray(x.paidIds))x.paidIds.forEach(function(id){claimed[id]=1;});});
      p.paidIds=planEligibleItems(proj).filter(function(t){return !claimed[t.id];}).map(function(t){return t.id;});
    }
  }
  if(type==='deduction'){
    p.deductions=planDefaultDeductions();
    // Deduction section starts EMPTY. The user moves items here from section 1
    // when they want to delay payment to the deduction (work-payment) cash.
    // (Previously this auto-claimed all non-AVAL items, which caused duplicate
    // display and confusion about which section actually paid each item.)
    p.paidIds=[];
    // Carry over the previous month's issued P/N into หัก PN on first such period.
    var hasDeduction=list.some(function(x){return x.periodType==='deduction';});
    if(!hasDeduction){
      var prevPn=planPrevPnTotal(proj);
      if(prevPn>0){
        for(var i=0;i<p.deductions.length;i++){
          if(p.deductions[i].label.indexOf('หัก PN')===0 && p.deductions[i].label.indexOf('ใหม่')<0){
            p.deductions[i].amount=prevPn;break;
          }
        }
      }
    }
  }
  var t=document.getElementById('toast');t.textContent='กำลังเพิ่มส่วน…';t.classList.add('on');
  google.script.run.withSuccessHandler(function(r){
    if(r&&r.ok){p.id=r.id;(planCache[proj]=planCache[proj]||[]).push(p);if(!suppressRender)renderPlanBody();}
    if(!suppressRender)toast('เพิ่มส่วนแล้ว');
    if(onDone)onDone();
  }).withFailureHandler(function(e){toast('เพิ่มไม่สำเร็จ: '+(e.message||e));if(onDone)onDone();}).saveCashPlanPeriod(p);
}
// Default 3 income rows for the ขอเบิก P/N section.
function planDefaultIncome(){
  return [
    {label:'ค่างานรับสุทธิ งวด … (ประมาณ)', workValue:0, pnAmount:0},
    {label:'เงินประกันผลงาน งวด …',         workValue:0, pnAmount:0},
    {label:'ผลงานแล้วเสร็จ ณ …',            workValue:0, pnAmount:0}
  ];
}
function planCopyPrev(proj){
  var ym=planMonth.split('-'),y=+ym[0],m=+ym[1]-1;
  if(m<1){m=12;y--;}
  var prev=y+'-'+('0'+m).slice(-2);
  google.script.run.withSuccessHandler(function(rows){
    var src=(rows||[]).filter(function(r){return r.project===proj;});
    if(!src.length){toast('ไม่พบแผนเดือนก่อนของ '+proj);return;}
    var saved=0,target=src.length;
    src.forEach(function(p){
      var copy={project:proj,month:planMonth,periodIdx:p.periodIdx,
        periodLabel:p.periodLabel,periodDate:'',
        periodType:p.periodType||'mixed',
        income:p.income,workRef:'',
        paidIds:[],
        deductions:p.deductions||(p.periodType==='deduction'?planDefaultDeductions():[]),
        incomeBreak:p.incomeBreak||(p.periodType==='income'?planDefaultIncome():[]),
        avalAmount:p.avalAmount||0,
        newPNAmount:0,newPNNote:'',note:''};
      google.script.run.withSuccessHandler(function(){if(++saved===target)planAfterRender();})
        .saveCashPlanPeriod(copy);
    });
  }).getCashPlan('',prev);
}
// Items eligible to "pay off" — authorized, positive, unpaid AND due in the
// selected month (so each month's plan only shows the items it should address).
// Every outstanding (unpaid, authorized, positive-amount) instrument for the
// project regardless of due month. Used for the "ล่วงหน้า" picker option that
// lets the user pull a not-yet-due item into the plan for early payment, and
// for rendering items already in paidIds whose due date is in a future month.
function planAllOutstanding(proj){
  return (D.transactions||[]).filter(function(t){
    if(t.project!==proj)return false;
    if(t.status==='ชำระแล้ว')return false;
    if(String(t.status).toLowerCase()==='void')return false;
    if(!isAuth(t.status))return false;
    if(!((Number(t.amount)||0)>0))return false;
    if(!parseDue(t.due))return false;
    return true;
  });
}
function planEligibleItems(proj){
  var ym=planMonth.split('-'),y=+ym[0],m=+ym[1];
  return (D.transactions||[]).filter(function(t){
    if(t.project!==proj)return false;
    if(t.status==='ชำระแล้ว')return false;
    if(String(t.status).toLowerCase()==='void')return false;
    if(!isAuth(t.status))return false;
    if(!((Number(t.amount)||0)>0))return false;
    var d=parseDue(t.due); if(!d)return false;
    return d.getFullYear()===y && (d.getMonth()+1)===m;
  });
}
// Empty-state replacement for the T-bar planner: renders the SAME visual
// layout as a real project card — 3 sections, full income/deduction tables,
// totals row — but with disabled inputs and blank values. A project picker
// at the top is the only enabled control; selecting a project triggers
// planAddProject which materializes the real sections with due items.
function tmplIncomeTable(){
  var rows=planDefaultIncome().map(function(r){
    return '<tr><td><input type="text" disabled value="'+esc(r.label)+'" style="width:100%;background:#f5f5f5;opacity:.65"></td>'
      +'<td class="num"><input type="text" disabled style="width:110px;text-align:right;background:#f5f5f5;opacity:.65"></td>'
      +'<td class="num"><input type="text" disabled style="width:110px;text-align:right;background:#f5f5f5;opacity:.65"></td>'
      +'<td class="num muted" style="font-size:11px"></td></tr>';
  }).join('');
  return '<table style="margin:0"><thead><tr><th>รายการ</th><th class="num">ขอเบิก P/N</th><th class="num">ค่างาน</th><th class="num">%</th></tr></thead><tbody>'
    +rows
    +'<tr style="background:#eef3fa"><td><b>รวม</b></td><td class="num"><b>฿0</b></td><td class="num"><b>฿0</b></td><td></td></tr>'
    +'</tbody></table>';
}
function tmplDeductionTable(){
  var rows=planDefaultDeductions().map(function(d){
    var isTL=d.label.indexOf('TL')>=0, isML=d.label.indexOf('ML')>=0,
        isPNNew=d.label.indexOf('ขอเบิกใหม่')>=0;
    var hint=isTL?' <span class="muted" style="font-size:10px">(auto 15%)</span>'
            :isML?' <span class="muted" style="font-size:10px">(auto 1.5%)</span>'
            :isPNNew?' <span class="muted" style="font-size:10px">(auto จาก P/N แถว "ค่างานรับสุทธิ" เท่านั้น)</span>':'';
    return '<tr><td style="color:#9a3232">'+esc(d.label)+hint+'</td>'
      +'<td class="num"><input type="text" disabled style="width:140px;text-align:right;color:#9a3232;background:#f5f5f5;opacity:.65"></td></tr>';
  }).join('');
  return '<table style="margin:0"><tbody>'
    +'<tr><td><b>รับเงินค่างานสุทธิ</b></td>'
      +'<td class="num"><input type="text" disabled style="width:140px;text-align:right;font-weight:600;background:#f5f5f5;opacity:.65"></td></tr>'
    +rows
    +'<tr><td><b>คงเหลือ</b></td><td class="num"><b style="color:var(--navy)">฿0</b></td></tr>'
    +'</tbody></table>';
}
function renderTemplateSectionFull(num,type,periodLabel){
  var label={income:'ขอเบิก P/N',deduction:'รับเงินค่างาน + หักหนี้'}[type];
  var isDed=type==='deduction';
  var hdr='<div style="display:flex;gap:10px;align-items:center;background:#f5f8fc;padding:3px 10px;border-bottom:1px solid var(--bd)">'
    +'<b style="font-size:13px;background:var(--navy);color:#fff;border-radius:4px;padding:1px 8px">'+num+'</b>'
    +'<span style="background:#e8eef7;padding:1px 7px;border-radius:999px;font-size:11px;color:var(--navy);font-weight:600">'+esc(label)+'</span>'
    +(isDed?'':'<span style="font-size:11px;color:var(--mut)">วันที่ส่งงาน</span>')
    +'<input type="date" disabled style="font-size:12px;padding:2px 4px;background:#f5f5f5;opacity:.65">'
    +(isDed?'':'<input type="text" disabled placeholder="'+periodLabel+'" style="width:120px;font-size:12px;padding:2px 4px;background:#f5f5f5;opacity:.65">')
  +'</div>';
  var leftHtml=(type==='income')?tmplIncomeTable():tmplDeductionTable();
  var rightHtml='<div class="ctr muted" style="padding:8px;font-size:11px;font-style:italic">— เลือกโครงการเพื่อโหลดรายการ —</div>';
  return hdr
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">'
      +'<div style="padding:4px 8px;border-right:1px solid var(--bd)">'+leftHtml+'</div>'
      +'<div style="padding:4px 8px">'+rightHtml+'</div>'
    +'</div>';
}
function renderTemplateCard(){
  var present={}; Object.keys(planCache||{}).forEach(function(c){present[c]=1;});
  var available=(D.projects||[]).filter(function(p){return !present[p.code];});
  if(!available.length){
    return '<div class="ctr" style="padding:30px;font-size:14px">ทุกโครงการมีแผนในเดือนนี้แล้ว</div>';
  }
  var pickOpts='<option value="">— เลือกโครงการ —</option>'
    +available.map(function(p){
      return '<option value="'+esc(p.code)+'">'+esc(p.code+' · '+p.th)+'</option>';
    }).join('');
  return '<div style="background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;margin-bottom:14px">'
    +'<div style="background:#0b1220;color:#fff;padding:5px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      +'<b style="font-size:14px">เริ่มต้น</b>'
      +'<select onchange="if(this.value)planAddProject(this.value)" style="padding:4px 10px;font-size:13px;background:#fff;color:var(--ink);border-radius:6px;border:1px solid #334155;min-width:240px">'
        +pickOpts
      +'</select>'
      +'<span style="opacity:.85;font-size:12px">เลือกโครงการเพื่อสร้างแผน 3 ส่วน พร้อม B/E + P/N ที่ครบกำหนดเดือนนี้</span>'
    +'</div>'
    +renderTemplateSectionFull(1,'income','งวดที่ 1')
    +'<div style="border-top:2px dotted #888;margin:0"></div>'
    +renderTemplateSectionFull(2,'deduction','')
    +'<div style="border-top:2px dotted #888;margin:0"></div>'
    +renderTemplateSectionFull(3,'income','งวดที่ 2')
    +'<div style="display:flex;justify-content:flex-end;gap:18px;font-size:13px;padding:5px 12px;border-top:1px solid var(--bd);background:#fafbfd">'
      +'<span class="muted">รวมรับ</span><b>฿0</b>'
      +'<span class="muted">รวมจ่าย</span><b>฿0</b>'
      +'<span class="muted">คงเหลือ</span><b>฿0</b>'
    +'</div>'
  +'</div>';
}
function renderPlanBody(){
  var el=document.getElementById('planBody');if(!el)return;
  var projects=planVisibleProjects();
  if(!projects.length){
    if(_planAddingProj){
      // Spinner keyframes are lazily injected by bumpSaving; do it here too in case
      // the saving badge hasn't been touched yet this session.
      if(!document.getElementById('savingKf')){
        var st=document.createElement('style');st.id='savingKf';
        st.textContent='@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
      el.innerHTML='<div class="ctr" style="padding:50px 30px;font-size:15px">'
        +'<div style="display:inline-block;width:24px;height:24px;border:3px solid var(--bd);border-top-color:var(--brand2);border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:12px"></div>'
        +'<span style="vertical-align:middle">กำลังเพิ่มโครงการ <b>'+esc(_planAddingProj)+'</b> … โปรดรอสักครู่</span>'
        +'</div>';
    } else {
      // Template card: empty-state replaced by a project picker + 3-section
      // skeleton. The structure is always visible so the user knows what they're
      // about to fill in; picking a project materializes the real sections with
      // their due B/E / P/N items auto-populated on the right via planAddProject.
      el.innerHTML=renderTemplateCard();
    }
    document.getElementById('planSum').innerHTML='';
    return;
  }
  var grandIn=0,grandOut=0;
  var sections=projects.map(function(proj){
    var periods=(planCache[proj]||[]).slice().sort(function(a,b){return a.periodIdx-b.periodIdx;});
    var elig=planEligibleItems(proj);
    var totalIn=0,totalOut=0;
    var rows=periods.map(function(p){return renderPlanPeriodCard(p,elig,function(amt){totalIn+=amt[0];totalOut+=amt[1];});}).join('<div style="border-top:2px dotted #888;margin:0"></div>');
    grandIn+=totalIn; grandOut+=totalOut;
    var sumDiff=totalIn-totalOut;
    // Project switcher dropdown — pick a different project to swap this card's
    // identity (keeps the 3-section structure, resets paidIds since they were
    // tied to the old project's transactions). Options exclude projects that
    // already have a plan this month (no duplicates).
    var switchOpts=(D.projects||[]).filter(function(pp){
      return pp.code===proj || !planCache[pp.code] || !planCache[pp.code].length;
    }).map(function(pp){
      return '<option value="'+esc(pp.code)+'"'+(pp.code===proj?' selected':'')+'>'+esc(pp.code+' · '+pp.th)+'</option>';
    }).join('');
    return '<div style="background:var(--card);border:1px solid var(--bd);border-radius:12px;overflow:hidden;margin-bottom:14px">'
      +'<div style="background:#0b1220;color:#fff;padding:5px 12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        +'<select onchange="planChangeProject(\''+esc(proj)+'\',this.value)" title="เปลี่ยนโครงการ — เก็บโครงสร้าง 3 ส่วน แต่เปลี่ยนชื่อโครงการ" '
          +'style="background:#fff;color:var(--ink);border:1px solid #334155;border-radius:6px;padding:2px 8px;font-size:14px;font-weight:700;cursor:pointer">'+switchOpts+'</select>'
        +'<span style="opacity:.7;font-size:12px">'+esc(projCompany(proj))+'</span>'
        +'<div style="margin-left:auto;display:flex;gap:6px">'
          +'<button class="btn ghost" onclick="planPickType(\''+esc(proj)+'\')">＋ เพิ่มส่วน</button>'
          +'<button class="btn ghost ico-copy" onclick="planCopyPrev(\''+esc(proj)+'\')" title="คัดลอกจากเดือนก่อน"></button>'
        +'</div>'
      +'</div>'
      +(periods.length?rows:'<div class="ctr muted" style="padding:14px">ยังไม่มีส่วน — กด <b>＋ เพิ่มส่วน</b> เพื่อเริ่ม</div>')
      +'<div style="display:flex;justify-content:flex-end;gap:18px;font-size:13px;padding:5px 12px;border-top:1px solid var(--bd);background:#fafbfd">'
        +'<span class="muted">รวมรับ</span><b>฿'+money(totalIn)+'</b>'
        +'<span class="muted">รวมจ่าย</span><b>฿'+money(totalOut)+'</b>'
        +'<span class="muted">คงเหลือ</span><b style="color:'+(sumDiff<0?'var(--bad)':'var(--ok)')+'">฿'+money(sumDiff)+'</b>'
      +'</div>'
    +'</div>';
  }).join('');
  el.innerHTML=sections;
  var diffTot=grandIn-grandOut;
  document.getElementById('planSum').innerHTML='รวมทุกโครงการ · รับ <b>฿'+money(grandIn)+'</b> · จ่าย <b>฿'+money(grandOut)+'</b> · คงเหลือ <b style="color:'+(diffTot<0?'var(--bad)':'var(--ok)')+'">฿'+money(diffTot)+'</b>';
}
function renderPlanPeriodCard(p,elig,tally){
  var type=p.periodType||'mixed';
  var typeLabel={'income':'ขอเบิก P/N','deduction':'รับเงินค่างาน + หักหนี้','aval':'ขอออก Aval จัดสรร','mixed':'งวดผสม'}[type];
  // New single-ownership model: a section's right panel shows ONLY items in its
  // paidIds (items it actually pays). Items belong to exactly one section at a
  // time; user moves them via the ↓ / ↑ buttons. Legacy rows with no paidIds
  // fall back to "show all" so they don't go blank on upgrade.
  var hasExplicit=Array.isArray(p.paidIds);
  var paidSet={};
  if(hasExplicit) p.paidIds.forEach(function(id){paidSet[id]=1;});
  else            elig.forEach(function(t){paidSet[t.id]=1;});
  var paidSum=0;
  // Use ALL outstanding so future-due items added via ล่วงหน้า render here too.
  var allOutDed=planAllOutstanding(p.project);
  var paidItems=hasExplicit ? allOutDed.filter(function(t){return paidSet[t.id];}) : elig;
  // Single-step adjacent move (same as income section). Always 3 button slots:
  // ↑ · ↓ · 🗑. Invisible placeholders keep the trash column vertically aligned.
  var sibs=(planCache[p.project]||[]).slice().sort(function(a,b){return a.periodIdx-b.periodIdx;});
  var mi=-1; for(var sj=0;sj<sibs.length;sj++){if(sibs[sj].id===p.id){mi=sj;break;}}
  var prevS=mi>0?sibs[mi-1]:null;
  var nextS=mi>=0&&mi<sibs.length-1?sibs[mi+1]:null;
  var paidRows=paidItems.map(function(t){
    paidSum+=Number(t.amount)||0;
    var upBtn=prevS
      ? '<button class="iconbtn" title="ย้ายไปส่วน '+prevS.periodIdx+'" '
        +'style="font-size:13px;color:var(--brand2)" '
        +'onclick="planMoveBetween(\''+esc(p.id)+'\',\''+esc(t.id)+'\','+prevS.periodIdx+')">↑</button>'
      : '<span class="iconbtn" style="visibility:hidden">↑</span>';
    var dnBtn=nextS
      ? '<button class="iconbtn" title="ย้ายไปส่วน '+nextS.periodIdx+'" '
        +'style="font-size:13px;color:var(--brand2)" '
        +'onclick="planMoveBetween(\''+esc(p.id)+'\',\''+esc(t.id)+'\','+nextS.periodIdx+')">↓</button>'
      : '<span class="iconbtn" style="visibility:hidden">↓</span>';
    return '<tr><td class="date">'+esc(t.due||'—')+'</td>'
      +'<td>'+kindPill(t.facilityNo)+'</td>'
      +'<td>'+esc(t.ref||'—')+'</td>'
      +'<td><div class="trunc" title="'+esc(t.desc||'')+'">'+esc(t.desc||'—')+'</div></td>'
      +'<td class="num">'+money(t.amount)+'</td>'
      +'<td style="white-space:nowrap;width:auto"><div class="iconrow">'
        +upBtn+dnBtn
        +'<button class="iconbtn del ico-trash" title="ไม่ชำระงวดนี้" '
        +'onclick="planRemovePaid(\''+esc(p.id)+'\',\''+esc(t.id)+'\')"></button>'
      +'</div></td></tr>';
  }).join('');
  // Compute per-type left side + per-type total contribution to project sums.
  var leftHtml='', sectionIn=0, sectionOut=0;
  if(type==='income'){
    var inc=(p.incomeBreak&&p.incomeBreak.length)?p.incomeBreak:planDefaultIncome();
    p.incomeBreak=inc;
    var incTotal=inc.reduce(function(s,r){return s+(Number(r.workValue)||0);},0);
    var pnTotal =inc.reduce(function(s,r){return s+(Number(r.pnAmount )||0);},0);
    p.income=incTotal;
    sectionIn=incTotal;
    var pid=esc(p.id);
    leftHtml=''
      +'<table style="margin:0"><thead><tr><th>รายการ</th><th class="num">ขอเบิก P/N</th><th class="num">ค่างาน</th><th class="num">%</th></tr></thead><tbody>'
      +inc.map(function(r,i){
        var pct=(Number(r.workValue)>0)?Math.round((Number(r.pnAmount)||0)/Number(r.workValue)*10000)/100+'%':'';
        return '<tr><td><input type="text" value="'+esc(r.label||'')+'" '
          +'onchange="planEditIncome(\''+pid+'\','+i+',\'label\',this.value)" style="width:100%"></td>'
          +'<td class="num"><input type="text" inputmode="decimal" value="'+(r.pnAmount?Number(r.pnAmount).toLocaleString("en-US"):"")+'" '
          +'oninput="fmtMoneyInput(this);planEditIncomeLive(\''+pid+'\','+i+',\'pnAmount\',moneyVal(this.value))" '
          +'onchange="planEditIncome(\''+pid+'\','+i+',\'pnAmount\',moneyVal(this.value))" '
          +'style="width:110px;text-align:right"></td>'
          +'<td class="num"><input type="text" inputmode="decimal" value="'+(r.workValue?Number(r.workValue).toLocaleString("en-US"):"")+'" '
          +'oninput="fmtMoneyInput(this);planEditIncomeLive(\''+pid+'\','+i+',\'workValue\',moneyVal(this.value))" '
          +'onchange="planEditIncome(\''+pid+'\','+i+',\'workValue\',moneyVal(this.value))" '
          +'style="width:110px;text-align:right"></td>'
          +'<td class="num muted" style="font-size:11px">'+pct+'</td></tr>';
      }).join('')
      +'<tr style="background:#eef3fa"><td><b>รวม</b></td>'
        +'<td class="num"><b>฿'+money(pnTotal)+'</b></td>'
        +'<td class="num"><b>฿'+money(incTotal)+'</b></td><td></td></tr>'
      +'</tbody></table>';
  } else if(type==='deduction'){
    var income=Number(p.income)||0;
    var deds=(p.deductions&&p.deductions.length)?p.deductions:planDefaultDeductions();
    p.deductions=deds;
    // Auto-calc: TL = 15% × รับเงินค่างาน, ML = 1.5% × รับเงินค่างาน,
    // PN-ใหม่ = pnAmount of the "ค่างานรับสุทธิ" row in this month's income period
    // (the other two rows — เงินประกันผลงาน, ผลงานแล้วเสร็จ — are informational and do NOT feed in).
    var pnSold=planPnSoldThisMonth(p.project);
    for(var k=0;k<deds.length;k++){
      var lbl=deds[k].label;
      if(lbl.indexOf('TL')>=0)        deds[k].amount=Math.round(income*0.15*100)/100;
      else if(lbl.indexOf('ML')>=0)   deds[k].amount=Math.round(income*0.015*100)/100;
      else if(lbl.indexOf('ขอเบิกใหม่')>=0) deds[k].amount=pnSold;
    }
    var dedSum=deds.reduce(function(s,d){return s+(Number(d.amount)||0);},0);
    var bal=income-dedSum;
    sectionOut=dedSum+paidSum;
    var pid=esc(p.id);
    var dedRows=deds.map(function(d,i){
      var isTL=d.label.indexOf('TL')>=0;
      var isML=d.label.indexOf('ML')>=0;
      var isPNNew=d.label.indexOf('ขอเบิกใหม่')>=0;
      var isAuto=isTL||isML||isPNNew;
      var hint=isTL?' <span class="muted" style="font-size:10px">(auto 15%)</span>'
              :isML?' <span class="muted" style="font-size:10px">(auto 1.5%)</span>'
              :isPNNew?' <span class="muted" style="font-size:10px">(auto จาก P/N แถว "ค่างานรับสุทธิ" เท่านั้น)</span>':'';
      var cellId=isTL?'ded-'+pid+'-TL':isML?'ded-'+pid+'-ML':isPNNew?'ded-'+pid+'-PNNEW':'';
      return '<tr><td style="color:#9a3232">'+esc(d.label)+hint+'</td>'
        +'<td class="num"><input type="text" inputmode="decimal" '+(isAuto?'readonly':'')+' '
          +(cellId?'id="'+cellId+'" ':'')
          +'value="'+(d.amount?Number(d.amount).toLocaleString("en-US"):"")+'" '
          +(isAuto?'':'oninput="fmtMoneyInput(this)" onchange="planEditDeduction(\''+pid+'\','+i+',moneyVal(this.value))" ')
          +'style="width:140px;text-align:right;color:#9a3232'+(isAuto?';background:#f5f5f5':'')+'"></td></tr>';
    }).join('');
    leftHtml=''
      +'<table style="margin:0"><tbody>'
        +'<tr><td><b>รับเงินค่างานสุทธิ</b></td>'
          +'<td class="num"><input type="text" inputmode="decimal" '
            +'value="'+(income?Number(income).toLocaleString("en-US"):"")+'" '
            +'oninput="fmtMoneyInput(this);planEditLive(\''+pid+'\',\'income\',moneyVal(this.value))" '
            +'onchange="planEdit(\''+pid+'\',\'income\',moneyVal(this.value))" '
            +'style="width:140px;text-align:right;font-weight:600"></td></tr>'
        +dedRows
        +'<tr><td><b>คงเหลือ</b></td><td class="num"><b id="ded-'+pid+'-BAL" style="color:'+(bal<0?'var(--bad)':'var(--navy)')+'">฿'+money(bal)+'</b></td></tr>'
      +'</tbody></table>';
  } else if(type==='aval'){
    var av=Number(p.avalAmount)||0;
    sectionOut=av;
    leftHtml=''
      +'<table style="margin:0"><tbody>'
        +'<tr><td><b>ขอออก Aval จัดสรร</b></td>'
          +'<td class="num"><input type="text" inputmode="decimal" '
            +'value="'+(av?Number(av).toLocaleString("en-US"):"")+'" '
            +'oninput="fmtMoneyInput(this)" onchange="planEdit(\''+esc(p.id)+'\',\'avalAmount\',moneyVal(this.value))" '
            +'style="width:160px;text-align:right;font-weight:600"></td></tr>'
      +'</tbody></table>';
  }
  if(tally)tally([sectionIn,sectionOut]);
  // Right side varies by section type.
  var rightHtml='';
  if(type==='deduction'){
    rightHtml=''
      +(elig.length
        ? '<table><thead><tr><th class="date">ครบ</th><th>ประเภท</th><th>เลขที่</th><th>รายละเอียด</th><th class="num">จำนวน</th><th></th></tr></thead><tbody>'+paidRows+'</tbody></table>'
        : '<div class="ctr muted" style="padding:10px">ไม่มีรายการครบกำหนดในเดือนนี้</div>');
  } else if(type==='income'){
    // PN interest = amount × days × 6.25%/365.  Default term = 90 days; per-row editable.
    var incRows=p.incomeBreak||[];
    var pid2=esc(p.id);
    var rateAnnual=0.0625;
    var pnIxRows='', totalInt=0, anyPn=false;
    incRows.forEach(function(r,i){
      var amt=Number(r.pnAmount)||0;
      if(amt<=0)return;
      anyPn=true;
      var days=(r.pnDays==null||r.pnDays==='')?90:Number(r.pnDays);
      var interest=Math.round(amt*days*rateAnnual/365*100)/100;
      totalInt+=interest;
      pnIxRows+='<tr>'
        +'<td><div class="trunc" title="'+esc(r.label||'')+'">'+esc(r.label||'—')+'</div></td>'
        +'<td class="num">'+money(amt)+'</td>'
        +'<td class="num"><input type="number" min="0" value="'+days+'" '
          +'onchange="planEditIncome(\''+pid2+'\','+i+',\'pnDays\',Number(this.value)||0)" '
          +'style="width:55px;text-align:right"></td>'
        +'<td class="num">'+money(interest)+'</td>'
      +'</tr>';
    });
    // Items this income section will pay. Single ownership: each eligible item
    // belongs to exactly one section. A fresh section 1 claims everything (B/E
    // + P/N) by default; user moves things to the deduction section via the ↓
    // button when they want to delay payment.
    var hasExpl=Array.isArray(p.paidIds);
    var inThis={};
    if(hasExpl) p.paidIds.forEach(function(id){inThis[id]=1;});
    else {
      // Legacy default for very old rows that have no paidIds at all:
      // claim every eligible item not already owned by another section.
      var legacyClaimed={};
      (planCache[p.project]||[]).forEach(function(other){
        if(other.id===p.id||!Array.isArray(other.paidIds))return;
        other.paidIds.forEach(function(id){legacyClaimed[id]=1;});
      });
      elig.forEach(function(t){if(!legacyClaimed[t.id])inThis[t.id]=1;});
    }
    var claimedElsewhere={};
    (planCache[p.project]||[]).forEach(function(other){
      if(other.id===p.id||!Array.isArray(other.paidIds))return;
      other.paidIds.forEach(function(id){claimedElsewhere[id]=other.periodIdx;});
    });
    // itemsShown uses ALL outstanding so a future-due item (added via the
    // ล่วงหน้า section of the picker) renders even though it isn't in elig.
    var allOut=planAllOutstanding(p.project);
    var itemsShown=allOut.filter(function(t){return inThis[t.id];});
    // canAdd badge count: current-month addable only — the common case.
    // The picker itself separately offers ล่วงหน้า items below the divider.
    var canAdd=elig.filter(function(t){return !inThis[t.id]&&!claimedElsewhere[t.id];});
    // Single-step adjacent move: only the immediately-previous (↑) and
    // immediately-next (↓) sections of the same project are valid targets.
    // To skip across sections, click twice. Each row always has 3 button
    // slots (↑ · ↓ · 🗑) — invisible placeholder when the slot doesn't apply
    // — so the trash column aligns vertically across all sections.
    var siblings=(planCache[p.project]||[]).slice().sort(function(a,b){return a.periodIdx-b.periodIdx;});
    var myIdx=-1; for(var si=0;si<siblings.length;si++){if(siblings[si].id===p.id){myIdx=si;break;}}
    var prevSec=myIdx>0?siblings[myIdx-1]:null;
    var nextSec=myIdx>=0&&myIdx<siblings.length-1?siblings[myIdx+1]:null;
    var avalRows=itemsShown.map(function(t){
      var upBtn=prevSec
        ? '<button class="iconbtn" title="ย้ายไปส่วน '+prevSec.periodIdx+'" '
          +'style="font-size:13px;color:var(--brand2)" '
          +'onclick="planMoveBetween(\''+pid2+'\',\''+esc(t.id)+'\','+prevSec.periodIdx+')">↑</button>'
        : '<span class="iconbtn" style="visibility:hidden">↑</span>';
      var dnBtn=nextSec
        ? '<button class="iconbtn" title="ย้ายไปส่วน '+nextSec.periodIdx+'" '
          +'style="font-size:13px;color:var(--brand2)" '
          +'onclick="planMoveBetween(\''+pid2+'\',\''+esc(t.id)+'\','+nextSec.periodIdx+')">↓</button>'
        : '<span class="iconbtn" style="visibility:hidden">↓</span>';
      return '<tr><td class="date">'+esc(t.due||'—')+'</td>'
        +'<td>'+kindPill(t.facilityNo)+'</td>'
        +'<td>'+esc(t.ref||'—')+'</td>'
        +'<td><div class="trunc" title="'+esc(t.desc||'')+'">'+esc(t.desc||'—')+'</div></td>'
        +'<td class="num">'+money(t.amount)+'</td>'
        +'<td style="white-space:nowrap;width:auto"><div class="iconrow">'
          +upBtn+dnBtn
          +'<button class="iconbtn del ico-trash" title="ตัดออกจากส่วนนี้" onclick="planRemovePaid(\''+pid2+'\',\''+esc(t.id)+'\')"></button>'
        +'</div></td></tr>';
    }).join('');
    // Rate (6.25%/ปี) is a property of the days×rate calc, so it lives as a
    // small italic remark inside the "วัน" column header — no banner above
    // the table, saves vertical space.
    var rateRemark='<span style="font-style:italic;font-weight:normal;color:var(--mut);font-size:10px;margin-left:4px">('+(rateAnnual*100).toFixed(2)+'%/ปี)</span>';
    // When no PN amount is keyed in left, hide the entire interest section
    // (table AND the dotted divider) — saves vertical space and avoids the
    // gray placeholder hint the user found noisy.
    rightHtml=''
      +(anyPn
        ? '<table><thead><tr><th>รายการ</th><th class="num">ยอด P/N</th><th class="num">วัน'+rateRemark+'</th><th class="num">ดอกเบี้ย</th></tr></thead>'
          +'<tbody>'+pnIxRows
          +'<tr style="background:#fef3e8"><td><b>รวมดอกเบี้ย</b></td><td></td><td></td><td class="num"><b>฿'+money(totalInt)+'</b></td></tr>'
          +'</tbody></table>'
          +'<div style="border-top:2px dotted #888;margin:8px 0"></div>'
        : '')
      +(canAdd.length
        ? '<div style="text-align:right;margin:0 0 4px"><button class="btn ghost sm" style="font-size:11px;padding:2px 8px" onclick="planPickAvalAdd(\''+pid2+'\')">＋ เพิ่ม ('+canAdd.length+')</button></div>'
        : '')
      +(itemsShown.length
        ? '<table><thead><tr><th class="date">ครบ</th><th>ประเภท</th><th>เลขที่</th><th>รายละเอียด</th><th class="num">จำนวน</th><th></th></tr></thead><tbody>'+avalRows+'</tbody></table>'
        : '<div class="ctr muted" style="padding:8px;font-size:11px">ไม่มีรายการในส่วนนี้'+(canAdd.length?' — กด ＋ เพิ่ม':'')+'</div>');
  } else {
    rightHtml='<div class="muted" style="font-size:11px;padding:6px">— ('+esc(typeLabel)+')</div>';
  }
  // Inline section header (small) — keeps the whole project visually ONE card.
  // Deduction sections aren't a "งวดงาน" — skip the วันที่ส่งงาน label and the งวดที่ N text input.
  var isDed=(type==='deduction');
  var hdr=''
    +'<div style="display:flex;gap:10px;align-items:center;background:#f5f8fc;padding:3px 10px;border-bottom:1px solid var(--bd)">'
      +'<b style="font-size:13px;background:var(--navy);color:#fff;border-radius:4px;padding:1px 8px">'+(p.periodIdx)+'</b>'
      +'<span style="background:#e8eef7;padding:1px 7px;border-radius:999px;font-size:11px;color:var(--navy);font-weight:600">'+esc(typeLabel)+'</span>'
      +(isDed?'':'<span style="font-size:11px;color:var(--mut)">วันที่ส่งงาน</span>')
      +'<input type="date" value="'+esc(p.periodDate?dmyToISO(p.periodDate):'')+'" '
        +'onchange="planEdit(\''+esc(p.id)+'\',\'periodDate\',isoToDMY(this.value))" '
        +'style="font-size:12px;padding:2px 4px">'
      +(isDed?''
        :(function(){
            // Placeholder counts income sections only — same logic as creation.
            var incomes=(planCache[p.project]||[]).filter(function(x){return x.periodType==='income';});
            var ordinal=incomes.findIndex(function(x){return x.id===p.id;})+1;
            if(ordinal<=0) ordinal=p.periodIdx;
            return '<input type="text" value="'+esc(p.periodLabel)+'" placeholder="งวดที่ '+ordinal+'" '
              +'onchange="planEdit(\''+esc(p.id)+'\',\'periodLabel\',this.value)" '
              +'style="width:120px;font-size:12px;padding:2px 4px">';
          })())
      +'<button class="iconbtn del ico-trash" title="ลบส่วนนี้" onclick="planDel(\''+esc(p.id)+'\')" style="margin-left:auto"></button>'
    +'</div>';
  return hdr
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0">'
      +'<div style="padding:4px 8px;border-right:1px solid var(--bd)">'+leftHtml+'</div>'
      +'<div style="padding:4px 8px">'+rightHtml+'</div>'
    +'</div>';
}
function planFind(id){
  for(var proj in planCache){
    var p=(planCache[proj]||[]).filter(function(x){return x.id===id;})[0];
    if(p)return p;
  }
  return null;
}
// Debounced save: per-period timer collapses bursts of keystrokes into one
// server call ~300ms after the user stops typing. No full renderPlanBody on
// success — the cache update + planRefreshDeductionCells already updated the
// visible numbers, so re-rendering would just thrash the DOM and steal focus.
var _planSaveTimers={}, _planPendingFlush={};
function planScheduleSave(p,delay){
  if(_planSaveTimers[p.id]) clearTimeout(_planSaveTimers[p.id]);
  _planPendingFlush[p.id]=p;
  _planSaveTimers[p.id]=setTimeout(function(){
    delete _planSaveTimers[p.id];
    var pp=_planPendingFlush[p.id]; delete _planPendingFlush[p.id];
    bumpSaving(+1);
    google.script.run
      .withSuccessHandler(function(){bumpSaving(-1);})
      .withFailureHandler(function(e){bumpSaving(-1);toast('บันทึกไม่สำเร็จ: '+(e.message||e));})
      .saveCashPlanPeriod(pp);
  }, delay==null?100:delay);
}
// Force any debounced saves to fire NOW (called before navigation / on demand).
// Cannot guarantee delivery — beforeunload races the network — but better than
// leaving them stuck in the timer queue.
function planFlushPendingSaves(){
  Object.keys(_planSaveTimers).forEach(function(id){
    clearTimeout(_planSaveTimers[id]); delete _planSaveTimers[id];
    var pp=_planPendingFlush[id]; delete _planPendingFlush[id];
    if(pp){
      bumpSaving(+1);
      google.script.run
        .withSuccessHandler(function(){bumpSaving(-1);})
        .withFailureHandler(function(){bumpSaving(-1);})
        .saveCashPlanPeriod(pp);
    }
  });
}
// Warn the user if they navigate / F5 while saves are in flight or queued.
// Browsers ignore the custom message — they just show their own generic prompt.
window.addEventListener('beforeunload', function(e){
  var pending=Object.keys(_planSaveTimers).length>0;
  if(pending) planFlushPendingSaves();
  if(pending || _savingN>0){ e.preventDefault(); e.returnValue=''; return ''; }
});

function planEdit(id,field,val){
  var p=planFind(id);if(!p)return;p[field]=val;
  planScheduleSave(p);
}
function planEditIncome(periodId,idx,field,value){
  var p=planFind(periodId);if(!p)return;
  p.incomeBreak=p.incomeBreak||planDefaultIncome();
  if(p.incomeBreak[idx]) p.incomeBreak[idx][field]=(field==='label')?String(value||''):(Number(value)||0);
  planScheduleSave(p);
}
// Update the วันที่ส่งงาน for every row in a sub-block.
function planEditSubDate(periodId,sub,isoDate){
  var p=planFind(periodId);if(!p)return;
  p.incomeBreak=p.incomeBreak||planDefaultIncome();
  var dmy=isoDate?isoToDMY(isoDate):'';
  p.incomeBreak.forEach(function(r){if((r.sub||1)===sub)r.subDate=dmy;});
  planScheduleSave(p);
}
function planEditDeduction(periodId,idx,amount){
  var p=planFind(periodId);if(!p)return;
  p.deductions=p.deductions||planDefaultDeductions();
  if(p.deductions[idx])p.deductions[idx].amount=Number(amount)||0;
  planScheduleSave(p);
}
// Sum of pnAmount in the same-month income period (the P/N being sold this month).
// Only the "ค่างานรับสุทธิ" row contributes — that's the real disbursement-backed P/N.
// "เงินประกันผลงาน" (retention) and "ผลงานแล้วเสร็จ" (completed-work forecast) are
// informational and must NOT auto-feed the หัก PN ขอเบิกใหม่ deduction.
function planPnSoldThisMonth(proj){
  var inc=(planCache[proj]||[]).filter(function(x){return x.periodType==='income';})[0];
  if(!inc)return 0;
  return (inc.incomeBreak||[]).reduce(function(s,r){
    if(String(r.label||'').indexOf('ค่างานรับสุทธิ')!==0) return s;
    return s+(Number(r.pnAmount)||0);
  },0);
}
// Live recompute of the deduction period's auto cells (TL, ML, PN-new, balance)
// without re-rendering — so input focus is preserved.
function planRefreshDeductionCells(proj){
  var ded=(planCache[proj]||[]).filter(function(x){return x.periodType==='deduction';})[0];
  if(!ded)return;
  var income=Number(ded.income)||0;
  var pnSold=planPnSoldThisMonth(proj);
  var tl=Math.round(income*0.15*100)/100;
  var ml=Math.round(income*0.015*100)/100;
  (ded.deductions||[]).forEach(function(d){
    var lbl=d.label;
    if(lbl.indexOf('TL')>=0)              d.amount=tl;
    else if(lbl.indexOf('ML')>=0)         d.amount=ml;
    else if(lbl.indexOf('ขอเบิกใหม่')>=0) d.amount=pnSold;
  });
  var dedSum=(ded.deductions||[]).reduce(function(s,d){return s+(Number(d.amount)||0);},0);
  var bal=income-dedSum;
  var pfx='ded-'+ded.id+'-';
  function setVal(id,v){var el=document.getElementById(id);if(el)el.value=v?Number(v).toLocaleString('en-US'):'';}
  setVal(pfx+'TL',tl);
  setVal(pfx+'ML',ml);
  setVal(pfx+'PNNEW',pnSold);
  var balEl=document.getElementById(pfx+'BAL');
  if(balEl){balEl.innerHTML='฿'+money(bal);balEl.style.color=(bal<0?'var(--bad)':'var(--navy)');}
}
// Cache-only update for instant recompute (no server save until onchange).
function planEditLive(id,field,val){
  var p=planFind(id);if(!p)return;p[field]=val;
  if(p.periodType==='deduction') planRefreshDeductionCells(p.project);
}
function planEditIncomeLive(periodId,idx,field,value){
  var p=planFind(periodId);if(!p)return;
  p.incomeBreak=p.incomeBreak||planDefaultIncome();
  if(p.incomeBreak[idx]) p.incomeBreak[idx][field]=(field==='label')?String(value||''):(Number(value)||0);
  planRefreshDeductionCells(p.project);
}
function planRemovePaid(periodId,txnId){
  var p=planFind(periodId);if(!p)return;
  if(!Array.isArray(p.paidIds)){
    // Materialize the default list based on section type, then remove the clicked one.
    var elig=planEligibleItems(p.project);
    if(p.periodType==='income') p.paidIds=elig.filter(function(t){return typeKind(t.facilityNo)==='AVAL';}).map(function(x){return x.id;});
    else                        p.paidIds=elig.filter(function(t){return typeKind(t.facilityNo)!=='AVAL';}).map(function(x){return x.id;});
  }
  var idx=p.paidIds.indexOf(txnId);
  if(idx<0)return;
  p.paidIds.splice(idx,1);
  renderPlanBody();                       // OPTIMISTIC: row disappears instantly
  bumpSaving(+1);
  google.script.run.withSuccessHandler(function(){bumpSaving(-1);})
    .withFailureHandler(function(e){
      bumpSaving(-1);
      p.paidIds.push(txnId);              // revert on failure
      renderPlanBody();
      toast('บันทึกไม่สำเร็จ: '+(e.message||e));
    }).saveCashPlanPeriod(p);
}
// Picker for re-adding an Aval/B/E item to an income section (or moving it from another section).
function planPickAvalAdd(periodId){
  var p=planFind(periodId);if(!p)return;
  var elig=planEligibleItems(p.project);
  var allOut=planAllOutstanding(p.project);
  var inThis={};(Array.isArray(p.paidIds)?p.paidIds:[]).forEach(function(id){inThis[id]=1;});
  var claimedElsewhere={};
  (planCache[p.project]||[]).forEach(function(other){
    if(other.id===p.id)return;
    if(Array.isArray(other.paidIds))other.paidIds.forEach(function(id){claimedElsewhere[id]=1;});
  });
  // Picker splits into two groups: current-month items (the common pick) and
  // future-due items (rare — for early payment).
  var addableAll=allOut.filter(function(t){return !inThis[t.id]&&!claimedElsewhere[t.id];});
  if(!addableAll.length){toast('ไม่มีรายการที่ยังไม่ถูกจัดเข้าส่วนใด');return;}
  var eligIds={}; elig.forEach(function(t){eligIds[t.id]=1;});
  function byDue(a,b){var da=parseDue(a.due),db=parseDue(b.due);return (da?da.getTime():0)-(db?db.getTime():0);}
  var current=addableAll.filter(function(t){return eligIds[t.id];}).sort(byDue);
  var future=addableAll.filter(function(t){return !eligIds[t.id];}).sort(byDue);
  function btn(t){
    return '<button class="btn ghost" style="display:block;width:100%;text-align:left;margin:4px 0" '
      +'onclick="planAddPaid(\''+esc(periodId)+'\',\''+esc(t.id)+'\')">'
      +'<div><b>'+esc(t.ref||'—')+'</b> · '+kindShort(t.facilityNo)+' · ฿'+money(t.amount)+'</div>'
      +'<div class="muted" style="font-size:11px">ครบ '+esc(t.due||'—')+' · '+esc(t.desc||'')+'</div>'
      +'</button>';
  }
  var html='';
  if(current.length){
    html+='<div class="muted" style="font-size:11px;margin:6px 0 2px;font-weight:700">ครบกำหนดเดือนนี้</div>';
    html+=current.map(btn).join('');
  }
  if(future.length){
    html+='<div class="muted" style="font-size:11px;margin:'+(current.length?'12':'6')+'px 0 2px;font-weight:700">ล่วงหน้า (ยังไม่ครบ — ชำระก่อน)</div>';
    html+=future.map(btn).join('');
  }
  document.getElementById('cfTitle').textContent='เลือกรายการที่จะเพิ่มเข้าส่วนนี้';
  document.getElementById('cfMsg').innerHTML=html;
  document.getElementById('cfOk').style.display='none';
  document.getElementById('ovlConfirm').classList.add('on');
}
function planAddPaid(periodId,txnId){
  var p=planFind(periodId);if(!p)return;
  document.getElementById('cfOk').style.display='';close_('ovlConfirm');
  if(!Array.isArray(p.paidIds))p.paidIds=[];
  if(p.paidIds.indexOf(txnId)>=0)return;
  p.paidIds.push(txnId);
  renderPlanBody();                       // OPTIMISTIC
  bumpSaving(+1);
  google.script.run.withSuccessHandler(function(){bumpSaving(-1);})
    .withFailureHandler(function(e){
      bumpSaving(-1);
      var idx=p.paidIds.indexOf(txnId);
      if(idx>=0)p.paidIds.splice(idx,1);
      renderPlanBody();
      toast('บันทึกไม่สำเร็จ: '+(e.message||e));
    }).saveCashPlanPeriod(p);
}
// Swap a project card's identity to a different project. Keeps the 3-section
// structure but updates the project field on every period and resets paidIds
// (which were tied to the old project's transactions). User picks from the
// dropdown in the project card header.
function planChangeProject(oldProj,newProj){
  if(!newProj||oldProj===newProj) return;
  if(planCache[newProj] && planCache[newProj].length){
    toast('โครงการ '+newProj+' มีอยู่ในแผนเดือนนี้แล้ว');
    renderPlanBody();   // re-render to reset the dropdown selection
    return;
  }
  var periods=(planCache[oldProj]||[]).slice();
  if(!periods.length) return;
  var allElig=planEligibleItems(newProj).map(function(t){return t.id;});
  periods.forEach(function(p,i){
    p.project=newProj;
    // Section 1 (first income) claims every eligible item of the new project;
    // other sections start empty (same single-ownership default as planAddProject).
    if(p.periodType==='income' && periods.filter(function(x,j){return j<i && x.periodType==='income';}).length===0){
      p.paidIds=allElig.slice();
    } else {
      p.paidIds=[];
    }
  });
  planCache[newProj]=periods;
  delete planCache[oldProj];
  renderPlanBody();          // OPTIMISTIC
  bumpSaving(periods.length);
  periods.forEach(function(p){
    google.script.run
      .withSuccessHandler(function(){bumpSaving(-1);})
      .withFailureHandler(function(e){bumpSaving(-1);toast('บันทึก '+p.periodIdx+' ไม่สำเร็จ: '+(e.message||e));})
      .saveCashPlanPeriod(p);
  });
}
// Move a single item between two sections of the same project. Used by the
// ↓ (income → deduction) and ↑ (deduction → income) buttons. Saves both
// periods (the source row loses the item, target gains it) and re-renders so
// the user sees the row move instantly.
function planMoveBetween(srcPeriodId,txnId,targetPeriodIdx){
  var src=planFind(srcPeriodId); if(!src) return;
  var target=(planCache[src.project]||[]).filter(function(x){return x.periodIdx===Number(targetPeriodIdx);})[0];
  if(!target){toast('ไม่พบส่วนปลายทาง');return;}
  // Materialize the source's paidIds before mutating (legacy rows had no array).
  if(!Array.isArray(src.paidIds)){
    var elig=planEligibleItems(src.project);
    if(src.periodType==='income') src.paidIds=elig.map(function(x){return x.id;});
    else src.paidIds=[];
  }
  if(!Array.isArray(target.paidIds)) target.paidIds=[];
  var i=src.paidIds.indexOf(txnId);
  if(i>=0) src.paidIds.splice(i,1);
  if(target.paidIds.indexOf(txnId)<0) target.paidIds.push(txnId);
  renderPlanBody();                       // OPTIMISTIC
  bumpSaving(+2);
  google.script.run
    .withSuccessHandler(function(){bumpSaving(-1);})
    .withFailureHandler(function(e){bumpSaving(-1);toast('บันทึกไม่สำเร็จ: '+(e.message||e));})
    .saveCashPlanPeriod(src);
  google.script.run
    .withSuccessHandler(function(){bumpSaving(-1);})
    .withFailureHandler(function(e){bumpSaving(-1);toast('บันทึกไม่สำเร็จ: '+(e.message||e));})
    .saveCashPlanPeriod(target);
}
function planDel(id){
  confirmBox('ลบส่วนนี้?',function(){
    // Optimistic delete — pull from cache immediately, save in background.
    var snapshot={};
    for(var proj in planCache){
      snapshot[proj]=planCache[proj].slice();
      planCache[proj]=(planCache[proj]||[]).filter(function(p){return p.id!==id;});
    }
    renderPlanBody();
    bumpSaving(+1);
    google.script.run.withSuccessHandler(function(){bumpSaving(-1);})
      .withFailureHandler(function(e){
        bumpSaving(-1);
        planCache=snapshot;                // revert
        renderPlanBody();
        toast('ลบไม่สำเร็จ: '+(e.message||e));
      }).deleteCashPlanPeriod({id:id});
  },'ลบ');
}

function txnTable(){
  var q=flt(); var rows=D.transactions.filter(function(t){
    return (!q.p||t.project===q.p)&&matchCo(t.project,q)
      &&(!q.t||String(t.facilityNo)===q.t)&&matchKind(t.facilityNo,q)
      &&matchStatus(t.status,q.s)&&(!q.d||(q.d==='7d'?isDueWithin7(t.due):dueBucket(t.due)===q.d))
      &&(!q.q||(String(t.ref||'')+String(t.desc||'')+String(t.kind||'')+String(t.beneficiary||'')).toLowerCase().indexOf(q.q)>=0);});
  // When filtering by a due window, sort by due date (soonest first).
  if(q.d) rows.sort(function(a,b){var x=parseDue(a.due),y=parseDue(b.due);return (x?x:0)-(y?y:0);});
  else rows.sort(function(a,b){return a.id<b.id?1:-1;});
  rows=applySort('txn',rows,[
    null,
    function(t){var d=parseDue(t.date);return d?d.getTime():0;},
    function(t){return projCompany(t.project);},
    function(t){return projThShort(t.project);},
    function(t){return kindShort(t.facilityNo);},
    function(t){return t.ref||'';},
    function(t){return t.desc||'';},
    function(t){return Number(t.amount)||0;},
    function(t){var d=parseDue(t.start);return d?d.getTime():0;},
    function(t){var d=parseDue(t.due);return d?d.getTime():0;},
    function(t){return statusMeta(t.status).l;},
    null
  ]);
  var dueLbl={this:'ครบกำหนดเดือนนี้',next:'ครบกำหนดเดือนหน้า',overdue:'เกินกำหนด'}[q.d];
  // Category summary mirrors the Facilities tab: always the full transaction
  // set, not the filtered `rows` — drill-down filters (status / due / search)
  // shouldn't reshape a high-level "where is budget being used" panel.
  var h=categorySummary(D.transactions||[]);
  if(dueLbl)h+='<div class="secttl">แสดงเฉพาะ: '+dueLbl+(q.p?' · '+esc(q.p):'')+'</div>';
  // Row-count line: how many rows the current filter shows out of the full ledger.
  h+='<div class="rowcount">แสดง '+rows.length+' / '+(D.transactions||[]).length+' รายการ</div>';
  h+='<table><thead><tr><th>#</th>'
    +sHdr('txn',1,'วันที่')+sHdr('txn',2,'บริษัท')+sHdr('txn',3,'โครงการ')
    +sHdr('txn',4,'ประเภท','kind')+sHdr('txn',5,'เลขที่เอกสาร')+sHdr('txn',6,'รายละเอียด / ผู้รับผลประโยชน์')
    +sHdr('txn',7,'จำนวนเงิน','num')+sHdr('txn',8,'เริ่ม','date')+sHdr('txn',9,'ครบ','date')
    +sHdr('txn',10,'สถานะ')+'<th></th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="12" class="ctr">ไม่มีรายการเคลื่อนไหว</td></tr>';
  var tot=0;
  rows.forEach(function(t,idx){
    var paid=t.status==='ชำระแล้ว';
    var auth=isAuth(t.status);
    if(auth && (Number(t.amount)||0)>0)tot+=Number(t.amount)||0;
    // Row actions: view / edit / delete only. (Authorize moved out of row —
    // less clutter; use Edit → สถานะ = อนุมัติแล้ว.)
    var act='<div class="iconrow">'
      +'<button class="iconbtn ico-eye" title="ดู" onclick="viewReq(\''+t.id+'\','+(idx+1)+')"></button>'
      +'<button class="iconbtn ico-edit" title="แก้ไข" onclick="editReq(\''+t.id+'\')"></button>'
      +'<button class="iconbtn del ico-trash" title="ลบ" onclick="delReq(\''+t.id+'\')"></button>'
      +'</div>';
    // รายละเอียด / ผู้รับผลประโยชน์ — concatenate desc + beneficiary with ' | '
    // when both exist; show "—" only when both are blank.
    var descTxt=String(t.desc||'').trim();
    var benTxt=String(t.beneficiary||'').trim();
    var combined=descTxt && benTxt ? (descTxt+' | '+benTxt)
                 : descTxt ? descTxt
                 : benTxt ? benTxt : '—';
    var pur=esc(combined);
    // Always render the editsub block — invisible placeholder when no edit —
    // so every row has the same total height. Otherwise edited vs un-edited rows
    // would visibly differ and the table looks uneven.
    var editedSub=(t.updated&&t.updated!==t.date)
      ?'<span class="editsub">แก้ไข '+esc(t.updated)+'</span>'
      :'<span class="editsub" style="visibility:hidden"> </span>';
    h+='<tr'+(paid?' style="opacity:.55"':'')+'><td>'+(idx+1)+'</td>'
      +'<td>'+esc(t.date||'—')+editedSub+'</td>'
      +'<td>'+esc(projCompany(t.project))+'</td>'
      +'<td>'+esc(projThShort(t.project))+'</td>'
      +'<td class="kind">'+kindPill(t.facilityNo)+'</td>'
      +'<td>'+esc(t.ref||'—')+'</td>'
      +'<td><div class="trunc" title="'+pur+'">'+pur+'</div></td>'
      +'<td class="num" style="color:'+(t.amount<0?'var(--ok)':'inherit')+'">'+money(t.amount)+'</td>'
      +'<td class="date">'+esc(t.start)+'</td><td class="date">'+esc(t.due)+'</td>'
      +'<td>'+txnStatusPill(t)+'</td>'
      +'<td>'+act+'</td></tr>';
  });
  h+='</tbody>';
  if(rows.length)h+='<tfoot><tr><th colspan="7" class="num">รวมยอดค้างชำระ'+(dueLbl?' ('+dueLbl+')':'')+'</th><th class="num">฿'+money(tot)+'</th><th class="date"></th><th class="date"></th><th></th><th></th></tr></tfoot>';
  return h+'</table>';
}
// Compact grouping of unpaid/active credit requests by (project × หมวดค่าใช้จ่าย),
// shown as a collapsed <details> panel above the ledger so it doesn't dominate.
// Same filter context as the ledger — if you filter to BT1, the summary reflects BT1.
function categorySummary(rows){
  var q=flt();
  var groups={};
  // 1. Aggregate ALL request amounts by (project × category) — paid items
  //    still count against the category budget, otherwise you could pay off
  //    old requests and re-request the same category indefinitely.
  //    Only void is excluded (truly cancelled).
  rows.forEach(function(t){
    if(String(t.status).toLowerCase()==='void') return;
    if(!(Number(t.amount)||0)) return;
    var cat=String(t.costCategory||'').trim()||'(ไม่ระบุหมวด)';
    var k=t.project+'|'+cat;
    if(!groups[k]) groups[k]={project:t.project,category:cat,amount:0,count:0,cap:0};
    groups[k].amount+=Number(t.amount)||0;
    groups[k].count++;
  });
  // 2. Overlay caps from D.categoryCaps — also create empty groups for caps
  //    that have no transactions yet (so "งบ ฿X · ใช้ไป ฿0" is visible).
  (D.categoryCaps||[]).forEach(function(c){
    if(q.p && c.project!==q.p) return;
    if(q.co && projCompany(c.project)!==q.co) return;
    var k=c.project+'|'+c.costCategory;
    if(!groups[k]) groups[k]={project:c.project,category:c.costCategory,amount:0,count:0,cap:Number(c.cap)||0};
    else groups[k].cap=Number(c.cap)||0;
  });
  var keys=Object.keys(groups).sort(function(a,b){
    var ga=groups[a],gb=groups[b];
    if(ga.project!==gb.project) return ga.project<gb.project?-1:1;
    return ga.category<gb.category?-1:1;
  });
  if(!keys.length) return '';
  // Pill chip helper — used for header summary and per-project status badges.
  function statusPill(text,kind){
    var palette={
      bad:    {bg:'#FDE2E2',fg:'#A91D1D'},
      warn:   {bg:'#FBE8C8',fg:'#9A5C13'},
      muted:  {bg:'#EAEEF3',fg:'#5A6675'},
      ok:     {bg:'#D9F1DD',fg:'#1F6E3A'}
    }[kind]||{bg:'#EAEEF3',fg:'#5A6675'};
    return '<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:'+palette.bg+';color:'+palette.fg+';white-space:nowrap">'+text+'</span>';
  }
  function statusPillsFor(cats){
    var o=0,n=0,u=0,k=0;
    cats.forEach(function(g){
      if(!(g.cap>0)){u++;return;}
      var pct=g.amount/g.cap;
      if(pct>=1)o++; else if(pct>=0.8)n++; else k++;
    });
    var pills=[];
    if(o) pills.push(statusPill('⚠ '+o+' เกินงบ','bad'));
    if(n) pills.push(statusPill('⚠ '+n+' ใกล้เต็ม','warn'));
    if(u) pills.push(statusPill(u+' ยังไม่ตั้งงบ','muted'));
    if(!o && !n && !u && k) pills.push(statusPill('✓ ในงบ','ok'));
    return {pills:pills.join(' '),over:o,near:n,uncapped:u,ok:k};
  }
  var allCats=keys.map(function(k){return groups[k];});
  var topStatus=statusPillsFor(allCats);
  var headerStatus=topStatus.pills ? ' &nbsp; '+topStatus.pills : '';
  // Group categories by project so the panel is a 2-level accordion:
  // outer = main panel, inner = one collapsible row per project.
  var byProject={};
  keys.forEach(function(k){
    var g=groups[k];
    (byProject[g.project]=byProject[g.project]||[]).push(g);
  });
  var projectKeys=Object.keys(byProject).sort();
  // (statusBitsFor — legacy text version, replaced by statusPillsFor above)
  function renderCatRow(g){
    var capCell,pctCell,statusCell;
    if(g.cap>0){
      var pct=Math.round(g.amount/g.cap*1000)/10;
      var remaining=g.cap-g.amount;
      var pctColor=pct>=100?'var(--bad)':pct>=80?'var(--orange)':'var(--ok)';
      capCell='฿'+money(g.cap);
      pctCell='<span style="color:'+pctColor+';font-weight:600">'+pct.toFixed(1)+'%</span>';
      if(remaining>=0){
        var remColor=pct>=80?'var(--orange)':'var(--ok)';
        statusCell='<span style="color:'+remColor+';font-weight:600">฿'+money(remaining)+'</span>';
      } else {
        statusCell='<span style="color:var(--bad);font-weight:700">−฿'+money(-remaining)+'</span>';
      }
    } else {
      capCell='<span class="muted" style="font-size:11px">— ไม่ได้ตั้ง</span>';
      pctCell='<span class="muted">—</span>';
      statusCell='<span class="muted">—</span>';
    }
    var editBtn='<div class="iconrow">'
      +'<span class="iconbtn ico-eye" style="visibility:hidden"></span>'
      +'<button class="iconbtn ico-edit" title="ตั้ง/แก้ไขงบประมาณ" '
        +'onclick="openCapModal(\''+esc(g.project)+'\',\''+esc(g.category)+'\','+(g.cap||0)+')"></button>'
      +'<span class="iconbtn ico-trash" style="visibility:hidden"></span>'
    +'</div>';
    return '<tr><td>'+costCategoryPill(g.category)+'</td>'
      +'<td class="num">'+g.count+'</td>'
      +'<td class="num">฿'+money(g.amount)+'</td>'
      +'<td class="num">'+capCell+'</td>'
      +'<td class="num">'+pctCell+'</td>'
      +'<td class="num">'+statusCell+'</td>'
      +'<td>'+editBtn+'</td></tr>';
  }
  // Per-project accordion sections — visually richer: colored left-border
  // (red/orange/gray/green by worst status), project badge chip, status pills,
  // and a thin overall utilization bar across the project's capped categories.
  var projectSections=projectKeys.map(function(proj){
    var cats=byProject[proj].slice().sort(function(a,b){return a.category<b.category?-1:1;});
    var ps=statusPillsFor(cats);
    // Worst-status drives the left border colour.
    var border=ps.over?'var(--bad)':ps.near?'var(--orange)':ps.uncapped?'#cbd5e1':'var(--ok)';
    // Overall utilization across capped categories only.
    var projUsed=0,projCap=0;
    cats.forEach(function(g){if(g.cap>0){projCap+=g.cap;projUsed+=g.amount;}});
    var pct=projCap>0?Math.min(150,Math.round(projUsed/projCap*100)):0;
    var pctColor=pct>=100?'var(--bad)':pct>=80?'var(--orange)':'var(--blue)';
    var meterHtml=projCap>0
      ? '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;max-width:340px">'
          +'<div class="meter" style="flex:1;height:6px"><i style="width:'+Math.min(100,pct)+'%;background:'+pctColor+'"></i></div>'
          +'<span style="font-size:11px;color:'+pctColor+';font-weight:600;font-variant-numeric:tabular-nums">'+pct+'%</span>'
          +'<span class="muted" style="font-size:11px">฿'+money(projUsed)+' / ฿'+money(projCap)+'</span>'
        +'</div>'
      : '<div class="muted" style="font-size:11px;margin-top:4px;font-style:italic">— ยังไม่มีงบที่ตั้งไว้ในโครงการนี้ —</div>';
    var projBadge='<span style="display:inline-block;background:var(--navy);color:#fff;font-size:12px;font-weight:700;padding:2px 9px;border-radius:5px;letter-spacing:.3px">'+esc(proj)+'</span>';
    var rows=cats.map(renderCatRow).join('');
    return '<details class="csum-proj" style="border-left:3px solid '+border+';margin:8px 0;background:#fafbfd;border-radius:6px;padding:6px 12px 4px">'
      +'<summary style="cursor:pointer;font-size:13px;padding:2px 0;list-style:revert">'
        +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
          +projBadge
          +'<span class="muted" style="font-weight:500;font-size:12px">'+esc(projThShort(proj))+'</span>'
          +'<div style="margin-left:auto;display:flex;gap:4px;flex-wrap:wrap">'+ps.pills+'</div>'
        +'</div>'
        +meterHtml
      +'</summary>'
      +'<div style="padding:4px 0 8px 16px">'
        +'<table style="margin:0"><thead><tr>'
          +'<th>หมวดค่าใช้จ่าย</th><th class="num"># รายการ</th>'
          +'<th class="num">ใช้ไป</th><th class="num">งบประมาณ</th>'
          +'<th class="num">% ใช้</th><th class="num">คงเหลือ</th><th></th>'
        +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +'</div>'
    +'</details>';
  }).join('');
  return '<details class="csum" style="margin:0 0 14px;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:6px 12px">'
    +'<summary style="cursor:pointer;font-weight:700;font-size:13px;color:var(--navy);padding:2px 0">'
      +'สรุปหมวดค่าใช้จ่าย'+headerStatus
    +'</summary>'
    +'<div style="margin-top:8px">'+projectSections+'</div>'
  +'</details>';
}

// Build a real .xlsx server-side and download it (3 sheets, all computed
// columns included). Reflects the full data set, not the current filter.
function exportExcel(){
  confirmBox('ส่งออกไฟล์ Excel ตามตัวกรองปัจจุบัน?',function(){
    var btn=document.getElementById('xlsBtn');btn.disabled=true;var old=btn.textContent;
    btn.textContent='กำลังสร้างไฟล์…';
    google.script.run.withSuccessHandler(function(res){
      btn.disabled=false;btn.textContent=old;
      var bin=atob(res.b64),len=bin.length,buf=new Uint8Array(len);
      for(var i=0;i<len;i++)buf[i]=bin.charCodeAt(i);
      var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=res.name;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
      toast('ดาวน์โหลดไฟล์ Excel แล้ว');
    }).withFailureHandler(function(e){
      btn.disabled=false;btn.textContent=old;toast('ส่งออกไม่สำเร็จ: '+(e.message||e));
    }).exportXlsx(exportFilter());
  },'📥 ส่งออก');
}
// Send the active on-screen filters so the export matches what's shown.
function exportFilter(){
  var f=flt();
  return {p:f.p,t:f.t,s:f.s,d:f.d,qq:f.q};
}

/* modals */
function openReq(){
  editId=null;
  document.getElementById('reqTitle').textContent='เพิ่มคำขอสินเชื่อ';
  reqFormFill(null);document.getElementById('rAvail').textContent='';
  document.getElementById('ovlReq').classList.add('on');
}
function openTxn(){document.getElementById('ovlTxn').classList.add('on');}
// Company for a project: the entity in the project name's (parentheses) if
// present, otherwise the default บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด. Adding a
// "(...)" to any project name in Seed.js automatically reassigns it.
function projCompany(code){
  var p=(D&&D.projects||[]).filter(function(x){return x.code===code;})[0];
  if(!p)return '';
  var m=String(p.th||'').match(/\(([^)]+)\)/);
  // Strip the leading "บริษัท" and trailing "จำกัด" — redundant clutter.
  return (m?m[1].trim():'บริษัท วิจิตรภัณฑ์ก่อสร้าง จำกัด')
    .replace(/^บริษัท\s*/,'').replace(/\s*จำกัด\s*$/,'').trim();
}
// Remaining available (limit − used) on a facility line for a project.
function facAvail(project,facilityNo){
  if(!D||!D.facilities)return null;
  var f=D.facilities.filter(function(x){
    return x.project===project&&String(x.facilityNo)===String(facilityNo);})[0];
  return f?f.available:null;
}
// Annual % rate parsed from a facility's free-text interest field, e.g.
// "1.25 % ต่อปีเรียกเก็บทุก 3 เดือน" → 1.25. Returns null when the field has
// no explicit number (e.g. "MLR ต่อปี") — those can't be auto-computed.
function facRatePct(project,facilityNo){
  if(!D||!D.facilities)return null;
  var f=D.facilities.filter(function(x){
    return x.project===project&&String(x.facilityNo)===String(facilityNo);})[0];
  if(!f||!f.interest)return null;
  var m=String(f.interest).match(/(\d+(?:\.\d+)?)\s*%/);
  return m?parseFloat(m[1]):null;
}
// Whole days a due date is past today (0 if not yet overdue / unparseable).
function daysOverdue(due){
  var d=parseDue(due); if(!d)return 0;
  var n=new Date(); var t0=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  var diff=Math.floor((t0-d)/864e5);
  return diff>0?diff:0;
}
// Simple interest on an overdue, still-outstanding item:
// amount × rate% × daysOverdue / 365. Returns a renderable result.
function isAuth(s){s=String(s);return s==='อนุมัติแล้ว'||s.toLowerCase()==='active';}
function overdueInterest(t){
  if(!isAuth(t.status))return {n:0,txt:'—'}; // only authorized accrues interest
  var amt=Number(t.amount)||0;
  if(amt<=0)return {n:0,txt:'—'};
  var days=daysOverdue(t.due);
  if(!days)return {n:0,txt:'—'};
  var pct=facRatePct(t.project,t.facilityNo);
  if(pct==null)return {n:0,txt:'ระบุอัตราไม่ได้',tip:'อัตราดอกเบี้ยของวงเงินนี้ไม่ได้ระบุเป็นตัวเลข (เช่น MLR)'};
  var intr=amt*pct/100*days/365;
  return {n:intr,txt:'฿'+money(intr),
    tip:money(amt)+' × '+pct+'% × '+days+' วัน ÷ 365'};
}
// Live hint under the amount: shows remaining headroom, warns (but does not
// block) when the request exceeds it.
function reqAvailHint(){
  var el=document.getElementById('rAvail');if(!el)return;
  var pj=rProj.value,fn=rType.value,amt=moneyVal(rAmt.value);
  var cat=String(document.getElementById('rCostCat').value||'').trim();
  var lines=[];
  // Facility cap hint (existing behavior).
  if(pj && fn){
    var av=facAvail(pj,fn);
    if(av==null){lines.push({cls:'',html:'ไม่มีข้อมูลวงเงินคงเหลือสำหรับโครงการ/ประเภทนี้'});}
    else if(amt>av){lines.push({cls:'over',html:'⚠ เกินวงเงินคงเหลือ ฿'+money(amt-av)+' (คงเหลือ ฿'+money(av)+') — ยังยื่นคำขอได้'});}
    else{lines.push({cls:'ok',html:'คงเหลือใช้ได้ ฿'+money(av)+(amt>0?' · หลังคำขอนี้เหลือ ฿'+money(av-amt):'')});}
  }
  // Category-cap hint: if project + category are picked AND a cap exists for that pair.
  if(pj && cat){
    var cap=catCapFor(pj,cat);
    if(cap>0){
      var used=catUsedFor(pj,cat,editId);  // exclude the row being edited
      var after=used+(amt||0);
      var msg='หมวด "'+cat+'" — งบ ฿'+money(cap)+' · ใช้ไป ฿'+money(used);
      if(amt>0) msg+=' · หลังคำขอนี้ ฿'+money(after)+' ('+Math.round(after/cap*100)+'%)';
      if(after>cap) lines.push({cls:'over',html:'⚠ '+msg+' — เกินงบ ฿'+money(after-cap)});
      else if(after>=cap*0.8) lines.push({cls:'over',html:'⚠ '+msg+' — ใกล้เต็มงบ'});
      else lines.push({cls:'ok',html:msg});
    }
  }
  if(!lines.length){el.textContent='';el.className='availhint';return;}
  // Render: pick the most urgent class for the container; stack lines.
  var cls=lines.some(function(l){return l.cls==='over';})?'over':lines.some(function(l){return l.cls==='ok';})?'ok':'';
  el.className='availhint '+cls;
  el.innerHTML=lines.map(function(l){return '<div'+(l.cls==='over'?' style="color:var(--bad)"':l.cls==='ok'?' style="color:var(--ok)"':'')+'>'+l.html+'</div>';}).join('');
}
// Helper: budget cap for a (project, category) pair, 0 if none set.
function catCapFor(project,category){
  var c=(D.categoryCaps||[]).filter(function(x){return x.project===project&&x.costCategory===category;})[0];
  return c?(Number(c.cap)||0):0;
}
// Helper: sum of ALL request amounts for a (project, category) — paid items
// included, since the budget cap measures cumulative requests against the
// cashflow that was submitted to the bank (not just current outstanding).
// Only void rows are excluded. Optionally skip one txn id (used when editing
// so we don't double-count the row being edited).
function catUsedFor(project,category,excludeId){
  return (D.transactions||[]).reduce(function(s,t){
    if(excludeId && t.id===excludeId) return s;
    if(t.project!==project) return s;
    if(String(t.costCategory||'')!==category) return s;
    if(String(t.status).toLowerCase()==='void') return s;
    var amt=Number(t.amount)||0;
    return amt>0?s+amt:s;
  },0);
}
// Open the cap-edit modal for a (project, category). Pre-fills with current cap.
function openCapModal(project,category,currentCap){
  if(category==='(ไม่ระบุหมวด)'){
    toast('รายการกลุ่มนี้ยังไม่ได้ระบุหมวด — แก้คำขอให้กรอกหมวดก่อน แล้วค่อยตั้งงบ');
    return;
  }
  document.getElementById('capInfo').innerHTML='<b>'+esc(project)+'</b> · '+esc(projThShort(project))+' · หมวด <b>'+esc(category)+'</b>';
  var inp=document.getElementById('capVal');
  inp.value=currentCap?Number(currentCap).toLocaleString('en-US'):'';
  var noteInp=document.getElementById('capNote');
  var existing=(D.categoryCaps||[]).filter(function(x){return x.project===project&&x.costCategory===category;})[0];
  noteInp.value=existing?(existing.note||''):'';
  document.getElementById('capSave').onclick=function(){
    var raw=inp.value.trim();
    var v=raw?moneyVal(raw):'';
    if(raw && (isNaN(v)||v<0)){toast('กรอกงบให้ถูกต้อง');return;}
    var btn=document.getElementById('capSave');
    var oldHtml=btn.innerHTML;
    btn.disabled=true; btn.innerHTML='⟳ กำลังบันทึก…';
    google.script.run.withSuccessHandler(function(r){
      if(r&&r.ok){close_('ovlCap');btn.disabled=false;btn.innerHTML=oldHtml;reload(raw?'ตั้งงบแล้ว':'ยกเลิกงบแล้ว');}
      else {btn.disabled=false;btn.innerHTML=oldHtml;toast(r&&r.error||'ไม่สำเร็จ');}
    }).withFailureHandler(function(e){btn.disabled=false;btn.innerHTML=oldHtml;toast('ผิดพลาด: '+(e.message||e));})
      .setCategoryCap({project:project,costCategory:category,cap:v,note:noteInp.value.trim()});
  };
  document.getElementById('ovlCap').classList.add('on');
}
// Project chosen → auto-fill the (read-only) company by the bracket rule.
function reqProjChange(){
  var code=rProj.value;
  document.getElementById('rCo').value=code?projCompany(code):'';
  reqAvailHint();
}
function fmtDMY(dt){var dd=('0'+dt.getDate()).slice(-2),mm=('0'+(dt.getMonth()+1)).slice(-2);
  return dd+'/'+mm+'/'+dt.getFullYear();}
// Native date input gives yyyy-mm-dd → convert to the app's dd/mm/yyyy.
function isoToDMY(s){var m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?(m[3]+'/'+m[2]+'/'+m[1]):'';}
function dmyToISO(s){var m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m?(m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2)):'';}
function _parseIso(s){return s?new Date(s+'T00:00:00'):null;}
function _toIso(dt){var m=('0'+(dt.getMonth()+1)).slice(-2),d=('0'+dt.getDate()).slice(-2);
  return dt.getFullYear()+'-'+m+'-'+d;}
// Three-way bidirectional link between start / days / maturity.
function calcMatFromStartDays(){
  var s=_parseIso(rStart.value), d=parseInt(rDays.value,10);
  if(s && !isNaN(d)){var dt=new Date(s);dt.setDate(dt.getDate()+d);rMat.value=_toIso(dt);}
}
function calcDaysFromStartMat(){
  var s=_parseIso(rStart.value), m=_parseIso(rMat.value);
  if(s && m){rDays.value=Math.round((m-s)/86400000);}
}
function calcStartFromMatDays(){
  var m=_parseIso(rMat.value), d=parseInt(rDays.value,10);
  if(m && !isNaN(d)){var dt=new Date(m);dt.setDate(dt.getDate()-d);rStart.value=_toIso(dt);}
}
// Per-field handlers — when you change one, the most relevant other recomputes.
function onStart(){if(rDays.value)calcMatFromStartDays();else if(rMat.value)calcDaysFromStartMat();reqAvailHint();}
function onDays(){if(rStart.value)calcMatFromStartDays();else if(rMat.value)calcStartFromMatDays();}

// หมวดค่าใช้จ่าย combo box: typing filters the popover; clicking the ▼ shows
// the FULL list regardless of typed text (so user can switch categories
// without having to clear the input first). Click outside closes.
// Defaults — used when the user hasn't customized the list via Settings.
var COST_CATEGORY_DEFAULTS=[
  'ทรายถม','หิน','ปูน/คอนกรีต/ทรายหยาบ','เหล็ก',
  'ค่าแรงผรม.รายย่อย',
  'ค่าแรง-ถมทราย','ค่าแรง-VACUUM','ค่าแรง-ปูยาง',
  'ค่าแรง-RAMP','ค่าแรง-ดึงลวด','ค่าแรง-สะพาน',
  'ค่าแรง-เสาเข็ม','ค่าแรง-ไฟฟ้าแสงสว่าง',
  'ค่าขนส่ง','น้ำมัน','ค่าเครื่องจักร','วัสดุสิ้นเปลือง','อื่นๆ'
];
// Live list — prefers the user's server-managed list (D.costCategories) if it
// exists and is non-empty; otherwise falls back to the defaults above.
Object.defineProperty(window,'COST_CATEGORIES',{get:function(){
  return (typeof D!=='undefined' && D && D.costCategories && D.costCategories.length) ? D.costCategories : COST_CATEGORY_DEFAULTS;
}});
// Distinct lighter color per category — used as a pill badge in the summary
// table so the eye can group/scan by category type. Defaults to neutral gray
// for unrecognized / custom-typed values.
function costCategoryColor(cat){
  return ({
    'ทรายถม':'#E8C880',                       // sandy tan
    'หิน':'#A8AEB8',                          // stone gray
    'คอนกรีต':'#94A8B9',                      // concrete blue-gray
    'ปูน':'#D9D2C5',                          // cement beige (legacy — kept for old data)
    'ปูน/คอนกรีต/ทรายหยาบ':'#C8B89A',         // mixed beige (cement/concrete/coarse sand)
    'ปูน/คอนกรีต/ทราย':'#C8B89A',             // legacy — old name kept so existing rows still color
    'เหล็ก':'#6B7B91',                        // steel
    'ค่าแรงผรม.รายย่อย':'#7FB069',            // generic labor green (in-house / รายย่อย)
    // Subcontract labor variants — green family with subtle activity-hinting shades.
    'ค่าแรง-ถมทราย':'#B5C580',                // sand-green hybrid
    'ค่าแรง-VACUUM':'#82B59A',                // teal-green
    'ค่าแรง-ปูยาง':'#6B8E5C',                 // dark olive (asphalt)
    'ค่าแรง-RAMP':'#A8C66C',                  // bright lime
    'ค่าแรง-ดึงลวด':'#7AA590',                // sage (wire)
    'ค่าแรง-สะพาน':'#8BC8B5',                 // mint (bridge)
    'ค่าแรง-เสาเข็ม':'#5C8553',               // forest (pile foundation)
    'ค่าแรง-ไฟฟ้าแสงสว่าง':'#C4D266',         // yellow-green (electric)
    'ค่าขนส่ง':'#6FC1E0',                     // transport sky blue
    'น้ำมัน':'#F2A878',                       // fuel peach
    'ค่าเครื่องจักร':'#B59FD6',               // equipment purple
    'วัสดุสิ้นเปลือง':'#5EB8AE',              // consumables teal
    'อื่นๆ':'#C5CDD9',                        // neutral
    '(ไม่ระบุหมวด)':'#EBEEF2'                  // very light (unset)
  })[cat]||'#C5CDD9';
}
// Categories with dark backgrounds — need white text instead of dark.
var COST_DARK_BGS={'เหล็ก':1,'หิน':1,'คอนกรีต':1,'ค่าแรง-ปูยาง':1,'ค่าแรง-เสาเข็ม':1};
function costCategoryPill(cat){
  var bg=costCategoryColor(cat);
  var fg=COST_DARK_BGS[cat]?'#fff':'#222';
  return '<span style="display:inline-block;background:'+bg+';color:'+fg+';padding:1px 9px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap">'+esc(cat)+'</span>';
}
function costCatShow(showAll){
  var pop=document.getElementById('costCatPop'); if(!pop) return;
  var q=showAll?'':String(document.getElementById('rCostCat').value||'').trim().toLowerCase();
  var items=COST_CATEGORIES.filter(function(c){return !q||c.toLowerCase().indexOf(q)>=0;});
  if(!items.length){
    pop.innerHTML='<div style="padding:10px;color:var(--mut);font-size:12px;font-style:italic">— ไม่มีรายการที่ตรง — ใช้คำที่พิมพ์เอง</div>';
  } else {
    // Render as a uniform 2-column grid — each chip fills its cell so the
    // popover reads as an organised palette rather than a ragged cloud.
    var cells=items.map(function(c){
      var bg=costCategoryColor(c);
      var fg=COST_DARK_BGS[c]?'#fff':'#222';
      return '<div onclick="costCatPick(\''+c.replace(/\x27/g,'&#39;')+'\')" '
        +'title="'+esc(c)+'" '
        +'style="padding:5px 10px;cursor:pointer;font-size:12px;background:'+bg+';color:'+fg+';border-radius:6px;font-weight:600;line-height:1.2;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:transform .1s ease,box-shadow .1s ease" '
        +'onmouseenter="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 2px 4px rgba(0,0,0,.15)\'" '
        +'onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'\'">'+esc(c)+'</div>';
    }).join('');
    pop.innerHTML='<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:8px">'+cells+'</div>';
  }
  pop.style.display='block';
}
function costCatToggle(){
  var pop=document.getElementById('costCatPop'); if(!pop) return;
  if(pop.style.display==='block'){pop.style.display='none';return;}
  costCatShow(true);
}
function costCatPick(v){
  document.getElementById('rCostCat').value=v;
  document.getElementById('costCatPop').style.display='none';
  if(typeof reqAvailHint==='function') reqAvailHint();
}
// Close the popover on any click outside its container.
document.addEventListener('click',function(e){
  if(!e.target.closest('.combo-cost')){
    var pop=document.getElementById('costCatPop');
    if(pop) pop.style.display='none';
  }
});
function onMat(){if(rStart.value)calcDaysFromStartMat();else if(rDays.value)calcStartFromMatDays();}
// Back-compat shim — older code paths may still call calcMat().
function calcMat(){calcMatFromStartDays();}
function saveReq(){
  var dRe=/^\d{1,2}\/\d{1,2}\/\d{4}$/;
  var beneficiary=document.getElementById('rBeneficiary').value.trim();
  var refDocFrom=document.getElementById('rRefDocFrom').value.trim();
  var refDocTo=document.getElementById('rRefDocTo').value.trim();
  var p={project:rProj.value,company:document.getElementById('rCo').value,
         facilityNo:rType.value,amount:moneyVal(rAmt.value),
         maturity:isoToDMY(rMat.value),
         start:isoToDMY(document.getElementById('rStart').value),
         status:rStatus.value,source:rSrc.value,
         costCategory:document.getElementById('rCostCat').value.trim(),
         docFrom:rDocFrom.value.trim(),docTo:rDocTo.value.trim(),
         refDocFrom:refDocFrom,refDocTo:refDocTo,
         note:rNote.value,beneficiary:beneficiary,ref:rRef.value};
  if(!p.project||!p.facilityNo||!p.amount||!beneficiary){toast('กรอกข้อมูลที่จำเป็น (*) ให้ครบ');return;}
  if(p.docFrom&&!dRe.test(p.docFrom)||p.docTo&&!dRe.test(p.docTo)){toast('วันที่เอกสารแนบต้องเป็นรูปแบบ dd/mm/yyyy');return;}
  if(refDocFrom&&!dRe.test(refDocFrom)||refDocTo&&!dRe.test(refDocTo)){toast('วันที่เอกสารอ้างอิงต้องเป็นรูปแบบ dd/mm/yyyy');return;}
  var btn=document.getElementById('rSave');btn.disabled=true;btn.textContent='กำลังบันทึก…';
  var done=function(){btn.disabled=false;btn.textContent='บันทึก';
    close_('ovlReq');reqFormFill(null);editId=null;
    document.getElementById('rAvail').textContent='';reload(editMsg);};
  var fail=function(e){btn.disabled=false;btn.textContent='บันทึก';toast('ผิดพลาด: '+(e.message||e));};
  var editMsg=editId?'แก้ไขคำขอแล้ว':'บันทึกคำขอแล้ว';
  if(editId){p.id=editId;google.script.run.withSuccessHandler(done).withFailureHandler(fail).updateRequest(p);}
  else google.script.run.withSuccessHandler(done).withFailureHandler(fail).addRequest(p);
}
// Fill / clear the request modal fields (r=null clears for "add" mode).
function reqFormFill(r){
  document.getElementById('rProj').value=r?r.project:'';
  reqProjChange();
  document.getElementById('rType').value=r?String(r.facilityNo):'';
  rAmt.value=r?Number(r.amount||0).toLocaleString('en-US'):'';rMat.value=r?dmyToISO(r.maturity||''):'';
  document.getElementById('rStart').value='';document.getElementById('rDays').value='';
  rSrc.value=r?(r.source||''):'';rDocFrom.value=r?(r.docFrom||''):'';
  document.getElementById('rCostCat').value=r?(r.costCategory||''):'';
  rDocTo.value=r?(r.docTo||''):'';rNote.value=r?(r.note||''):'';
  document.getElementById('rBeneficiary').value=r?(r.beneficiary||''):'';
  document.getElementById('rRefDocFrom').value=r?(r.refDocFrom||''):'';
  document.getElementById('rRefDocTo').value=r?(r.refDocTo||''):'';
  rRef.value=r?(r.ref||''):'';
  rStatus.value=r?(String(r.status).toLowerCase()==='active'?'อนุมัติแล้ว':(r.status||'คำขอใหม่')):'คำขอใหม่';
  reqAvailHint();
}
function findReq(id){return (D.transactions||[]).filter(function(x){return x.id===id;})[0];}
function editReq(id){
  var r=findReq(id);if(!r)return;
  editId=id;
  document.getElementById('reqTitle').textContent='แก้ไขคำขอ';
  reqFormFill(r);
  close_('ovlView');document.getElementById('ovlReq').classList.add('on');
}
function authorize(id){
  confirmBox('ยืนยันอนุมัติรายการนี้? วงเงินจะถูกนับเป็นใช้ไปและดอกเบี้ยจะเริ่มเดิน',function(){
    google.script.run.withSuccessHandler(function(r){
      if(r&&r.ok)reload('อนุมัติแล้ว');else toast(r&&r.error||'ไม่สำเร็จ');})
     .withFailureHandler(function(e){toast('ผิดพลาด: '+(e.message||e));})
     .setTxnStatus({id:id,status:'อนุมัติแล้ว'});
  },'อนุมัติ');
}
function viewReq(id,num){
  var r=findReq(id);if(!r)return;
  document.getElementById('vTitle').textContent='คำขอ'+(num?' #'+num:'')+' – '+kindShort(r.facilityNo);
  var rows=[
    ['วันที่ขอ',esc(r.date)+(r.updated&&r.updated!==r.date?' <span class="muted" style="font-weight:400">(แก้ไข '+esc(r.updated)+')</span>':'')],
    ['บริษัท',esc(projCompany(r.project))],
    ['โครงการ',esc(projThShort(r.project))],
    ['ประเภทสินเชื่อ',kindPill(r.facilityNo)],
    ['จำนวนเงิน',money(r.amount)+' บาท'],
    ['วันครบกำหนด',esc(r.maturity||r.due||'—')],
    ['ผู้รับผลประโยชน์',esc(r.beneficiary||'—')],
    ['เลขที่เอกสารอ้างอิง',esc(r.ref||'—')],
    ['วันที่เอกสารอ้างอิง',(r.refDocFrom||r.refDocTo)?esc((r.refDocFrom||'—')+(r.refDocTo?' ถึง '+r.refDocTo:'')):'—'],
    ['เอกสารแนบ',esc(attachText(r))],
    ['หมวดค่าใช้จ่าย',esc(r.costCategory||'—')],
    ['สถานะ',statusPill(r.status)],
    ['หมายเหตุ',esc(r.note||'—')]
  ];
  if(r.paidDate)rows.push(['ชำระเมื่อ',esc(r.paidDate)]);
  document.getElementById('viewBody').innerHTML=rows.map(function(kv){
    return '<div class="vrow"><div class="vlbl">'+kv[0]+'</div><div class="vval">'+kv[1]+'</div></div>';
  }).join('');
  document.getElementById('vEditBtn').onclick=function(){editReq(id);};
  document.getElementById('vDelBtn').onclick=function(){close_('ovlView');delReq(id);};
  document.getElementById('ovlView').classList.add('on');
}
// In-app confirm dialog — replaces window.confirm (which exposes the Apps
// Script iframe URL "An embedded page at …googleusercontent.com says").
function confirmBox(msg,onOk,okLabel){
  document.getElementById('cfMsg').textContent=msg;
  var b=document.getElementById('cfOk');
  b.textContent=okLabel||'ตกลง';
  b.onclick=function(){close_('ovlConfirm');onOk();};
  document.getElementById('ovlConfirm').classList.add('on');
}
function delReq(id){
  var r=findReq(id);if(!r)return;
  confirmBox('ลบรายการนี้? วงเงินที่ใช้ไปจะถูกปล่อยคืน',function(){
    google.script.run.withSuccessHandler(function(res){
      if(res&&res.ok)reload('ลบรายการแล้ว');else toast(res&&res.error||'ลบไม่สำเร็จ');})
     .withFailureHandler(function(e){toast('ผิดพลาด: '+(e.message||e));}).deleteRequest({id:id});
  },'ลบ');
}
function saveTxn(){
  var p={project:tProj.value,facilityNo:tType.value,ref:tRef.value,
         desc:tDesc.value,start:isoToDMY(tStart.value),due:isoToDMY(tDue.value),
         amount:moneyVal(tAmt.value),note:tNote.value};
  if(!p.project||!p.facilityNo||!p.amount){toast('กรอกข้อมูลที่จำเป็น (*) ให้ครบ');return;}
  var btn=document.getElementById('tSave');btn.disabled=true;btn.textContent='กำลังบันทึก…';
  google.script.run.withSuccessHandler(function(){btn.disabled=false;btn.textContent='บันทึก';
    close_('ovlTxn');tRef.value='';tDesc.value='';tAmt.value='';tStart.value='';tDue.value='';
    tNote.value='';reload('บันทึกรายการแล้ว');})
   .withFailureHandler(function(e){btn.disabled=false;btn.textContent='บันทึก';toast('ผิดพลาด: '+(e.message||e));})
   .addTransaction(p);
}
function settle(id){
  confirmBox('ยืนยันชำระ/ปิดรายการนี้? วงเงินจะถูกปล่อยคืนและดอกเบี้ยจะหยุดเดิน',function(){
    google.script.run.withSuccessHandler(function(r){
      if(r&&r.ok)reload('ปิดรายการแล้ว');else toast(r&&r.error||'ไม่สำเร็จ');})
     .withFailureHandler(function(e){toast('ผิดพลาด: '+(e.message||e));}).settleTxn({id:id});
  },'ชำระ');
}
function decide(id,dec){
  confirmBox('ยืนยัน "'+dec+'" คำขอนี้?',function(){
    google.script.run.withSuccessHandler(function(r){
      if(r&&r.ok)reload(dec+'แล้ว');else toast(r&&r.error||'ไม่สำเร็จ');})
     .withFailureHandler(function(e){toast('ผิดพลาด: '+(e.message||e));}).decideRequest({id:id,decision:dec});
  },dec);
}
function reload(msg){toast(msg);google.script.run.withSuccessHandler(function(d){D=d;render();}).getData();}
