-- ═══════════════════════════════════════════════════════════════════════════
-- ปฐมนิเทศพนักงานใหม่ — คำแปลไทยของเนื้อหา และลิงก์เอกสาร 8 ฉบับ
--
-- สร้างจาก backend/scripts/extract-onboarding.mjs --migration ไม่ได้พิมพ์มือ
-- คำแปลทุกบรรทัดมาจาก TH_DICT ใน translations.html ของลูกค้าตรงตัว จับคู่ด้วย
-- ข้อความอังกฤษเดิมแบบเท่ากันเป๊ะ — ไม่มีการแปลเพิ่มเองแม้แต่ข้อเดียว
--
-- เพิ่มคอลัมน์เท่านั้น ไม่แก้ ไม่ลบของเดิม: โค้ดที่ยังไม่รู้จักคอลัมน์ *_th
-- อ่านคอลัมน์อังกฤษเดิมได้เหมือนเคย ระบบ dev รัน migration กับฐานข้อมูลจริง
-- ตอนบูต ไฟล์นี้จึงต้องปลอดภัยกับโค้ดรุ่นก่อนหน้าด้วย
--
-- migration 0059 สร้าง ob_documents ไว้โดยไม่มีที่เก็บลิงก์ ทั้งที่เนื้อหา
-- ต้นฉบับมีทั้ง viewUrl (เปิดอ่านในเบราว์เซอร์) และ downloadUrl (บังคับ
-- ดาวน์โหลด) — เอกสารสองชนิดใช้รูป URL ต่างกัน (ไฟล์ใน Drive กับ Google Doc)
-- จึงเก็บสองคอลัมน์ ไม่ใช่คำนวณอันหนึ่งจากอีกอันหนึ่ง
-- ═══════════════════════════════════════════════════════════════════════════

alter table ob_items      add column if not exists text_th     text;
alter table ob_phases     add column if not exists eyebrow_th  text;
alter table ob_phases     add column if not exists title_th    text;
alter table ob_phases     add column if not exists closing_th  text;
alter table ob_blocks     add column if not exists heading_th  text;
alter table ob_documents  add column if not exists title_th    text;
alter table ob_documents  add column if not exists descr_th    text;
alter table ob_documents  add column if not exists view_url    text;
alter table ob_documents  add column if not exists download_url text;

-- ใบเสร็จการอัปโหลด: ชนิดไฟล์ที่ส่งกลับตอนเปิดดู (file_name/storage_key มีอยู่แล้ว)
alter table ob_doc_submissions add column if not exists content_type text;

comment on column ob_items.text_th is
  'คำแปลไทยจาก TH_DICT ของลูกค้า · ว่าง = ยังไม่มีคำแปล ให้หน้าจอถอยไปใช้ text อังกฤษ';
comment on column ob_documents.view_url is
  'ลิงก์เปิดอ่านเอกสารต้นแบบในเบราว์เซอร์ (Drive preview / Google Docs)';
comment on column ob_documents.download_url is
  'ลิงก์บังคับดาวน์โหลดเอกสารต้นแบบ — ไม่ใช่ไฟล์ที่พนักงานอัปโหลดกลับ';


-- ── หัวบล็อก 3 ข้อความ (ใช้ซ้ำทั้ง 45 บล็อก) ──
update ob_blocks set heading_th = 'เอกสารที่ต้องศึกษา' where heading = 'Required Reading';
update ob_blocks set heading_th = 'ความรู้ที่จำเป็น' where heading = 'Knowledge Requirements';
update ob_blocks set heading_th = 'ผลงานที่ต้องส่งมอบ' where heading = 'Required Outputs';

-- ── 15 เฟส: eyebrow + title (+ closing ถ้ามี) ──
update ob_phases set eyebrow_th = 'บัญชี · ระยะที่ 1 (วันที่ 1–30)', title_th = 'ระยะพื้นฐาน: วินัยด้านเอกสารและการบันทึกข้อมูล', closing_th = null where id = 'accounting-day-1-30';
update ob_phases set eyebrow_th = 'บัญชี · ระยะที่ 2 (วันที่ 31–60)', title_th = 'ระยะควบคุม: การกระทบยอดและการปฏิบัติตามข้อกำหนด', closing_th = null where id = 'accounting-day-31-60';
update ob_phases set eyebrow_th = 'บัญชี · ระยะที่ 3 (วันที่ 61–90)', title_th = 'ระยะรับผิดชอบ: ความถูกต้องของการรายงานและความพร้อมตรวจสอบ', closing_th = 'คุณผ่านทั้งสามระยะของการปฐมนิเทศสำหรับแผนกนี้เรียบร้อยแล้ว' where id = 'accounting-day-61-90';
update ob_phases set eyebrow_th = 'การเงิน · ระยะที่ 1 (วันที่ 1–30)', title_th = 'ระยะพื้นฐาน: ความตระหนักด้านสภาพคล่องและวินัยกระแสเงินสด', closing_th = null where id = 'finance-day-1-30';
update ob_phases set eyebrow_th = 'การเงิน · ระยะที่ 2 (วันที่ 31–60)', title_th = 'ระยะควบคุม: ความแม่นยำในการพยากรณ์และการติดตามความเสี่ยงด้านเงินทุน', closing_th = null where id = 'finance-day-31-60';
update ob_phases set eyebrow_th = 'การเงิน · ระยะที่ 3 (วันที่ 61–90)', title_th = 'ระยะรับผิดชอบ: เสถียรภาพทางการเงินและการควบคุมสภาพคล่องเชิงกลยุทธ์', closing_th = 'คุณผ่านทั้งสามระยะของการปฐมนิเทศสำหรับแผนกนี้เรียบร้อยแล้ว' where id = 'finance-day-61-90';
update ob_phases set eyebrow_th = 'จัดซื้อ · ระยะที่ 1 (วันที่ 1–30)', title_th = 'ระยะพื้นฐาน: การควบคุมกระบวนการและวินัยการอนุมัติ', closing_th = null where id = 'procurement-day-1-30';
update ob_phases set eyebrow_th = 'จัดซื้อ · ระยะที่ 2 (วันที่ 31–60)', title_th = 'ระยะควบคุม: ประสิทธิภาพต้นทุนและการบริหารความเสี่ยงผู้ขาย', closing_th = null where id = 'procurement-day-31-60';
update ob_phases set eyebrow_th = 'จัดซื้อ · ระยะที่ 3 (วันที่ 61–90)', title_th = 'ระยะรับผิดชอบ: การวางแผนจัดซื้อเชิงกลยุทธ์และการสอดคล้องด้านสภาพคล่อง', closing_th = 'คุณผ่านทั้งสามระยะของการปฐมนิเทศสำหรับแผนกนี้เรียบร้อยแล้ว' where id = 'procurement-day-61-90';
update ob_phases set eyebrow_th = 'บริหารทรัพย์สิน · ระยะที่ 1 (วันที่ 1–30)', title_th = 'ระยะพื้นฐาน: การขึ้นทะเบียนทรัพย์สินและวินัยการควบคุม', closing_th = null where id = 'property-day-1-30';
update ob_phases set eyebrow_th = 'บริหารทรัพย์สิน · ระยะที่ 2 (วันที่ 31–60)', title_th = 'ระยะควบคุม: การกระทบยอดสินค้าคงคลังและการบังคับใช้การตรวจสอบย้อนกลับ', closing_th = null where id = 'property-day-31-60';
update ob_phases set eyebrow_th = 'บริหารทรัพย์สิน · ระยะที่ 3 (วันที่ 61–90)', title_th = 'ระยะรับผิดชอบ: ความถูกต้องของทรัพย์สินและการรับรองธรรมาภิบาล', closing_th = 'คุณผ่านทั้งสามระยะของการปฐมนิเทศสำหรับแผนกนี้เรียบร้อยแล้ว' where id = 'property-day-61-90';
update ob_phases set eyebrow_th = 'วิศวกรรม · ระยะที่ 1 (วันที่ 1–30)', title_th = 'ระยะพื้นฐาน: ความแม่นยำในการวัดผลและวินัยการรายงานหน้างาน', closing_th = null where id = 'engineering-day-1-30';
update ob_phases set eyebrow_th = 'วิศวกรรม · ระยะที่ 2 (วันที่ 31–60)', title_th = 'ระยะควบคุม: การติดตามผลิตภาพและเอกสารรายได้', closing_th = null where id = 'engineering-day-31-60';
update ob_phases set eyebrow_th = 'วิศวกรรม · ระยะที่ 3 (วันที่ 61–90)', title_th = 'ระยะรับผิดชอบ: ผลการดำเนินงานของหน่วยงานและการควบคุมผลต่างต้นทุน', closing_th = 'คุณผ่านทั้งสามระยะของการปฐมนิเทศสำหรับแผนกนี้เรียบร้อยแล้ว' where id = 'engineering-day-61-90';

-- ── 8 เอกสาร: ชื่อ คำบรรยาย และลิงก์ดู/ดาวน์โหลด ──
update ob_documents set title_th = 'ใบสมัครงาน', descr_th = 'ข้อมูลส่วนตัว การศึกษา และประวัติการทำงานของคุณที่บันทึกไว้ก่อนจัดทำสัญญาจ้าง', view_url = 'https://drive.google.com/file/d/1rBiYCcQowvAsDxCDdidLHVpEbVCmsP8C/view', download_url = 'https://drive.google.com/uc?export=download&id=1rBiYCcQowvAsDxCDdidLHVpEbVCmsP8C' where id = 'application-form';
update ob_documents set title_th = 'สัญญาจ้างงาน', descr_th = 'ข้อตกลงอย่างเป็นทางการที่ครอบคลุมตำแหน่งงาน ค่าตอบแทน และเงื่อนไขการจ้างงานกับ VCB', view_url = 'https://docs.google.com/document/d/1-rGE5UXrP1sf891fIiD2TDHE-3XYkLrU/edit', download_url = 'https://docs.google.com/document/d/1-rGE5UXrP1sf891fIiD2TDHE-3XYkLrU/export?format=docx' where id = 'employment-contract';
update ob_documents set title_th = 'ข้อตกลงการรักษาความลับ', descr_th = 'ข้อผูกพันของคุณในการรักษาความลับข้อมูลของบริษัท โครงการ และลูกค้า', view_url = 'https://drive.google.com/file/d/1h6wtUT2WT2QZvJltZRG-vaE3gCLhFTf3/view', download_url = 'https://drive.google.com/uc?export=download&id=1h6wtUT2WT2QZvJltZRG-vaE3gCLhFTf3' where id = 'nda';
update ob_documents set title_th = 'แบบฟอร์มยินยอมข้อมูลส่วนบุคคล (PDPA)', descr_th = 'ความยินยอมของคุณให้ VCB เก็บรวบรวม ใช้ และจัดเก็บข้อมูลส่วนบุคคลในฐานะพนักงาน', view_url = 'https://drive.google.com/file/d/1b9rxQkdv-u1GddC5s4dNiLj0DGdUaPWK/view', download_url = 'https://drive.google.com/uc?export=download&id=1b9rxQkdv-u1GddC5s4dNiLj0DGdUaPWK' where id = 'pdpa-consent';
update ob_documents set title_th = 'นโยบายคุ้มครองข้อมูลส่วนบุคคล PDPA (เอกสารอ้างอิง)', descr_th = 'การรับทราบว่าคุณได้อ่านนโยบายของบริษัทเกี่ยวกับการคุ้มครองข้อมูลส่วนบุคคลแล้ว', view_url = 'https://drive.google.com/file/d/1S2De-qUCccdpJeam1lc_4Ob4VIk6_6dw/view', download_url = 'https://drive.google.com/uc?export=download&id=1S2De-qUCccdpJeam1lc_4Ob4VIk6_6dw' where id = 'pdpa-policy';
update ob_documents set title_th = 'การรับทราบนโยบายต่อต้านการทุจริต', descr_th = 'การรับทราบนโยบายไม่ยอมรับการติดสินบนและการทุจริตของ VCB', view_url = 'https://drive.google.com/file/d/1uNT9bFy0Hrj7OyaXSTUQvjm1gke7xnXF/view', download_url = 'https://drive.google.com/uc?export=download&id=1uNT9bFy0Hrj7OyaXSTUQvjm1gke7xnXF' where id = 'anti-corruption';
update ob_documents set title_th = 'แบบฟอร์มรายงานพนักงานใหม่', descr_th = 'ยืนยันวันเริ่มงานอย่างเป็นทางการและรายงานสถานะของคุณต่อฝ่ายบุคคลในวันแรก', view_url = 'https://drive.google.com/file/d/10Q1geYqL7DO-3hJYHtpnKAVJqDQ5OXKA/view', download_url = 'https://drive.google.com/uc?export=download&id=10Q1geYqL7DO-3hJYHtpnKAVJqDQ5OXKA' where id = 'reporting-form';
update ob_documents set title_th = 'แบบฟอร์มขึ้นทะเบียนภาษี', descr_th = 'เลขประจำตัวผู้เสียภาษีและรายละเอียดการหักภาษีสำหรับการขึ้นทะเบียนเงินเดือน', view_url = null, download_url = null where id = 'tax-form';

-- ── 180 ข้อเช็กลิสต์ จับคู่ด้วย id ถาวรของรายการ ──
update ob_items set text_th = 'โครงสร้างผังบัญชี' where id = 'acct-p1-read-1';
update ob_items set text_th = 'ขั้นตอนการบันทึก PR → PO → AP (กฎการบันทึกรายการในระบบ ERP)' where id = 'acct-p1-read-2';
update ob_items set text_th = 'การปฏิบัติตามภาษีมูลค่าเพิ่มและภาษีหัก ณ ที่จ่าย' where id = 'acct-p1-read-3';
update ob_items set text_th = 'ขั้นตอนใบลดหนี้ AP (ลดหนี้)' where id = 'acct-p1-read-4';
update ob_items set text_th = 'หลักการเดบิต/เครดิต และการจำแนกค่าใช้จ่ายกับสินทรัพย์' where id = 'acct-p1-know-1';
update ob_items set text_th = 'การคำนวณและบันทึกภาษีมูลค่าเพิ่ม' where id = 'acct-p1-know-2';
update ob_items set text_th = 'การบันทึกรายการ AP/AR และรายการบัญชีในระบบ Mango' where id = 'acct-p1-know-3';
update ob_items set text_th = 'การกลับรายการเจ้าหนี้กรณีคืนสินค้า เรียกเก็บเกิน หรือข้อพิพาท' where id = 'acct-p1-know-4';
update ob_items set text_th = 'รายการบันทึกในระบบ ERP ที่ถูกต้อง 15 รายการ' where id = 'acct-p1-out-1';
update ob_items set text_th = 'ตัวอย่างชุดรายการบัญชี 1 ชุด' where id = 'acct-p1-out-2';
update ob_items set text_th = 'ตัวอย่างการกระทบยอดภาษีมูลค่าเพิ่ม' where id = 'acct-p1-out-3';
update ob_items set text_th = 'กรณีศึกษาใบลดหนี้ AP ที่ทบทวนแล้ว 1 กรณี' where id = 'acct-p1-out-4';
update ob_items set text_th = 'ขั้นตอนการกระทบยอดธนาคาร' where id = 'acct-p2-read-1';
update ob_items set text_th = 'มาตรฐานการทบทวนอายุหนี้ AP/AR' where id = 'acct-p2-read-2';
update ob_items set text_th = 'นโยบายรายการค้างรับค้างจ่ายและค่าเสื่อมราคารายเดือน' where id = 'acct-p2-read-3';
update ob_items set text_th = 'มาตรฐานการบัญชีสินค้าคงคลัง IC' where id = 'acct-p2-read-4';
update ob_items set text_th = 'โครงสร้างการกระทบยอดธนาคาร (ประกอบการกระทบยอดบัญชีแยกประเภท)' where id = 'acct-p2-know-1';
update ob_items set text_th = 'การทบทวนอายุหนี้ AP/AR' where id = 'acct-p2-know-2';
update ob_items set text_th = 'หลักการบันทึกรายการค้างรับค้างจ่ายและค่าเสื่อมราคา' where id = 'acct-p2-know-3';
update ob_items set text_th = 'การบัญชีสินค้าคงคลัง IC และการบันทึกโอนต้นทุนเข้าบัญชีแยกประเภท' where id = 'acct-p2-know-4';
update ob_items set text_th = 'รายงานการกระทบยอดธนาคาร' where id = 'acct-p2-out-1';
update ob_items set text_th = 'สรุปรายการค้างรับค้างจ่าย' where id = 'acct-p2-out-2';
update ob_items set text_th = 'สรุปอายุหนี้ AR/AP' where id = 'acct-p2-out-3';
update ob_items set text_th = 'บันทึกทบทวนการบัญชีสินค้าคงคลัง IC 1 ฉบับ' where id = 'acct-p2-out-4';
update ob_items set text_th = 'โครงสร้างงบการเงิน' where id = 'acct-p3-read-1';
update ob_items set text_th = 'มาตรฐานการรับรู้รายได้' where id = 'acct-p3-read-2';
update ob_items set text_th = 'ข้อกำหนดเอกสารสำหรับการตรวจสอบ' where id = 'acct-p3-read-3';
update ob_items set text_th = 'แนวทางการประสานงานตรวจสอบภายนอก' where id = 'acct-p3-read-4';
update ob_items set text_th = 'ขั้นตอนการปิดบัญชีแยกประเภทสิ้นเดือน' where id = 'acct-p3-know-1';
update ob_items set text_th = 'การทบทวนงบทดลอง' where id = 'acct-p3-know-2';
update ob_items set text_th = 'ข้อกำหนดการยื่นภาษีมูลค่าเพิ่ม/ภาษีหัก ณ ที่จ่าย/ภาษีเงินได้นิติบุคคล' where id = 'acct-p3-know-3';
update ob_items set text_th = 'การประสานงานตรวจสอบภายนอกและการรายงานต้นทุนต่อโครงการสำหรับผู้บริหาร' where id = 'acct-p3-know-4';
update ob_items set text_th = 'แผ่นทบทวนงบทดลอง' where id = 'acct-p3-out-1';
update ob_items set text_th = 'ร่างงบการเงิน' where id = 'acct-p3-out-2';
update ob_items set text_th = 'รายการตรวจสอบความพร้อมสำหรับการตรวจสอบภายใน' where id = 'acct-p3-out-3';
update ob_items set text_th = 'รายงานต้นทุนต่อโครงการสำหรับผู้บริหาร 1 ฉบับ' where id = 'acct-p3-out-4';
update ob_items set text_th = 'โครงสร้างวงจรเงินสดของบริษัท — แบบจำลองกระแสเงินสดตามโครงการ ซึ่งขับเคลื่อนด้วยเงินงวดที่ได้รับการรับรองจากโครงการภาครัฐ' where id = 'fin-p1-read-1';
update ob_items set text_th = 'กลไกเงินล่วงหน้าและเงินประกันผลงาน — เงินล่วงหน้าจะถูกหักออกจากการเบิกจ่ายตามลำดับ ส่วนเงินประกันผลงานจะถูกกักไว้จนกว่าจะถึงจุดสำคัญของความสำเร็จ' where id = 'fin-p1-read-2';
update ob_items set text_th = 'ขั้นตอนเอกสารในระบบ ERP — การจ่ายเงินทุกรายการต้องเป็นไปตามลำดับ PR → PO → AP → การอนุมัติ → การจ่ายเงิน' where id = 'fin-p1-read-3';
update ob_items set text_th = 'คู่มือการโอนเงินระหว่างกลุ่มบริษัทร่วมทุน (VCB/CVE/VN JV)' where id = 'fin-p1-read-4';
update ob_items set text_th = 'กระแสเงินสดจากการดำเนินงานเทียบกับการจัดหาเงินทุน' where id = 'fin-p1-know-1';
update ob_items set text_th = 'ผลกระทบของเงินประกันผลงานต่อสภาพคล่อง' where id = 'fin-p1-know-2';
update ob_items set text_th = 'กระบวนการหักเงินล่วงหน้า' where id = 'fin-p1-know-3';
update ob_items set text_th = 'การโอนเงินระหว่างกลุ่มบริษัทร่วมทุนและการบันทึกรายการ AR แบบไม่มีใบแจ้งหนี้' where id = 'fin-p1-know-4';
update ob_items set text_th = 'รายการบันทึกกำไรขาดทุนที่ถูกต้อง 10 รายการ' where id = 'fin-p1-out-1';
update ob_items set text_th = 'การกระทบยอดธนาคารที่สมบูรณ์ 1 รายการ' where id = 'fin-p1-out-2';
update ob_items set text_th = 'การระบุความเสี่ยงด้านสภาพคล่อง 3 รายการ' where id = 'fin-p1-out-3';
update ob_items set text_th = 'รายการโอนเงินระหว่างกลุ่มบริษัทที่ทบทวนแล้ว 1 รายการ' where id = 'fin-p1-out-4';
update ob_items set text_th = 'โครงสร้างการผ่อนชำระเงินกู้' where id = 'fin-p2-read-1';
update ob_items set text_th = 'การคำนวณดอกเบี้ยตั๋วสัญญาใช้เงิน' where id = 'fin-p2-read-2';
update ob_items set text_th = 'ขั้นตอนการติดตามบัญชีเงินประกันผลงาน' where id = 'fin-p2-read-3';
update ob_items set text_th = 'คู่มือการขายลด AVAL (การขายตั๋วแลกเงิน)' where id = 'fin-p2-read-4';
update ob_items set text_th = 'การติดตามกระแสเงินสดระดับโครงการ' where id = 'fin-p2-know-1';
update ob_items set text_th = 'วิธีการพยากรณ์สภาพคล่อง' where id = 'fin-p2-know-2';
update ob_items set text_th = 'พื้นฐานทะเบียนวงเงินสินเชื่อ (ตั๋วสัญญาใช้เงิน, AVAL, หนังสือค้ำประกัน, L/C)' where id = 'fin-p2-know-3';
update ob_items set text_th = 'การเปรียบเทียบอัตราขายลด AVAL ระหว่างธนาคารเพื่อหาอัตราที่ดีที่สุด' where id = 'fin-p2-know-4';
update ob_items set text_th = 'การคาดการณ์เงินสด 3 เดือน' where id = 'fin-p2-out-1';
update ob_items set text_th = 'แผ่นติดตามเงินประกันผลงาน' where id = 'fin-p2-out-2';
update ob_items set text_th = 'การวิเคราะห์ผลต่างต้นทุน' where id = 'fin-p2-out-3';
update ob_items set text_th = 'การเปรียบเทียบอัตราขายลด AVAL 1 รายการ' where id = 'fin-p2-out-4';
update ob_items set text_th = 'วิธีการวิเคราะห์จุดคุ้มทุน' where id = 'fin-p3-read-1';
update ob_items set text_th = 'แนวทางความสามารถในการชำระหนี้' where id = 'fin-p3-read-2';
update ob_items set text_th = 'ขั้นตอนการทดสอบภาวะวิกฤตสภาพคล่อง' where id = 'fin-p3-read-3';
update ob_items set text_th = 'คู่มือการบริหารวงเงินสินเชื่อและการตรวจสอบบัญชีธนาคาร' where id = 'fin-p3-read-4';
update ob_items set text_th = 'ความสามารถในการชำระหนี้' where id = 'fin-p3-know-1';
update ob_items set text_th = 'การทดสอบภาวะวิกฤตสภาพคล่อง' where id = 'fin-p3-know-2';
update ob_items set text_th = 'ความอ่อนไหวของอัตรากำไร' where id = 'fin-p3-know-3';
update ob_items set text_th = 'การเลือกวงเงินที่จะเบิกใช้สำหรับแต่ละรอบการจ่ายเงิน' where id = 'fin-p3-know-4';
update ob_items set text_th = 'รายงานการเงินรายเดือนอย่างอิสระ' where id = 'fin-p3-out-1';
update ob_items set text_th = 'สถานการณ์จำลองภาวะวิกฤตสภาพคล่อง' where id = 'fin-p3-out-2';
update ob_items set text_th = 'บันทึกความเสี่ยงทางการเงิน' where id = 'fin-p3-out-3';
update ob_items set text_th = 'การทบทวนการใช้วงเงินสินเชื่อ 1 รายการ' where id = 'fin-p3-out-4';
update ob_items set text_th = 'ขั้นตอนการทำงาน PR → PO → IC → AP' where id = 'proc-p1-read-1';
update ob_items set text_th = 'ตารางอำนาจอนุมัติ (การอนุมัติ PR สองระดับ)' where id = 'proc-p1-read-2';
update ob_items set text_th = 'กระบวนการขึ้นทะเบียนผู้ขาย' where id = 'proc-p1-read-3';
update ob_items set text_th = 'คู่มือการขึ้นทะเบียนผู้ขาย/ผู้รับเหมาช่วงที่ผ่านคุณสมบัติ (AVL)' where id = 'proc-p1-read-4';
update ob_items set text_th = 'ลำดับชั้นการอนุมัติ (ผู้จัดการโครงการหน้างาน → วิศวกรสำนักงานใหญ่)' where id = 'proc-p1-know-1';
update ob_items set text_th = 'กระบวนการเปรียบเทียบราคา' where id = 'proc-p1-know-2';
update ob_items set text_th = 'การตรวจสอบงบประมาณเทียบกับ BOQ' where id = 'proc-p1-know-3';
update ob_items set text_th = 'เกณฑ์คุณสมบัติด้านความสามารถ การเงิน และความปลอดภัยสำหรับทะเบียน AVL' where id = 'proc-p1-know-4';
update ob_items set text_th = 'รอบ PR/PO ที่ถูกต้องตามข้อกำหนด 5 รอบ' where id = 'proc-p1-out-1';
update ob_items set text_th = 'รายงานเปรียบเทียบผู้ขาย' where id = 'proc-p1-out-2';
update ob_items set text_th = 'รายการตรวจสอบความครบถ้วนของเอกสาร' where id = 'proc-p1-out-3';
update ob_items set text_th = 'ร่างแบบให้คะแนนคุณสมบัติผู้ขาย 1 ชุด' where id = 'proc-p1-out-4';
update ob_items set text_th = 'แนวทางการเปรียบเทียบมาตรฐานต้นทุน' where id = 'proc-p2-read-1';
update ob_items set text_th = 'ขั้นตอนการจัดตารางการส่งมอบให้สอดคล้อง' where id = 'proc-p2-read-2';
update ob_items set text_th = 'เกณฑ์การประเมินความเสี่ยงผู้ขาย' where id = 'proc-p2-read-3';
update ob_items set text_th = 'คู่มือการจัดระดับชั้นผู้ขาย (Tier 1–4)' where id = 'proc-p2-read-4';
update ob_items set text_th = 'วิธีการเปรียบเทียบมาตรฐานต้นทุน' where id = 'proc-p2-know-1';
update ob_items set text_th = 'การจัดตารางการส่งมอบให้สอดคล้อง' where id = 'proc-p2-know-2';
update ob_items set text_th = 'การประเมินความเสี่ยงผู้ขาย' where id = 'proc-p2-know-3';
update ob_items set text_th = 'การจัดระดับชั้นผู้ขายและการดูแลฐานข้อมูลราคาตลาด' where id = 'proc-p2-know-4';
update ob_items set text_th = 'การวิเคราะห์การประหยัดต้นทุน' where id = 'proc-p2-out-1';
update ob_items set text_th = 'สรุปความเสี่ยงผู้ขาย' where id = 'proc-p2-out-2';
update ob_items set text_th = 'แผนการจัดตารางการส่งมอบ' where id = 'proc-p2-out-3';
update ob_items set text_th = 'การทบทวนการจัดระดับชั้นผู้ขาย 1 รายการ' where id = 'proc-p2-out-4';
update ob_items set text_th = 'คู่มือผลกระทบของการจัดซื้อต่อสภาพคล่อง' where id = 'proc-p3-read-1';
update ob_items set text_th = 'นโยบายความเสี่ยงจากสินค้าคงคลังส่วนเกิน' where id = 'proc-p3-read-2';
update ob_items set text_th = 'มาตรฐานความเสี่ยงจากการกระจุกตัวของผู้ขาย' where id = 'proc-p3-read-3';
update ob_items set text_th = 'คู่มือการปรับโครงสร้างหนี้เจ้าหนี้และการหักกลบ AVAL' where id = 'proc-p3-read-4';
update ob_items set text_th = 'ผลกระทบของการจัดซื้อต่อสภาพคล่อง' where id = 'proc-p3-know-1';
update ob_items set text_th = 'ความเสี่ยงจากสินค้าคงคลังส่วนเกิน' where id = 'proc-p3-know-2';
update ob_items set text_th = 'ความเสี่ยงจากการกระจุกตัวของผู้ขาย' where id = 'proc-p3-know-3';
update ob_items set text_th = 'การปรับโครงสร้างหนี้เจ้าหนี้และการจัดการหักกลบ AVAL' where id = 'proc-p3-know-4';
update ob_items set text_th = 'การพยากรณ์ช่วงการจัดซื้อ' where id = 'proc-p3-out-1';
update ob_items set text_th = 'การวิเคราะห์การกระจุกตัวของผู้ขาย' where id = 'proc-p3-out-2';
update ob_items set text_th = 'บันทึกการป้องกันการจัดซื้อเกินความจำเป็น' where id = 'proc-p3-out-3';
update ob_items set text_th = 'ข้อเสนอการปรับโครงสร้างหนี้เจ้าหนี้ 1 ฉบับ' where id = 'proc-p3-out-4';
update ob_items set text_th = 'นโยบายการจำแนกประเภททรัพย์สิน' where id = 'prop-p1-read-1';
update ob_items set text_th = 'มาตรฐานการกำหนดรหัสคลังสินค้า' where id = 'prop-p1-read-2';
update ob_items set text_th = 'คู่มือการติดป้ายและกำหนดหมายเลขทรัพย์สิน' where id = 'prop-p1-read-3';
update ob_items set text_th = 'คู่มือการบริหารยานพาหนะและการติดตาม GPS' where id = 'prop-p1-read-4';
update ob_items set text_th = 'หลักการจำแนกประเภททรัพย์สิน (ข้อมูลหลัก FA: ประเภท/ค่าเสื่อมราคา/สถานที่/อัตรา)' where id = 'prop-p1-know-1';
update ob_items set text_th = 'โครงสร้างรหัสคลังสินค้า' where id = 'prop-p1-know-2';
update ob_items set text_th = 'ข้อกำหนดเอกสารการโอนย้าย' where id = 'prop-p1-know-3';
update ob_items set text_th = 'การติดตามยานพาหนะ/GPS และการติดตามชั่วโมงการใช้งานเครื่องจักร' where id = 'prop-p1-know-4';
update ob_items set text_th = 'ทรัพย์สินที่ขึ้นทะเบียนแล้ว 10 รายการ' where id = 'prop-p1-out-1';
update ob_items set text_th = 'เอกสารการโอนย้ายทรัพย์สิน' where id = 'prop-p1-out-2';
update ob_items set text_th = 'รายการตรวจสอบหมายเลขเครื่อง' where id = 'prop-p1-out-3';
update ob_items set text_th = 'สรุปการใช้งานยานพาหนะ 1 ฉบับ' where id = 'prop-p1-out-4';
update ob_items set text_th = 'ขั้นตอนการกระทบยอดระหว่างของจริงกับระบบ ERP' where id = 'prop-p2-read-1';
update ob_items set text_th = 'พื้นฐานค่าเสื่อมราคา' where id = 'prop-p2-read-2';
update ob_items set text_th = 'นโยบายการควบคุมการจัดสรรตามพื้นที่' where id = 'prop-p2-read-3';
update ob_items set text_th = 'คู่มือการวางแผนบำรุงรักษาเชิงป้องกัน (PM)' where id = 'prop-p2-read-4';
update ob_items set text_th = 'การกระทบยอดระหว่างของจริงกับระบบ ERP (การนับทรัพย์สินสิ้นเดือน)' where id = 'prop-p2-know-1';
update ob_items set text_th = 'พื้นฐานการบันทึกค่าเสื่อมราคา' where id = 'prop-p2-know-2';
update ob_items set text_th = 'การควบคุมการจัดสรรตามพื้นที่ (การโอนย้ายสินค้าคงคลังระหว่างโครงการ)' where id = 'prop-p2-know-3';
update ob_items set text_th = 'การวางแผนบำรุงรักษาเชิงป้องกันและการบันทึกค่าใช้จ่ายซ่อมแซม' where id = 'prop-p2-know-4';
update ob_items set text_th = 'รายงานการตรวจสอบสินค้าคงคลัง' where id = 'prop-p2-out-1';
update ob_items set text_th = 'แผ่นกระทบยอด' where id = 'prop-p2-out-2';
update ob_items set text_th = 'การทบทวนตารางค่าเสื่อมราคา' where id = 'prop-p2-out-3';
update ob_items set text_th = 'ตารางบำรุงรักษาเชิงป้องกัน 1 ฉบับ' where id = 'prop-p2-out-4';
update ob_items set text_th = 'คู่มือการบริหารวงจรชีวิตทรัพย์สิน' where id = 'prop-p3-read-1';
update ob_items set text_th = 'ขั้นตอนการจำหน่ายทรัพย์สิน' where id = 'prop-p3-read-2';
update ob_items set text_th = 'รายการตรวจสอบการเตรียมการตรวจสอบ' where id = 'prop-p3-read-3';
update ob_items set text_th = 'คู่มือการบริหารประกันภัยโครงการ (CAR)' where id = 'prop-p3-read-4';
update ob_items set text_th = 'ขั้นตอนวงจรชีวิตทรัพย์สิน (ขึ้นทะเบียน → โอนย้าย → ตัดจำหน่าย)' where id = 'prop-p3-know-1';
update ob_items set text_th = 'ขั้นตอนการจำหน่าย/ขายเศษซาก' where id = 'prop-p3-know-2';
update ob_items set text_th = 'มาตรฐานการเตรียมการตรวจสอบ' where id = 'prop-p3-know-3';
update ob_items set text_th = 'การติดตามเบี้ยประกัน CAR วันหมดอายุ/การต่ออายุ และการจัดการเคลม' where id = 'prop-p3-know-4';
update ob_items set text_th = 'รายงานการตรวจสอบคลังสินค้า' where id = 'prop-p3-out-1';
update ob_items set text_th = 'บันทึกการประเมินความเสี่ยงทรัพย์สิน' where id = 'prop-p3-out-2';
update ob_items set text_th = 'สรุปการจำหน่ายส่วนเกิน/เศษซาก' where id = 'prop-p3-out-3';
update ob_items set text_th = 'การทบทวนการต่ออายุประกันภัยโครงการ 1 รายการ' where id = 'prop-p3-out-4';
update ob_items set text_th = 'คู่มือปฏิบัติงานวิศวกรรมพร้อมตัวอย่างเอกสาร' where id = 'eng-p1-read-1';
update ob_items set text_th = 'ศึกษาโมดูล Mango — โมดูล BD/PM ที่เกี่ยวข้องกับหน้าที่' where id = 'eng-p1-read-2';
update ob_items set text_th = 'ผังองค์กร แผนก และโครงการของบริษัท' where id = 'eng-p1-read-3';
update ob_items set text_th = 'ภาพรวมกระบวนการประมูลงานและ e-Bidding (BD)' where id = 'eng-p1-read-4';
update ob_items set text_th = 'หน้าที่ความรับผิดชอบของตำแหน่งและภาพรวมของฝ่ายวิศวกรรม' where id = 'eng-p1-know-1';
update ob_items set text_th = 'การใช้งานซอฟต์แวร์มาตรฐาน (ชุดโปรแกรม Microsoft, PDF, อีเมล)' where id = 'eng-p1-know-2';
update ob_items set text_th = 'การใช้งานโมดูล Mango ภายในขอบเขตหน้าที่ (การขึ้นทะเบียนโครงการใหม่, การควบคุมงบประมาณ)' where id = 'eng-p1-know-3';
update ob_items set text_th = 'การคัดกรองงานประมูล e-GP และเกณฑ์การตัดสินใจเข้าร่วม/ไม่เข้าร่วมประมูล' where id = 'eng-p1-know-4';
update ob_items set text_th = 'ดำเนินการตามขั้นตอนเอกสาร 02/03 ภายในขอบเขตงาน' where id = 'eng-p1-out-1';
update ob_items set text_th = 'บันทึกข้อมูลเข้าสู่ระบบ Mango' where id = 'eng-p1-out-2';
update ob_items set text_th = 'ตอบคำถามเกี่ยวกับแผนแม่บทจากแผนกต่างๆ' where id = 'eng-p1-out-3';
update ob_items set text_th = 'ร่างบันทึกการคัดกรองงานประมูล e-GP 1 ฉบับ' where id = 'eng-p1-out-4';
update ob_items set text_th = 'คู่มือ Mango — โมดูลที่เกี่ยวข้องเรียนจบแล้ว' where id = 'eng-p2-read-1';
update ob_items set text_th = 'แผนแม่บทของโครงการต่างๆ (คืบหน้าถึง 80%)' where id = 'eng-p2-read-2';
update ob_items set text_th = 'เอกสารยื่นสำนักงานสาขา' where id = 'eng-p2-read-3';
update ob_items set text_th = 'คู่มือการดำเนินการงานเพิ่มเติม (คำสั่งเปลี่ยนแปลงงาน · BD)' where id = 'eng-p2-read-4';
update ob_items set text_th = 'เอกสารยื่นประกวดราคาโครงการ' where id = 'eng-p2-know-1';
update ob_items set text_th = 'การศึกษาเอกสารยื่นสำนักงานสาขา' where id = 'eng-p2-know-2';
update ob_items set text_th = 'พื้นฐานการดำเนินการคำสั่งเปลี่ยนแปลงงาน (VO)' where id = 'eng-p2-know-3';
update ob_items set text_th = 'การเชื่อมโยงคำสั่งเปลี่ยนแปลงงานกับ BOQ หลักและการรวมรหัสต้นทุน' where id = 'eng-p2-know-4';
update ob_items set text_th = 'ปฏิบัติงานตามระยะที่ 1 ได้ด้วยความถูกต้อง 80%' where id = 'eng-p2-out-1';
update ob_items set text_th = 'จัดทำร่างชุดเอกสารยื่นประกวดราคา 1 ชุด' where id = 'eng-p2-out-2';
update ob_items set text_th = 'ติดตามคำสั่งเปลี่ยนแปลงงาน 1 รายการตั้งแต่ต้นจนจบ' where id = 'eng-p2-out-3';
update ob_items set text_th = 'การรวมรหัสต้นทุนของคำสั่งเปลี่ยนแปลงงาน 1 รายการตั้งแต่ต้นจนจบ' where id = 'eng-p2-out-4';
update ob_items set text_th = 'แผนแม่บทของโครงการต่างๆ (เรียนจบ 100%)' where id = 'eng-p3-read-1';
update ob_items set text_th = 'เอกสารประกวดราคาโครงการ (ศึกษาจบสมบูรณ์)' where id = 'eng-p3-read-2';
update ob_items set text_th = 'ข้อกำหนดการปิดโครงการ (การปรับปรุงงบประมาณครั้งสุดท้าย, รายงาน)' where id = 'eng-p3-read-3';
update ob_items set text_th = 'คู่มือแดชบอร์ดโมดูล PM — ภาพรวมสถานะโครงการ' where id = 'eng-p3-read-4';
update ob_items set text_th = 'เอกสารประกวดราคาโครงการ — ความเชี่ยวชาญเต็มรูปแบบ' where id = 'eng-p3-know-1';
update ob_items set text_th = 'ข้อกำหนดหลักฐานการต่ออายุชั้นผู้รับเหมา/คุณสมบัติ (PQ)' where id = 'eng-p3-know-2';
update ob_items set text_th = 'ขั้นตอนการปิดโครงการ' where id = 'eng-p3-know-3';
update ob_items set text_th = 'การอ่านแดชบอร์ด PM ที่รวมข้อมูลจากโมดูล BD/PO/OF/AR/AP/GL/IC' where id = 'eng-p3-know-4';
update ob_items set text_th = 'ปฏิบัติงานตามระยะที่ 1 ได้ด้วยความถูกต้อง 100% (ยอมรับข้อผิดพลาดเล็กน้อยได้)' where id = 'eng-p3-out-1';
update ob_items set text_th = 'ทบทวนภาพรวมสถานะโครงการ 1 ครั้งจนเสร็จสมบูรณ์' where id = 'eng-p3-out-2';
update ob_items set text_th = 'จัดเตรียมชุดเอกสารปิดโครงการ 1 ชุด' where id = 'eng-p3-out-3';
update ob_items set text_th = 'สรุปสถานะแดชบอร์ด PM แบบอิสระ 1 ฉบับ' where id = 'eng-p3-out-4';
