/**
 * Process Flows — the 33 swimlane diagrams, extracted VERBATIM from the
 * canonical index.html <script> block (SOP_FLOWS). Do not hand-edit; re-sync
 * from index.html if the source array changes. See PORT_NOTES.md.
 */
import type { Flow } from './types';

/* eslint-disable */
export const SOP_FLOWS: Flow[] = [
    {
      id:'BD-1.0', module:'BD',
      titleTH:'การเปิดโครงการใหม่และการกำหนดข้อมูลงบประมาณ (Budget)',
      titleEN:'New Project & Budget Setup',
      lanes:[
        {key:'bd', name:'ฝ่ายโครงการ', sub:'Module BD', module:'BD'},
        {key:'pm', name:'ฝ่ายโครงการ', sub:'Module PM', module:'PM'},
        {key:'ap', name:'ผู้มีอำนาจอนุมัติ', sub:'Module PM', module:'PM'}
      ],
      nodes:[
        {id:'start', lane:'bd', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'bd', rank:1, type:'process', label:'1. สร้าง Tender'},
        {id:'n2',    lane:'bd', rank:2, type:'process', label:'2. เปิดโครงการ'},
        {id:'n21',   lane:'bd', rank:3, type:'process', label:'2.1 นำ Tender ผูกกับข้อมูลโครงการ'},
        {id:'n3',    lane:'bd', rank:4, type:'process', label:'3. Import BOQ Budget'},
        {id:'n4',    lane:'bd', rank:5, type:'process', label:'4. Init Summary Cost Code'},
        {id:'n5',    lane:'pm', rank:5, type:'process', label:'5. Init. Budget Cost'},
        {id:'n6',    lane:'pm', rank:6, type:'process', label:'6. กำหนดการ Control Budget'},
        {id:'n7',    lane:'ap', rank:6, type:'process', label:'7. Approve Budget'},
        {id:'end',   lane:'ap', rank:7, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2', label:'ประมูลงานได้ (Award)'},
        {from:'n2', to:'n21'},
        {from:'n21', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'n6'},
        {from:'n6', to:'n7'},
        {from:'n7', to:'end'}
      ],
      narrative:[
        '1. เมื่อมีการประมูลงาน ฝ่ายงบประมาณโครงการสร้าง Tender ใหม่ ชื่อตามโครงการที่ไปประมูล (BD Module)',
        '2. เปิดโครงการใหม่ (Create Project) ข้อมูลโครงการที่ BD Module โดยอ้างอิงข้อมูลดังนี้',
        '» 2.1) Tender ที่สถานะ Award มาผูกกับข้อมูลโครงการ',
        '3. กำหนดข้อมูล Budget ใน Template BOQ เมื่อข้อมูลเรียบร้อยให้ดำเนินการ Import BOQ/Budget เข้าในระบบ',
        '4. Initial Budget (ปุ่ม Init Summary Cost Code) ใน BD Module',
        '5. Initial Project Budget ใน PM Module',
        '6. กำหนดการ Control Budget (กรณีที่ต้องการ Control งบประมาณ)',
        '7. Approve Budget (ผู้มีอำนาจอนุมัติทำการ Approve Budget เพื่อล็อคเวอร์ชั่นของ Budget)',
        '! การกำหนด Control Budget จะต้องกำหนด Control Budget By Summary Cost Code ที่ข้อมูลโครงการก่อน'
      ]
    },
    {
      id:'BD-1.1', module:'BD',
      titleTH:'การ Revise Budget',
      titleEN:'Revise Budget',
      lanes:[
        {key:'pm', name:'ฝ่ายโครงการ', sub:'Module PM', module:'PM'},
        {key:'bd', name:'ฝ่ายโครงการ', sub:'Module BD', module:'BD'}
      ],
      nodes:[
        {id:'start', lane:'pm', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'pm', rank:1, type:'process',  label:'1. Revise Budget (เมนู Project Budget)'},
        {id:'n2',    lane:'bd', rank:2, type:'process',  label:'2. กำหนด BOQ/Budget'},
        {id:'n3',    lane:'bd', rank:3, type:'process',  label:'3. Init Summary Cost Code'},
        {id:'n4',    lane:'pm', rank:3, type:'process',  label:'4. Init. Budget Cost'},
        {id:'n5',    lane:'pm', rank:4, type:'process',  label:'5. กำหนดการ Control Budget'},
        {id:'dec',   lane:'bd', rank:4, type:'decision', label:'อนุมัติ?'},
        {id:'n6',    lane:'pm', rank:5, type:'process',  label:'6. Approve Budget'},
        {id:'end',   lane:'pm', rank:6, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n6', label:'Yes', kind:'yes'},
        {from:'dec', to:'n5', label:'Reject', kind:'reject'},
        {from:'n6', to:'end'}
      ],
      narrative:[
        '1. ฝ่ายงบประมาณโครงการ กดปุ่ม Revise Budget ที่ PM Module > Project Budget ในกรณีที่มีการแก้ไข (ยังไม่ต้องส่งอนุมัติ)',
        '2. กำหนด BOQ/Budget เข้าไปใหม่โดยวิธีการ Revise ใน Budget ของสัญญาหลัก',
        '3. Init Summary Cost Code ใน BD Module',
        '4. Init. Budget Cost ใน PM Module',
        '5. กำหนดการ Control Budget (กรณีที่ต้องการ Control งบประมาณ และส่งอนุมัติ)',
        '6. Approve Budget — ผู้มีอำนาจอนุมัติทำการ Approve Budget เพื่อล็อคเวอร์ชั่นของ Budget',
        '! เมื่อข้อมูลงบประมาณ Budget ถูก Reject ข้อมูลจะส่งกลับมาที่หน้าต่าง Project Budget',
        '! กรณีต้องการ Revise Budget อีกครั้ง ให้กดปุ่ม Revise เพื่อเปิดให้ทำการ Create VO และ Transfer Budget ต่อไปได้'
      ]
    },
    {
      id:'BD-1.2', module:'BD',
      titleTH:'การขออนุมัติงานเปลี่ยนแปลง BOQ (Additional Work)',
      titleEN:'BOQ Change Request (Additional Work)',
      lanes:[
        {key:'bd1', name:'ฝ่ายโครงการ', sub:'Module BD', module:'BD'},
        {key:'bd2', name:'ฝ่ายโครงการ', sub:'Module BD', module:'BD'},
        {key:'pm',  name:'PM / ผู้มีอำนาจอนุมัติ', sub:'Module PM', module:'PM'}
      ],
      nodes:[
        {id:'start', lane:'bd1', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'bd1', rank:1, type:'process',  label:'1. Additional Work (VO)'},
        {id:'dec',   lane:'bd2', rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'n3',    lane:'bd2', rank:2, type:'process',  label:'3. BOQ Budget (Ref VO)'},
        {id:'n4',    lane:'bd2', rank:3, type:'process',  label:'4. Create VO (Ref VO)'},
        {id:'n5',    lane:'bd2', rank:4, type:'process',  label:'5. Init Summary Cost Code'},
        {id:'n6',    lane:'pm',  rank:4, type:'process',  label:'6. Init. Budget Cost'},
        {id:'n7',    lane:'pm',  rank:5, type:'process',  label:'7. กำหนดการ Control Budget'},
        {id:'n8',    lane:'pm',  rank:6, type:'process',  label:'8. Approve Budget'},
        {id:'end',   lane:'pm',  rank:7, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'n6'},
        {from:'n6', to:'n7'},
        {from:'n7', to:'n8'},
        {from:'n8', to:'end'}
      ],
      narrative:[
        'Additional Work (BD Module)',
        '1. หน่วยงานโครงการ ระบุโครงการเพื่อบันทึกรายการเปลี่ยนแปลง (เพิ่ม/ลด) โดยการ Import ตามไฟล์ Excel หรือคีย์เพิ่มทีละบรรทัด โดยระบุข้อมูลดังนี้',
        '» Material code : กรณีควบคุม BOQ',
        '» Cost code : ต้นทุนจัดทำงบประมาณเพิ่ม/ลด',
        '» Qty./Unit : ปริมาณ และหน่วยของงานเพิ่ม/ลด',
        '» Unit price : ราคาต่อหน่วยของ Material, Labor',
        '2. Save และส่งอนุมัติ (Submit Approve)',
        '3. หน้าต่าง Bill Of Quantity เลือก Tender no. ที่มีรหัสโครงการเดียวกันกับงานเพิ่ม/ลด',
        '4. Create VO และดึง Ref.VO มาเชื่อมโยงกับ BOQ หลัก (Ref.VO คือเอกสาร Additional Work ที่ผ่านการอนุมัติแล้ว)',
        '5. Init Summary Cost Code ระบบจะคำนวณ Cost code ที่ใช้ในงานเดียวกันรวมเป็นจำนวนเดียวกัน',
        '6. Init. Budget Cost ใน PM Module เพื่อรับข้อมูลที่อัพเดตจาก BOQ',
        '7. กำหนดการ Control Budget กรณีที่ต้องการควบคุมงบประมาณ',
        '8. Approve Budget เมื่อต้องการ Lock การแก้ไขข้อมูลงบประมาณโครงการ'
      ]
    },

    /* ===== PR — Purchase Requisition ===== */
    {
      id:'PR-1.1', module:'PO',
      titleTH:'การเปิดใบขอซื้อ (PR) โดยอ้างอิงจาก BOQ',
      titleEN:'Purchase Requisition — referencing BOQ',
      lanes:[
        {key:'of', name:'Foreman / Admin Site', sub:'Module OF', module:'OF'},
        {key:'ap', name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'po', name:'ฝ่ายจัดซื้อ', sub:'Module PO', module:'PO'}
      ],
      nodes:[
        {id:'start', lane:'of', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of', rank:1, type:'process',  label:'1. เปิด PR (ดึง Ref. BOQ)'},
        {id:'dec',   lane:'ap', rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'print', lane:'of', rank:2, type:'process',  label:'พิมพ์ PR'},
        {id:'n3',    lane:'po', rank:2, type:'process',  label:'3. ดึงไปเปิด PO / WO'},
        {id:'form',  lane:'of', rank:3, type:'process',  label:'PR Form'},
        {id:'end',   lane:'of', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'print', label:'Yes', kind:'yes'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'print', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงาน / ผู้ควบคุมงานเปิดใบขอซื้อ (PR) โดยเลือก Ref. BOQ จากนั้นเลือกประเภทเอกสาร แยกเป็น Type 3 ประเภทหลัก ดังนี้',
        '» 1.1 PR For PO / WO สำหรับทั้งซื้อวัสดุและงานจ้างเหมาในชุดเอกสารเดียวกัน (PR ใบเดียวมีทั้งซื้อวัสดุและจ้างเหมา)',
        '» 1.2 PR For PO Only สำหรับซื้อวัสดุต่าง ๆ',
        '» 1.3 PR For WO Only สำหรับงานจ้างเหมา',
        '» การอ้างอิงจาก BOQ จะอ้างอิงรายการ/ปริมาณการสั่งซื้อ/สั่งจ้างที่ Control BOQ ไว้ และสัมพันธ์กับ Cost Code ที่มีการ Control Budget',
        '2. ผู้มีอำนาจอนุมัติในระบบ และมีลายเซ็นลงนามบนเอกสาร',
        '3. ฝ่ายจัดซื้อดึงใบขอซื้อ (PR) ที่ผ่านการอนุมัติแล้ว ไปเปิดใบสั่งซื้อ (PO) / หนังสือสั่งจ้าง (WO)',
        '! กรณีซื้อวัสดุของโครงการ ให้เลือก Type เป็น PO Only',
        '! กรณีจ้าง Subcontractor ให้เลือก Type เป็น WO Only (ทั้งจ้างแรงอย่างเดียว หรือทั้งของและแรง)',
        '! กรณีค่าบริการ / ค่าเช่า / ค่าซ่อม ฯลฯ ที่มี W/T ให้เลือก Type เป็น WO Only'
      ]
    },
    {
      id:'PR-1.2', module:'PO',
      titleTH:'การเปิดใบขอซื้อ (PR) โดยไม่อ้างอิงจาก BOQ',
      titleEN:'Purchase Requisition — without BOQ',
      lanes:[
        {key:'of', name:'Foreman / Admin Site', sub:'Module OF', module:'OF'},
        {key:'ap', name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'po', name:'ฝ่ายจัดซื้อ', sub:'Module PO', module:'PO'}
      ],
      nodes:[
        {id:'start', lane:'of', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of', rank:1, type:'process',  label:'1. เปิด PR'},
        {id:'dec',   lane:'ap', rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'print', lane:'of', rank:2, type:'process',  label:'พิมพ์ PR'},
        {id:'n3',    lane:'po', rank:2, type:'process',  label:'3. ดึงไปเปิด PO / WO'},
        {id:'form',  lane:'of', rank:3, type:'process',  label:'PR Form'},
        {id:'end',   lane:'of', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'print', label:'Yes', kind:'yes'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'print', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอซื้อ (PR) โดยไม่อ้างอิง BOQ เลือกประเภทเอกสาร Type 3 ประเภทหลัก ดังนี้',
        '» 1.1 PR For PO / WO สำหรับซื้อวัสดุและงานจ้างเหมาในชุดเอกสารเดียวกัน',
        '» 1.2 PR For PO Only สำหรับซื้อวัสดุต่าง ๆ',
        '» 1.3 PR For WO Only สำหรับงานจ้างเหมา',
        '» การบันทึก PR แบบไม่อ้างอิง BOQ เป็นการเลือกรายการซื้อวัสดุ/งานจ้างเหมาแบบอิสระ: เลือก Material Code / Cost Code (M/S/L) / ระบุจำนวน / ราคาต่อหน่วย',
        '2. ผู้มีอำนาจอนุมัติในระบบ และมีลายเซ็นลงนามบนเอกสาร',
        '3. ฝ่ายจัดซื้อดึงใบขอซื้อ (PR) ที่ผ่านการอนุมัติแล้ว ไปเปิดใบสั่งซื้อ (PO) / หนังสือสั่งจ้าง (WO)',
        '! กรณีซื้อวัสดุของโครงการ ให้เลือก Type เป็น PO Only',
        '! กรณีจ้าง Subcontractor ให้เลือก Type เป็น WO Only',
        '! กรณีค่าบริการ / ค่าเช่า / ค่าซ่อม ฯลฯ ที่มี W/T ให้เลือก Type เป็น WO Only'
      ]
    },
    {
      id:'PR-1.3', module:'PO',
      titleTH:'การเปิดใบขอซื้อ (PR) ซื้อวัสดุให้ผู้รับเหมา',
      titleEN:'Purchase Requisition — buy materials for subcontractor',
      lanes:[
        {key:'of', name:'Foreman / Admin Site', sub:'Module OF', module:'OF'},
        {key:'ap', name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'po', name:'ฝ่ายจัดซื้อ', sub:'Module PO', module:'PO'}
      ],
      nodes:[
        {id:'start', lane:'of', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of', rank:1, type:'process',  label:'1. เปิด PR (PR For PO Only)'},
        {id:'dec',   lane:'ap', rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'print', lane:'of', rank:2, type:'process',  label:'พิมพ์ PR'},
        {id:'n3',    lane:'po', rank:2, type:'process',  label:'3. ดึงไปเปิด PO'},
        {id:'form',  lane:'of', rank:3, type:'process',  label:'PR Form'},
        {id:'end',   lane:'of', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'print', label:'Yes', kind:'yes'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'print', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอซื้อ (PR) เลือกประเภทเอกสาร PR For PO Only สำหรับซื้อวัสดุ และระบุรายละเอียดเพิ่มเติม',
        '» 1.1) ระบุ Information: ประเภทการสั่งซื้อ "Cost" / ระบุชื่อผู้รับเหมาที่ช่อง Subcontractor / เลือกเอกสารหนังสือสั่งจ้างที่ช่อง "เลขที่เอกสารสัญญาจ้าง (WO)"',
        '» กรณีซื้อวัสดุให้ผู้รับเหมา ต้องอ้างอิงเลขที่หนังสือสั่งจ้างทุกครั้ง เพื่อให้มีผลต่อการหัก Deduct Material ขั้นตอนรับวางบิลตามหนังสือสั่งจ้าง',
        '» 1.2) ระบุรายละเอียดการสั่งซื้อ: เลือก Material Code / Cost Code (M / Dummy) / ระบุจำนวน / ราคาต่อหน่วย',
        '» กรณีเกิดค่าใช้จ่ายในการซื้อของให้ผู้รับเหมา ให้กำหนดรหัสต้นทุน Dummy เป็น "Material Cost Code สำหรับซื้อของให้ผู้รับเหมา" หรือบันทึกเป็นต้นทุนตามแต่ละงานได้',
        '2. ผู้มีอำนาจอนุมัติในระบบ และมีลายเซ็นลงนามบนเอกสาร',
        '3. ฝ่ายจัดซื้อดึงใบขอซื้อ (PR) ที่อนุมัติแล้ว ไปเปิดใบสั่งซื้อ (PO)'
      ]
    },

    /* ===== PO — Purchase / Work Orders ===== */
    {
      id:'PO-1.1', module:'PO',
      titleTH:'การเปิดใบสั่งซื้อ (PO) โดยการเปรียบเทียบราคา (Compare price)',
      titleEN:'Purchase Order — via price comparison',
      lanes:[
        {key:'po',   name:'ฝ่ายจัดซื้อ', sub:'Module PO', module:'PO'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'shop', name:'ร้านค้า', sub:'', module:''}
      ],
      nodes:[
        {id:'start', lane:'po', rank:0, type:'start',    label:'Start'},
        {id:'a11',   lane:'po', rank:1, type:'process',  label:'1.1 บันทึกเอกสารขอราคา'},
        {id:'a12',   lane:'po', rank:2, type:'process',  label:'1.2 Compare ราคาร้านค้า'},
        {id:'n2',    lane:'po', rank:3, type:'process',  label:'2. เปิด PO'},
        {id:'dec',   lane:'ap', rank:3, type:'decision', label:'3. อนุมัติ?'},
        {id:'print', lane:'po', rank:4, type:'process',  label:'พิมพ์ PO'},
        {id:'form',  lane:'po', rank:5, type:'process',  label:'PO Form'},
        {id:'shop',  lane:'shop', rank:5, type:'process', label:'4. ร้านค้ารับ PO เตรียมส่งของ'},
        {id:'end',   lane:'po', rank:6, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'a11'},
        {from:'a11', to:'a12'},
        {from:'a12', to:'n2'},
        {from:'n2', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'print', label:'Yes', kind:'yes'},
        {from:'dec', to:'n2', label:'Reject', kind:'reject'},
        {from:'print', to:'form'},
        {from:'form', to:'shop'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. ฝ่ายจัดซื้อทำการเปรียบเทียบราคา โดยจัดทำเอกสารขอราคา ได้ 2 กรณี: ขอราคาโดยอ้างอิงจาก PR และขอราคาแบบอิสระ (กำหนดรายการวัสดุที่ต้องการขอราคาเอง)',
        '» 1.1) บันทึกเอกสารขอราคา โดยอ้างอิง PR และระบุร้านค้า (Vendor) — แบบฟอร์มใบขอราคาส่งให้ร้านค้า',
        '» 1.2) บันทึกราคาตามใบเสนอราคาของร้านค้า แล้วเปรียบเทียบราคาที่ PO > Compare Price โดยอ้างอิงจากเอกสารใบขอราคา',
        '2. ฝ่ายจัดซื้อดึงใบขอซื้อ (PR) ที่อนุมัติแล้วมาเปิดใบสั่งซื้อ (PO)',
        '3. ผู้มีอำนาจอนุมัติเอกสารในระบบ และมีลายเซ็นลงนามบนเอกสาร',
        '4. ฝ่ายจัดซื้อส่งใบสั่งซื้อ (PO) ให้ร้านค้า — ร้านค้ารับ PO และเตรียมของส่ง'
      ]
    },
    {
      id:'PO-1.2', module:'PO',
      titleTH:'การเปิดใบสั่งซื้อ (PO) และใบสั่งจ้าง/หนังสือสั่งจ้าง (WO)',
      titleEN:'Purchase Order (PO) & Work Order (WO)',
      lanes:[
        {key:'po',   name:'ฝ่ายจัดซื้อ', sub:'Module PO', module:'PO'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'shop', name:'ร้านค้า / ผู้รับจ้าง / ผู้รับเหมา', sub:'', module:''}
      ],
      nodes:[
        {id:'start', lane:'po', rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'po', rank:1, type:'process',  label:'1. เปิด PO / WO'},
        {id:'dec',   lane:'ap', rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'print', lane:'po', rank:2, type:'process',  label:'พิมพ์ PO / WO'},
        {id:'form',  lane:'po', rank:3, type:'process',  label:'PO / WO Form'},
        {id:'shop',  lane:'shop', rank:3, type:'process', label:'3. ร้านค้าเตรียมส่งของ / ผู้รับเหมาส่งมอบงาน'},
        {id:'end',   lane:'po', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'print', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'print', to:'form'},
        {from:'form', to:'shop'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. ฝ่ายจัดซื้อดึงใบขอซื้อ/ขอจ้าง (PR For PO/WO หรือ PO Only / WO Only) ที่อนุมัติแล้วมาเปิดใบสั่งซื้อ (PO)/ใบสั่งจ้าง (WO) และระบุข้อมูลจำเป็น',
        '» ระบุโครงการ/แผนก (กรณีโครงการต้องระบุ Job ด้วยทุกครั้ง)',
        '» เลือกเอกสารใบขอซื้อ (PR) โดยกดปุ่มอ้างอิงเอกสารใบขอซื้อ (PR/MR No.)',
        '» ประเภทการสั่งซื้อ/สั่งจ้าง: 1) Cost ค่าใช้จ่ายของโครงการ/แผนก  2) Asset ทรัพย์สินโครงการ/แผนก  3) Stock สินค้าคงเหลือเพื่อบริหารคลัง (Stock IC)',
        '2. ผู้มีอำนาจอนุมัติในระบบ และมีลายเซ็นลงนามบนเอกสาร',
        '3. ฝ่ายจัดซื้อส่งใบสั่งซื้อ (PO) ให้ร้านค้า หรือส่งใบสั่งจ้าง (WO) ให้ผู้รับจ้าง/ผู้รับเหมา',
        '» ร้านค้ารับ PO เตรียมส่งของ',
        '» ผู้รับจ้าง/ผู้รับเหมารับ WO เพื่อดำเนินงานตามเอกสารสั่งจ้าง'
      ]
    },

    /* ===== IC — Inventory Control ===== */
    {
      id:'IC-1.1', module:'IC',
      titleTH:'บันทึกรับของเข้าสต๊อกผ่านใบรับสินค้า (PO Receive)',
      titleEN:'Goods receipt via PO (PO Receive)',
      lanes:[
        {key:'shop', name:'ร้านค้า', sub:'', module:''},
        {key:'unit', name:'หน่วยงาน / Admin Site', sub:'Module IC', module:'IC'},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'shop', rank:0, type:'start',    label:'Start'},
        {id:'s1',    lane:'shop', rank:1, type:'process',  label:'1. ส่งสินค้าตาม PO (แนบ DO/ใบกำกับภาษี)'},
        {id:'n2',    lane:'unit', rank:1, type:'process',  label:'2. รับสินค้าตาม PO Receive'},
        {id:'n5',    lane:'acct', rank:1, type:'process',  label:'5. ตรวจเอกสาร / ตั้งหนี้ และทำจ่าย'},
        {id:'dec',   lane:'unit', rank:2, type:'decision', label:'3. รับเข้าสต๊อก?'},
        {id:'n4',    lane:'unit', rank:3, type:'process',  label:'4. ทำรับ IC Receive (ระบุ Warehouse)'},
        {id:'end',   lane:'unit', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'s1'},
        {from:'s1', to:'n2'},
        {from:'n2', to:'n5'},
        {from:'n2', to:'dec'},
        {from:'dec', to:'n4', label:'Yes', kind:'yes'},
        {from:'n4', to:'end'}
      ],
      narrative:[
        '1. ร้านค้าส่งสินค้าตามใบสั่งซื้อ (PO) โดยแนบใบกำกับภาษี / ใบส่งของชั่วคราว',
        '2. หน่วยงานทำการรับสินค้าตามใบสั่งซื้อ (PO) ที่ขั้นตอนรับสินค้า (PO Receive)',
        '3. พิจารณาว่าวัสดุต้องรับเข้าสต๊อกหรือไม่',
        '» ถ้าไม่รับเข้าสต๊อก จะไม่อ้างอิงไปขั้นตอนรับ IC Receive (ข้อ 4) — สินค้าบางประเภทไม่นำเข้า Stock เช่น ของที่ซื้อมาใช้ไป บริหารการเบิกไม่ได้',
        '4. ถ้ารับเข้าสต๊อก หน่วยงานรับสินค้าที่ IC Receive ระบุสถานที่เก็บสินค้า โดยกำหนดข้อมูลคลัง (Warehouse)',
        '5. แผนกบัญชีดึงรายการที่ทำรับของตามใบสั่งซื้อ (PO Receive) แล้วอ้างอิงไปตั้งเจ้าหนี้ เพื่อทำจ่ายชำระในขั้นถัดไป',
        '! เมื่อสั่งซื้อและร้านค้าจัดส่งแล้ว ต้องจัดทำเอกสารใบรับของในระบบ เพื่อให้บัญชีอ้างอิง PO Receive ไปตั้งหนี้จนถึงจ่ายชำระเงิน'
      ]
    },
    {
      id:'IC-1.2', module:'IC',
      titleTH:'บันทึกรับของเข้าสต๊อก กรณีไม่มีใบสั่งซื้อ (Type: Receive Other)',
      titleEN:'Stock receipt without PO (Receive Other)',
      lanes:[
        {key:'of', name:'หน่วยงาน / สโตร์กลาง', sub:'Module OF', module:'OF'},
        {key:'ic', name:'หน่วยงาน / สโตร์กลาง', sub:'Module IC', module:'IC'}
      ],
      nodes:[
        {id:'ofstart', lane:'of', rank:0, type:'start',   label:'Start'},
        {id:'ofn',     lane:'of', rank:1, type:'process', label:'เปิด OF เลือก Type : Petty Cash'},
        {id:'ofform',  lane:'of', rank:2, type:'process', label:'OF Form'},
        {id:'ofend',   lane:'of', rank:3, type:'end',     label:'End'},
        {id:'icstart', lane:'ic', rank:0, type:'start',   label:'Start'},
        {id:'icn',     lane:'ic', rank:1, type:'process', label:'1. รับ IC Receive Type Other'},
        {id:'icform',  lane:'ic', rank:2, type:'process', label:'IC Receive Form'},
        {id:'icend',   lane:'ic', rank:3, type:'end',     label:'End'}
      ],
      edges:[
        {from:'ofstart', to:'ofn'},
        {from:'ofn', to:'ofform'},
        {from:'ofform', to:'ofend'},
        {from:'ofn', to:'icn'},
        {from:'icstart', to:'icn'},
        {from:'icn', to:'icform'},
        {from:'icform', to:'icend'}
      ],
      narrative:[
        '1. หน่วยงานทำรับสินค้าเข้าคลังผ่าน IC Receive โดยเลือกประเภทเอกสารเป็น Type Other (ต้องใส่ราคาในช่อง IC Cost = ราคารวมทั้งหมด และตัวแปลงหน่วยถ้ามี)',
        '2. หน่วยงานทำรับ IC Receive ระบุสถานที่เก็บวัสดุหรือคลังสินค้า (Warehouse)',
        '! เอกสารที่ใช้ทำรับ อาจเป็นใบเสร็จรับเงิน / ใบกำกับภาษี / บิลที่หน่วยงานซื้อวัสดุมา โดยไม่ผ่านกระบวนการจัดซื้อ',
        '! Receive Other เช่น สินค้าที่ซื้อโดยเงินสด หรือผ่าน Petty Cash ที่ต้องการเก็บเข้าสต๊อก'
      ]
    },
    {
      id:'IC-1.3', module:'IC',
      titleTH:'บันทึกการเตรียมเบิกและตัดเบิกของออกจากสต๊อก (Issue)',
      titleEN:'Material preparation & issue (Issue)',
      lanes:[
        {key:'l1', name:'หน่วยงาน / สโตร์กลาง', sub:'Module IC', module:'IC'},
        {key:'l2', name:'หน่วยงาน / สโตร์กลาง', sub:'Module IC', module:'IC'}
      ],
      nodes:[
        {id:'start', lane:'l1', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'l1', rank:1, type:'process', label:'1. จัดทำใบเบิก (Entry Document Issue)'},
        {id:'form1', lane:'l1', rank:2, type:'process', label:'Entry Document Issue Form'},
        {id:'n3',    lane:'l2', rank:2, type:'process', label:'3. ตัดสต๊อก IC Issue'},
        {id:'form2', lane:'l2', rank:3, type:'process', label:'Material Issue Form'},
        {id:'end',   lane:'l2', rank:4, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'form1'},
        {from:'form1', to:'n3'},
        {from:'n3', to:'form2'},
        {from:'form2', to:'end'}
      ],
      narrative:[
        '1. จัดทำเอกสารใบเตรียมเบิก โดยเลือก (Entry Document Issue) ระบุ Type Issue',
        '» เลือกรายการวัสดุที่จะเบิก (ดึงจาก Material Balance)',
        '» ระบุ Warehouse',
        '» ระบุ Type และ Area (พื้นที่ที่จะนำวัสดุไปใช้งาน)',
        '» ระบุชื่อผู้ขอเบิก (Ref. by)',
        '» ระบุหมายเหตุเพิ่มเติม (Remark)',
        '2. ดึงเอกสารใบเตรียมเบิกมาตัดสต๊อก โดยเลือก (IC Issue)',
        '» กดปุ่ม Ref. Document เพื่อดึงเอกสารใบเตรียมเบิกมาตรวจสอบ และบันทึกตัดเบิกในระบบ'
      ]
    },
    {
      id:'IC-1.4', module:'IC',
      titleTH:'บันทึกการโอนวัสดุไปหน่วยงานอื่น (IC Transfer) และการรับโอน (IC Receive Transfer)',
      titleEN:'Material transfer & receive transfer',
      lanes:[
        {key:'src', name:'หน่วยงานผู้โอน (ต้นทาง)', sub:'Module IC', module:'IC'},
        {key:'dst', name:'หน่วยงานผู้รับโอน (ปลายทาง)', sub:'Module IC', module:'IC'}
      ],
      nodes:[
        {id:'start', lane:'src', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'src', rank:1, type:'process', label:'1. จัดทำใบโอน (Entry Document)'},
        {id:'form1', lane:'src', rank:2, type:'process', label:'Entry Document Issue Form'},
        {id:'n21',   lane:'src', rank:3, type:'process', label:'2.1 โอนของ (Ref. Entry Document)'},
        {id:'mform', lane:'src', rank:4, type:'process', label:'Material Transfer Form'},
        {id:'n3',    lane:'dst', rank:4, type:'process', label:'3. ทำการรับของ (IC Receive Transfer)'},
        {id:'rform', lane:'dst', rank:5, type:'process', label:'Receive Transfer Form'},
        {id:'end',   lane:'dst', rank:6, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'form1'},
        {from:'form1', to:'n21'},
        {from:'n21', to:'mform'},
        {from:'mform', to:'n3', label:'นำของมาส่งที่ Site'},
        {from:'n3', to:'rform'},
        {from:'rform', to:'end'}
      ],
      narrative:[
        '1. จัดทำเอกสารใบเตรียมเบิก (Entry Document) ระบุข้อมูล Type Transfer',
        '» ระบุโครงการปลายทาง (To Project) ที่จะรับโอนวัสดุ',
        '» ระบุ Type และ Area (พื้นที่ที่นำวัสดุไปใช้งาน หรือชื่อโครงการที่โอนไป)',
        '» ระบุชื่อผู้ขอโอน (Ref. by)',
        '» เลือกรายการวัสดุที่จะโอน (ดึงจาก Material Balance)',
        '» ระบุ Cost Code (ต้นทางและปลายทาง)',
        '2. ทำการโอนวัสดุไปยังหน่วยงานผู้รับโอน (Inventory Transfer) แยกการโอนเป็น 2 ประเภท',
        '» 2.1) โอนวัสดุโดยอ้างอิงใบเตรียมโอน (Ref. Entry Document (IC))',
        '» 2.2) สโตร์กลางดึงใบขอวัสดุ (PR For Stock) ที่อนุมัติแล้ว ไปเปิดใบโอนย้ายวัสดุ (IC Transfer) โดย Ref.PR Stock Center',
        '» เงื่อนไขข้อ 2.2: ต้องมี PR For Stock ส่งมาก่อน / เกิดเมื่อหน่วยงานขอวัสดุจากโครงการสโตร์กลางเท่านั้น / ไม่ต้องทำใบเตรียมโอน (ข้อ 1)',
        '3. หน่วยงานผู้ขอโอนบันทึกรายการรับโอน ระบุ Warehouse ทำการรับของ (IC Receive Transfer)',
        '! Inventory Transfer เป็นการโอนให้โครงการ (มีการปรับปรุงต้นทุนระหว่างโครงการ) ส่วนบัญชีบันทึก GL ปรับต้นทุนเข้าโครงการ',
        '! รับของต้องเท่ากับจำนวนที่โอน ไม่ให้แก้ไขจำนวนที่รับของ'
      ]
    },

    /* ===== Billing — Subcontractor billing ===== */
    {
      id:'Billing-1.1', module:'AP',
      titleTH:'การบันทึกรับวางบิลผู้รับเหมา แบบขอเบิกเงินล่วงหน้า (Advance payment)',
      titleEN:'Subcontractor billing — Advance payment',
      lanes:[
        {key:'sub',  name:'ผู้รับจ้าง / ผู้รับเหมา', sub:'', module:''},
        {key:'unit', name:'หน่วยงาน / สโตร์', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'sub',  rank:0, type:'start',    label:'Start'},
        {id:'s1',    lane:'sub',  rank:1, type:'process',  label:'1. เอกสารขอเบิกเงินล่วงหน้า'},
        {id:'n2',    lane:'unit', rank:1, type:'process',  label:'2. บันทึกรับวางบิล (Advance payment)'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'3. อนุมัติ?'},
        {id:'n4',    lane:'acct', rank:1, type:'process',  label:'4. ตรวจเอกสาร / ตั้งหนี้ APS และทำจ่าย'},
        {id:'form',  lane:'unit', rank:2, type:'process',  label:'Billing Form'},
        {id:'end',   lane:'unit', rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'s1'},
        {from:'s1', to:'n2', label:'ส่งเอกสาร'},
        {from:'n2', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n4', label:'Yes', kind:'yes'},
        {from:'dec', to:'n2', label:'Reject', kind:'reject'},
        {from:'n2', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. ผู้รับเหมารับหนังสือสั่งจ้าง และทำเอกสารขอเบิกเงินล่วงหน้า',
        '2. หน่วยงานทำบันทึกรับวางบิลตัดผลงานผู้รับเหมา เลือกประเภทการรับวางบิลเป็นเงินล่วงหน้า (Advance Payment)',
        '» ระบบมีประเภทการรับวางบิล 3 ประเภท: ค่างวดงาน (Progress) / เงินล่วงหน้า (Advance) / เงินประกันผลงาน (Retention)',
        '3. ผู้มีอำนาจในหน่วยงานอนุมัติเอกสารในระบบ ลงลายเซ็น และส่งเอกสารให้แผนกบัญชี',
        '4. แผนกบัญชีดึงรายการไปตั้งหนี้ APS'
      ]
    },
    {
      id:'Billing-1.2', module:'AP',
      titleTH:'การบันทึกรับวางบิลผู้รับเหมา แบบขอเบิกเงินค่างวดงาน (Progress payment)',
      titleEN:'Subcontractor billing — Progress payment',
      lanes:[
        {key:'sub',  name:'ผู้รับจ้าง / ผู้รับเหมา', sub:'', module:''},
        {key:'unit', name:'หน่วยงาน', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'sub',  rank:0, type:'start',    label:'Start'},
        {id:'s1',    lane:'sub',  rank:1, type:'process',  label:'1. ส่งผลงาน (เอกสารส่งผลงาน)'},
        {id:'n2',    lane:'unit', rank:1, type:'process',  label:'2. บันทึกรับวางบิล (Progress Payment)'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'3. อนุมัติ?'},
        {id:'n4',    lane:'acct', rank:1, type:'process',  label:'4. ตรวจเอกสาร / ตั้งหนี้ APS'},
        {id:'form',  lane:'unit', rank:2, type:'process',  label:'Payment Form'},
        {id:'end',   lane:'unit', rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'s1'},
        {from:'s1', to:'n2', label:'ส่งเอกสาร'},
        {from:'n2', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n4', label:'Yes', kind:'yes'},
        {from:'dec', to:'n2', label:'Reject', kind:'reject'},
        {from:'n2', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. ผู้รับเหมาส่งผลงาน โดยนำส่งเอกสารส่งผลงานแต่ละงวด / หรือตามมูลค่างาน',
        '2. หน่วยงานทำบันทึกรับวางบิลตัดผลงานผู้รับเหมา และบันทึกรายการหักต่าง ๆ เช่น ค่าความเสียหาย ค่าเสื้อ',
        '» ระบุประเภทการรับวางบิลเป็น ค่างวดงาน (Progress Payment)',
        '» ระบุจำนวนเงินค่างวดงาน',
        '» ระบุวันที่ส่งมอบงาน / วันที่วางบิล และวันที่ทำจ่าย',
        '» ระบุหมายเหตุ และข้อมูลต่าง ๆ',
        '3. ผู้มีอำนาจในหน่วยงานอนุมัติเอกสาร ลงลายเซ็น และส่งให้แผนกบัญชี',
        '4. แผนกบัญชีดึงรายการไปตั้งหนี้ APS'
      ]
    },
    {
      id:'Billing-1.3', module:'AP',
      titleTH:'การบันทึกรับวางบิลผู้รับเหมา แบบขอเบิกเงินประกันผลงาน (Retention payment)',
      titleEN:'Subcontractor billing — Retention payment',
      lanes:[
        {key:'sub',  name:'ผู้รับจ้าง / ผู้รับเหมา', sub:'', module:''},
        {key:'unit', name:'หน่วยงาน / ฝ่ายบัญชี', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'sub',  rank:0, type:'start',    label:'Start'},
        {id:'s1',    lane:'sub',  rank:1, type:'process',  label:'1. เอกสารขอเบิกเงินประกันผลงาน'},
        {id:'n2',    lane:'unit', rank:1, type:'process',  label:'2. บันทึกรับวางบิล (Retention Payment)'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'3. อนุมัติ?'},
        {id:'n4',    lane:'acct', rank:1, type:'process',  label:'4. ตรวจเอกสาร / ตั้งหนี้ APS และทำจ่าย'},
        {id:'form',  lane:'unit', rank:2, type:'process',  label:'Billing Form'},
        {id:'end',   lane:'unit', rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'s1'},
        {from:'s1', to:'n2', label:'ส่งเอกสาร'},
        {from:'n2', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n4', label:'Yes', kind:'yes'},
        {from:'dec', to:'n2', label:'Reject', kind:'reject'},
        {from:'n2', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หลังจากผู้รับเหมาดำเนินงานตามหนังสือสั่งจ้างเสร็จเรียบร้อย และครบกำหนดการรับประกันผลงานแล้ว ทำเอกสารขอเบิกเงินประกันผลงานคืน',
        '2. หน่วยงานทำบันทึกรับวางบิลตัดผลงานผู้รับเหมา เลือกประเภทการรับวางบิลเป็นเงินประกันผลงาน (Retention Payment)',
        '3. ผู้มีอำนาจในหน่วยงานอนุมัติเอกสาร ลงลายเซ็น และส่งให้แผนกบัญชี',
        '4. แผนกบัญชีดึงรายการไปตั้งหนี้ APS'
      ]
    },

    /* ===== OF — Office / Petty Cash & Advances ===== */
    {
      id:'OF-1.1', module:'OF',
      titleTH:'การเปิด OF (None PO/WO) แบบเงินสดย่อย (Petty Cash)',
      titleEN:'OF — Petty Cash',
      lanes:[
        {key:'of',   name:'หน่วยงาน / Admin', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'of',   rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of',   rank:1, type:'process',  label:'1. เปิด OF เลือก Type : Petty cash'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'n3',    lane:'acct', rank:1, type:'process',  label:'3. ตรวจสอบเอกสาร / ตั้งหนี้ APO'},
        {id:'form',  lane:'of',   rank:2, type:'process',  label:'OF Form'},
        {id:'end',   lane:'of',   rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'n1', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอเบิกเงิน (OF) เป็นค่าใช้จ่ายต่าง ๆ ที่นำเงินสดย่อยไปจ่าย',
        '» เลือก Type : Petty cash (ใบเบิกเงินสดย่อย)',
        '» ระบุ Vendor Type เป็น Employee (ชื่อพนักงานผู้ถือเงินสดย่อย)',
        '» เลือกโครงการ ระบบงาน หรือแผนก / ระบุหมายเหตุ',
        '» เลือกเรื่องจ่าย (Expense Code) ตามค่าใช้จ่ายในใบเสร็จรับเงิน',
        '» ระบุเลขที่เอกสาร / จำนวนเงิน / ภาษีมูลค่าเพิ่ม (ถ้ามี) / ภาษีหัก ณ ที่จ่าย (ถ้ามี)',
        '2. ผู้มีอำนาจทำการอนุมัติเอกสาร OF',
        '3. แผนกบัญชีตรวจสอบเอกสาร และดึงรายการไปบันทึกตั้งหนี้',
        '» เอกสารประกอบการเบิกเงิน',
        '» บิล / ใบเสร็จรับเงิน / ใบกำกับภาษี / ใบแจ้งหนี้'
      ]
    },
    {
      id:'OF-1.2', module:'OF',
      titleTH:'การเปิด OF (None PO/WO) แบบเงินทดรองจ่าย (Advance)',
      titleEN:'OF — Advance',
      lanes:[
        {key:'of',   name:'หน่วยงาน / Admin', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'of',   rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of',   rank:1, type:'process',  label:'1. เปิด OF เลือก Type : Advance'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'n3',    lane:'acct', rank:1, type:'process',  label:'3. ตรวจสอบเอกสาร / ตั้งหนี้ APO'},
        {id:'form',  lane:'of',   rank:2, type:'process',  label:'OF Form'},
        {id:'end',   lane:'of',   rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'n1', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอเบิกเงิน (OF) เป็นเงินทดรองจ่าย (Advance)',
        '» เลือก Type : Advance (เงินทดรองจ่าย)',
        '» ระบุ Vendor Type เป็น Employee (ชื่อพนักงานผู้ที่ต้องการใช้เงินทดรองจ่าย)',
        '» เลือกโครงการ ระบบงาน หรือแผนก / ระบุหมายเหตุ',
        '» เลือกเรื่องจ่าย (Expense Code) เป็นเงินทดรองจ่าย เช่น เงินทดรองจ่าย - พนักงาน',
        '» ระบุจำนวนเงินที่ต้องการ',
        '2. ผู้มีอำนาจทำการอนุมัติบนเอกสาร OF',
        '3. แผนกบัญชีตรวจสอบเอกสาร และดึงรายการไปบันทึกตั้งหนี้',
        '» เอกสารประกอบการเบิกเงิน',
        '» บันทึกภายใน ขอเบิกเงินล่วงหน้า'
      ]
    },
    {
      id:'OF-1.3', module:'OF',
      titleTH:'การเปิด OF (None PO/WO) แบบเคลียร์เงินทดรองจ่าย (Clear Advance)',
      titleEN:'OF — Clear Advance',
      lanes:[
        {key:'of',   name:'หน่วยงาน / Admin', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'of',   rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of',   rank:1, type:'process',  label:'1. เปิด OF เลือก Type : Clear Advance'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'n3',    lane:'acct', rank:1, type:'process',  label:'3. ตรวจสอบเอกสาร / ตั้งหนี้ APO'},
        {id:'form',  lane:'of',   rank:2, type:'process',  label:'OF Form'},
        {id:'end',   lane:'of',   rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'n1', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอเบิกเงิน (OF)',
        '» เลือก Type : Clear advance (เคลียร์เงินทดรองจ่าย)',
        '» ระบุ Vendor Type เป็น Employee (ชื่อพนักงานคนเดียวกับผู้ขอเบิกเงินทดรองจ่าย)',
        '» เลือกโครงการ ระบบงาน หรือแผนก / ระบุหมายเหตุว่าเคลียร์เงินทดรองจ่าย',
        '» เลือกเรื่องจ่าย (Expense Code) / ระบุเลขที่เอกสาร / จำนวนเงิน / VAT / WHT (ถ้ามี)',
        '» กดปุ่ม Advance เลือกเอกสารชุดที่เบิกเงินทดรองจ่าย เพื่อเคลียร์ในชุดเดียวกันให้ถูกต้อง',
        '» ถ้ามีเงินต้องคืน ให้เพิ่มบรรทัดเลือกเป็นธนาคารที่พนักงานโอนเข้า หรือเลือกเป็นเงินสด',
        '2. ผู้มีอำนาจทำการอนุมัติบนเอกสาร OF',
        '3. แผนกบัญชีตรวจสอบเอกสาร และดึงรายการไปบันทึกตั้งหนี้ — ถ้ามีส่วนเกิน บัญชีดึงไปทำจ่ายต่อ หากไม่มีส่วนเกิน จบที่ขั้นตั้งหนี้ APO'
      ]
    },
    {
      id:'OF-1.4', module:'OF',
      titleTH:'การเปิด OF (None PO/WO) แบบการบันทึกจ่ายอื่น ๆ (Other)',
      titleEN:'OF — Other payment',
      lanes:[
        {key:'of',   name:'หน่วยงาน / Admin', sub:'Module OF', module:'OF'},
        {key:'ap',   name:'ผู้มีอำนาจอนุมัติ', sub:'', module:''},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'of',   rank:0, type:'start',    label:'Start'},
        {id:'n1',    lane:'of',   rank:1, type:'process',  label:'1. เปิด OF เลือก Type : Other'},
        {id:'dec',   lane:'ap',   rank:1, type:'decision', label:'2. อนุมัติ?'},
        {id:'n3',    lane:'acct', rank:1, type:'process',  label:'3. ตรวจสอบเอกสาร / ตั้งหนี้ APO'},
        {id:'form',  lane:'of',   rank:2, type:'process',  label:'OF Form'},
        {id:'end',   lane:'of',   rank:3, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n3', label:'Yes', kind:'yes'},
        {from:'dec', to:'n1', label:'Reject', kind:'reject'},
        {from:'n1', to:'form'},
        {from:'form', to:'end'}
      ],
      narrative:[
        '1. หน่วยงานเปิดใบขอเบิกเงิน (OF) เป็นค่าใช้จ่ายต่าง ๆ ให้กับบุคคลภายนอก',
        '» เลือก Type : Other (ใบเบิกบันทึกจ่ายอื่น ๆ)',
        '» ระบุ Vendor Type เป็น External (ชื่อหน่วยงาน/บุคคลภายนอก)',
        '» เลือกโครงการ ระบบงาน หรือแผนก / ระบุหมายเหตุ',
        '» เลือกเรื่องจ่าย (Expense Code) / ระบุเลขที่เอกสาร / จำนวนเงิน / VAT / WHT (ถ้ามี)',
        '2. ผู้มีอำนาจทำการอนุมัติบนเอกสาร OF',
        '3. แผนกบัญชีตรวจสอบเอกสาร และดึงรายการไปบันทึกตั้งหนี้',
        '» เอกสารประกอบการเบิกเงิน',
        '» บิล / ใบเสร็จรับเงิน / ใบกำกับภาษี / ใบแจ้งหนี้'
      ]
    },

    /* ===== AP — Accounts Payable ===== */
    {
      id:'AP-1.1', module:'AP',
      titleTH:'การบันทึกตั้งเจ้าหนี้ ประเภท APV',
      titleEN:'Set up payable — APV',
      lanes:[
        {key:'site', name:'จัดซื้อ / หน่วยงาน / Admin Site', sub:'Module IC', module:'IC'},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'},
        {key:'fin',  name:'ฝ่ายการเงิน', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'site', rank:0, type:'start',   label:'Start'},
        {id:'rec',   lane:'site', rank:1, type:'process', label:'บันทึกรับสินค้า (PO Receive)'},
        {id:'n1',    lane:'acct', rank:1, type:'process', label:'1. ทำการตั้งหนี้ APV'},
        {id:'n2',    lane:'acct', rank:2, type:'process', label:'2. อนุมัติจ่าย (Pre-Payment APV)'},
        {id:'n3',    lane:'fin',  rank:2, type:'process', label:'3. บันทึกการจ่ายชำระ (PV)'},
        {id:'n4',    lane:'fin',  rank:3, type:'process', label:'4. บันทึกยืนยันการจ่าย (F)'},
        {id:'n5',    lane:'acct', rank:3, type:'process', label:'5. บันทึกตัดเจ้าหนี้ (Clear AP)'},
        {id:'end',   lane:'acct', rank:4, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'rec'},
        {from:'rec', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'end'}
      ],
      narrative:[
        'การบันทึกตั้งหนี้ APV (Type Normal) — จัดซื้อ/หน่วยงาน/Admin Site บันทึกรับสินค้าตามใบสั่งซื้อ (PO) แล้วส่งเอกสารให้บัญชีตั้งเจ้าหนี้: ใบรับสินค้า (RC) / ใบส่งของ / ใบกำกับภาษี / เอกสารใบสั่งซื้อ (PO)',
        '1. ฝ่ายบัญชี ดึงตั้งหนี้ ที่มาจากการรับของตามใบสั่งซื้อ (PO) ได้เอกสารตั้งเจ้าหนี้ APV',
        '2. ฝ่ายบัญชีบันทึกอนุมัติจ่ายจากเอกสารตั้งเจ้าหนี้ APV (Pre-Payment APV)',
        '3. ฝ่ายการเงินบันทึกการจ่ายชำระ โดยจัดทำเช็ค/โอนเงิน หรือเงินสด (Cheque/Bank Transfer/Cash) ได้ใบสำคัญจ่าย (F)',
        '4. ฝ่ายการเงินบันทึกยืนยันการจ่าย ได้เอกสาร (PV)',
        '5. ฝ่ายบัญชีบันทึกตัดเจ้าหนี้ (Clear AP)',
        '! กรณีจ่ายด้วยเงินสด ต้องดึงเอกสาร PV ไปบันทึกตัดเจ้าหนี้ (Clear AP) ทุกครั้ง',
        '! การแนบใบกำกับภาษีซื้อ ระบุได้ 2 ขั้นตอน: *1 = ขั้นตอนตั้งหนี้ / *2 = ขั้นตอนจ่ายชำระ'
      ]
    },
    {
      id:'AP-1.2', module:'AP',
      titleTH:'การบันทึกตั้งเจ้าหนี้ ประเภท APS',
      titleEN:'Set up payable — APS',
      lanes:[
        {key:'site', name:'หน่วยงาน / Admin Site', sub:'Module OF', module:'OF'},
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'},
        {key:'fin',  name:'ฝ่ายการเงิน', sub:'Module AP', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'site', rank:0, type:'start',    label:'Start'},
        {id:'bil',   lane:'site', rank:1, type:'process',  label:'บันทึกเบิกตามใบสั่งจ้าง (WO)'},
        {id:'dec',   lane:'site', rank:2, type:'decision', label:'อนุมัติ?'},
        {id:'n1',    lane:'acct', rank:2, type:'process',  label:'1. ทำการตั้งหนี้ APS'},
        {id:'n2',    lane:'acct', rank:3, type:'process',  label:'2. อนุมัติจ่าย (Pre-Payment APS)'},
        {id:'n3',    lane:'fin',  rank:3, type:'process',  label:'3. บันทึกการจ่ายชำระ (PV)'},
        {id:'n4',    lane:'fin',  rank:4, type:'process',  label:'4. บันทึกยืนยันการจ่าย (F)'},
        {id:'n5',    lane:'acct', rank:4, type:'process',  label:'5. บันทึกตัดเจ้าหนี้ (Clear AP)'},
        {id:'end',   lane:'acct', rank:5, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'bil'},
        {from:'bil', to:'dec', label:'Submit Approve', kind:'approve'},
        {from:'dec', to:'n1', label:'Yes', kind:'yes'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'end'}
      ],
      narrative:[
        'การบันทึกตั้งหนี้ APS — หน่วยงาน/Admin Site บันทึกเบิกตามใบสั่งจ้าง (WO) แบ่งเป็น 3 ประเภทการรับวางบิล: Advance / Progress / Retention เมื่อบันทึกและส่งอนุมัติแล้ว ส่งเอกสารให้บัญชีตั้งเจ้าหนี้',
        '1. ฝ่ายบัญชี ดึงตั้งหนี้โดยอ้างอิง Bill No. ที่มาจากการบันทึกเบิกผลงานผู้รับเหมา (Billing) ได้เอกสารตั้งเจ้าหนี้ APS',
        '2. ฝ่ายบัญชีบันทึกอนุมัติจ่ายจากเอกสารตั้งเจ้าหนี้ APS (Pre-Payment APS)',
        '3. ฝ่ายการเงินบันทึกการจ่ายชำระ โดยจัดทำเช็ค/โอนเงิน หรือเงินสด ได้ใบสำคัญจ่าย (F)',
        '4. ฝ่ายการเงินบันทึกยืนยันการจ่าย ได้เอกสาร (PV)',
        '5. ฝ่ายบัญชีบันทึกตัดเจ้าหนี้ (Clear AP)',
        '! การแนบใบกำกับภาษีซื้อ ระบุได้ 2 ขั้นตอน: *1 = ขั้นตอนตั้งหนี้ / *2 = ขั้นตอนจ่ายชำระ'
      ]
    },
    {
      id:'AP-1.3', module:'AP',
      titleTH:'การบันทึกตั้งเจ้าหนี้ ประเภท APO',
      titleEN:'Set up payable — APO',
      lanes:[
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AP', module:'AP'},
        {key:'fin',  name:'ฝ่ายการเงิน', sub:'', module:''}
      ],
      nodes:[
        {id:'start', lane:'acct', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'acct', rank:1, type:'process', label:'1. ทำการตั้งหนี้ APO'},
        {id:'n2',    lane:'acct', rank:2, type:'process', label:'2. อนุมัติจ่ายและพิมพ์ฟอร์ม (APO)'},
        {id:'n3',    lane:'fin',  rank:2, type:'process', label:'3. บันทึกการจ่ายชำระ (PV)'},
        {id:'n4',    lane:'fin',  rank:3, type:'process', label:'4. บันทึกยืนยันการจ่าย (F)'},
        {id:'n5',    lane:'acct', rank:3, type:'process', label:'5. บันทึกตัดเจ้าหนี้ (Clear AP)'},
        {id:'end',   lane:'acct', rank:4, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'end'}
      ],
      narrative:[
        '1. ฝ่ายบัญชี ดึงตั้งหนี้ ที่มาจากเอกสารการเบิกอื่น ๆ (APO)',
        '2. ฝ่ายบัญชีอนุมัติจ่ายจากเอกสารตั้งเจ้าหนี้ APO (Pre-Payment APO)',
        '3. ฝ่ายการเงินบันทึกการจ่ายชำระ โดยจัดทำเช็ค/โอนเงิน หรือเงินสด ได้ใบสำคัญจ่าย (F)',
        '4. ฝ่ายการเงินบันทึกยืนยันการจ่าย ได้เอกสาร (PV)',
        '5. ฝ่ายบัญชีบันทึกตัดเจ้าหนี้ (Clear AP)',
        '! กรณีจ่ายด้วยเงินสด ต้องดึงเอกสาร PV ไปบันทึกตัดเจ้าหนี้ (Clear AP) ทุกครั้ง',
        '! *1 = ถ้า OF เป็น Type : Employee ได้ใบกำกับภาษีในขั้นตอนทำ OF / *2 = ถ้า OF เป็น Type : External ได้รับใบกำกับภาษีในขั้นตอนยืนยันการจ่าย'
      ]
    },

    /* ===== AR — Accounts Receivable ===== */
    {
      id:'AR-1.1', module:'AR',
      titleTH:'บันทึกความคืบหน้าโครงการ / ออกใบแจ้งหนี้ สำหรับงานรับเหมาก่อสร้าง',
      titleEN:'Project progress billing (construction)',
      lanes:[
        {key:'acct', name:'แผนกบัญชี', sub:'Module AR', module:'AR'},
        {key:'fin',  name:'แผนกการเงิน', sub:'', module:''}
      ],
      nodes:[
        {id:'start', lane:'acct', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'acct', rank:1, type:'process', label:'1. บันทึกความคืบหน้าโครงการ'},
        {id:'n2',    lane:'acct', rank:2, type:'process', label:'2. ยืนยันการเบิกผลงาน'},
        {id:'n3',    lane:'acct', rank:3, type:'process', label:'3. เปิดใบแจ้งหนี้'},
        {id:'n4',    lane:'acct', rank:4, type:'process', label:'4. ตั้งหนี้ลูกหนี้ รายได้'},
        {id:'n5',    lane:'fin',  rank:4, type:'process', label:'5. บันทึกใบเสร็จรับเงิน / ใบกำกับภาษี'},
        {id:'n6',    lane:'fin',  rank:5, type:'process', label:'6. บันทึกรับเงินตามใบเสร็จ'},
        {id:'n7',    lane:'acct', rank:5, type:'process', label:'7. ตัดลูกหนี้'},
        {id:'end',   lane:'acct', rank:6, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'n6'},
        {from:'n6', to:'n7'},
        {from:'n7', to:'end'}
      ],
      narrative:[
        '1. บันทึกความคืบหน้าโครงการ (Project Progress) ใน Module OF',
        '» เลือก/ระบุ Payment Type: Down (เงินล่วงหน้า) / Progress (เงินงวดงาน) / Retention (เงินประกันผลงาน)',
        '» Save เพื่อบันทึก',
        '2. ยืนยันการเบิกผลงาน / Submit Certificate',
        '3. แผนกบัญชีเปิดใบแจ้งหนี้ โดยระบุประเภทการเบิก 3 ประเภท: Down / Progress / Retention',
        '4. บันทึกตั้งลูกหนี้ รายได้',
        '5. ออกใบเสร็จรับเงิน',
        '6. บันทึกรับชำระเงินตามใบเสร็จรับเงิน',
        '7. บันทึกตัดลูกหนี้'
      ]
    },
    {
      id:'AR-1.1b', module:'AR',
      titleTH:'การออกใบแจ้งหนี้ประเภทอื่น ๆ (Invoice Other)',
      titleEN:'Other invoices (Invoice Other)',
      lanes:[
        {key:'acct', name:'ฝ่ายบัญชี', sub:'Module AR', module:'AR'},
        {key:'fin',  name:'ฝ่ายการเงิน', sub:'', module:''}
      ],
      nodes:[
        {id:'start', lane:'acct', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'acct', rank:1, type:'process', label:'1. กำหนดข้อมูลรายได้อื่น ๆ'},
        {id:'n2',    lane:'acct', rank:2, type:'process', label:'2. บันทึกใบแจ้งหนี้ (Invoice Other)'},
        {id:'n3',    lane:'acct', rank:3, type:'process', label:'3. ตั้งหนี้ลูกหนี้ รายได้'},
        {id:'n4',    lane:'fin',  rank:3, type:'process', label:'4. บันทึกใบเสร็จรับเงิน / ใบกำกับภาษี'},
        {id:'n5',    lane:'fin',  rank:4, type:'process', label:'5. บันทึกรับเงินตามใบเสร็จ'},
        {id:'n6',    lane:'acct', rank:4, type:'process', label:'6. ตัดลูกหนี้'},
        {id:'end',   lane:'acct', rank:5, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'n5'},
        {from:'n5', to:'n6'},
        {from:'n6', to:'end'}
      ],
      narrative:[
        'การบันทึก AR - Invoice Other',
        '1. กำหนดข้อมูลประเภทรายได้อื่น ๆ ซึ่งเชื่อมโยงกับรหัสบัญชีที่ต้องการบันทึกรายได้อื่น ๆ (Master Type Of Income >> Revenue Other)',
        '2. ฝ่ายบัญชีบันทึกใบแจ้งหนี้ประเภทอื่น ๆ',
        '» เลือก Type : Trading หรือ Service',
        '» ระบุรายการของใบแจ้งหนี้อื่น ๆ',
        '» ระบุจำนวนหน่วย / ราคาต่อหน่วย / จำนวนเงินรวม',
        '3. ฝ่ายบัญชีบันทึกตั้งลูกหนี้ รายได้',
        '4. ฝ่ายการเงินออกใบเสร็จรับเงิน',
        '5. ฝ่ายการเงินบันทึกรับชำระเงินตามใบเสร็จรับเงิน',
        '6. ฝ่ายบัญชีบันทึกตัดลูกหนี้'
      ]
    },
    {
      id:'AR-1.2', module:'AR',
      titleTH:'การทำบันทึกรับเงินลูกหนี้อื่น ๆ แบบไม่ออกใบแจ้งหนี้',
      titleEN:'Receive from other debtors (no invoice)',
      lanes:[
        {key:'acct', name:'ฝ่ายบัญชี / ฝ่ายการเงิน', sub:'Module AR', module:'AR'}
      ],
      nodes:[
        {id:'start', lane:'acct', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'acct', rank:1, type:'process', label:'1. ทำรายการบันทึกรายละเอียด และจำนวนเงิน Dr. Cr.'},
        {id:'n2',    lane:'acct', rank:2, type:'process', label:'2. กด Save เพื่อบันทึก (RV)'},
        {id:'end',   lane:'acct', rank:3, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'end'}
      ],
      narrative:[
        'การบันทึกรับเงินลูกหนี้อื่น ๆ แบบไม่ออกใบแจ้งหนี้ — กรณีรับชำระเงินจากลูกหนี้โดยไม่ผ่านการบันทึกใบแจ้งหนี้ (Invoice)',
        '1. ฝ่ายบัญชี/การเงิน บันทึกเอกสารโดยระบุข้อมูล',
        '» เลือกโครงการ หรือแผนก',
        '» ระบุ Option Type เลือกประเภทรายได้',
        '» ระบุจำนวนเงิน / ระบุว่าเงินเข้าธนาคาร / ระบุเงื่อนไข / ระบุหมายเหตุ (Remark)',
        '» เลือกรหัสบัญชี Dr. / Cr. ตามที่เกิดขึ้นจริง เช่น Dr. ธนาคาร / Cr. รายได้',
        '2. ตรวจสอบความถูกต้องของการบันทึก จากนั้นบันทึกเอกสาร (RV)'
      ]
    },

    /* ===== FA — Fixed Assets ===== */
    {
      id:'FA-1.1', module:'FA',
      titleTH:'การบันทึกทรัพย์สิน (FA)',
      titleEN:'Record fixed asset',
      lanes:[
        {key:'fa', name:'หน่วยงานผู้ดูแลทรัพย์สิน', sub:'Module FA', module:'FA'},
        {key:'gl', name:'ฝ่ายบัญชี', sub:'GL Module', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'fa', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'fa', rank:1, type:'process', label:'1. บันทึกทรัพย์สิน (Fix Asset)'},
        {id:'n2',    lane:'fa', rank:2, type:'process', label:'2. ตรวจนับทรัพย์สิน'},
        {id:'n3',    lane:'fa', rank:3, type:'process', label:'3. คำนวณค่าเสื่อมราคา ณ สิ้นเดือน'},
        {id:'gl',    lane:'gl', rank:3, type:'process', label:'บันทึกบัญชีสมุดรายวันทั่วไป'},
        {id:'end',   lane:'gl', rank:4, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'n3'},
        {from:'n3', to:'gl'},
        {from:'gl', to:'end'}
      ],
      narrative:[
        'หน่วยงานผู้ดูแลทรัพย์สิน:',
        '1. บันทึกทรัพย์สินในระบบ (Fix Asset)',
        '2. ทุกสิ้นเดือน บันทึกตรวจนับทรัพย์สินที่อยู่แต่ละหน่วยงาน / โครงการ หรือแผนกต่าง ๆ',
        '3. เมื่อถึงสิ้นเดือน บันทึกคำนวณค่าเสื่อมราคาที่ FA Depreciation',
        'ฝ่ายบัญชี: บันทึกปรับปรุงค่าเสื่อมราคาทรัพย์สินที่ Module GL',
        '! การบันทึกบัญชี: Dr. ค่าเสื่อมราคา - ทรัพย์สิน / Cr. ค่าเสื่อมราคาสะสม - ทรัพย์สิน'
      ]
    },
    {
      id:'FA-1.2', module:'FA',
      titleTH:'การบันทึกทรัพย์สิน กรณีโอนย้ายทรัพย์สิน (FA Transfer)',
      titleEN:'Asset transfer',
      lanes:[
        {key:'fa', name:'หน่วยงานผู้ดูแลทรัพย์สิน', sub:'Module FA', module:'FA'},
        {key:'gl', name:'ฝ่ายบัญชี', sub:'Module GL', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'fa', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'fa', rank:1, type:'process', label:'1. บันทึกโอนย้ายทรัพย์สิน'},
        {id:'n2',    lane:'fa', rank:2, type:'process', label:'2. คำนวณค่าเสื่อมราคา ณ สิ้นเดือน'},
        {id:'gl',    lane:'gl', rank:2, type:'process', label:'บันทึกบัญชีสมุดรายวันทั่วไป'},
        {id:'end',   lane:'gl', rank:3, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'n2'},
        {from:'n2', to:'gl'},
        {from:'gl', to:'end'}
      ],
      narrative:[
        'หน่วยงานผู้ดูแลทรัพย์สิน:',
        '1. บันทึกโอนย้ายทรัพย์สิน — ค่าเสื่อมราคาประจำเดือนจะถูกบันทึกที่หน่วยงานปลายทาง (กรณีโอนย้ายประเภท Transfer)',
        '2. เมื่อถึงสิ้นเดือน บันทึกคำนวณค่าเสื่อมราคาที่ FA Depreciation',
        'ฝ่ายบัญชี: บันทึกปรับปรุงค่าเสื่อมราคาทรัพย์สินที่ Module GL',
        '! Dr. ค่าเสื่อมราคา - ทรัพย์สิน / Cr. ค่าเสื่อมราคาสะสม - ทรัพย์สิน'
      ]
    },
    {
      id:'FA-1.3', module:'FA',
      titleTH:'การบันทึกทรัพย์สิน กรณีตัดจ่ายทรัพย์สิน (FA Write Off)',
      titleEN:'Asset write-off',
      lanes:[
        {key:'fa', name:'หน่วยงานผู้ดูแลทรัพย์สิน', sub:'Module FA', module:'FA'},
        {key:'gl', name:'ฝ่ายบัญชี', sub:'Module GL', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'fa', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'fa', rank:1, type:'process', label:'1. บันทึกตัดจ่ายทรัพย์สิน'},
        {id:'gl1',   lane:'gl', rank:1, type:'process', label:'2. บันทึกบัญชีสมุดรายวันทั่วไป'},
        {id:'n3',    lane:'fa', rank:2, type:'process', label:'3. คำนวณค่าเสื่อมราคา ณ สิ้นเดือน'},
        {id:'gl2',   lane:'gl', rank:2, type:'process', label:'บันทึกบัญชีสมุดรายวันทั่วไป'},
        {id:'end',   lane:'gl', rank:3, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'gl1'},
        {from:'n1', to:'n3'},
        {from:'gl1', to:'gl2'},
        {from:'n3', to:'gl2'},
        {from:'gl2', to:'end'}
      ],
      narrative:[
        '1. ระบุทรัพย์สินที่จะตัดจ่าย ทรัพย์สินมี 3 ประเภท: 1.1 ขาย (Sale) / 1.2 หมดอายุ (Expired) / 1.3 สูญหาย (Loss)',
        '2. บันทึกตัดจ่ายทรัพย์สินที่ Module FA',
        '3. ณ สิ้นเดือน คำนวณค่าเสื่อมราคา และบันทึกบัญชีที่ Module GL',
        '! 1.1 ขาย: Dr. ธนาคาร/เงินสด, ค่าเสื่อมราคาสะสม, ค่าเสื่อมราคา (ถึงวันขาย), กำไร(ขาดทุน)จากการขาย / Cr. ทรัพย์สิน, กำไร(ขาดทุน)จากการขาย — Book value = ราคาทรัพย์สิน หัก ค่าเสื่อมราคาสะสม',
        '! 1.2 หมดอายุ: Dr. ค่าเสื่อมราคาสะสม / Cr. ทรัพย์สิน',
        '! 1.3 สูญหาย: Dr. ค่าเสื่อมราคาสะสม, ขาดทุนจากทรัพย์สินสูญหาย / Cr. ทรัพย์สิน'
      ]
    },

    /* ===== GL — General Ledger ===== */
    {
      id:'GL-1.1', module:'GL',
      titleTH:'การบันทึกบัญชี',
      titleEN:'Journal entries',
      lanes:[
        {key:'gl', name:'ฝ่ายบัญชี', sub:'GL Module', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'gl', rank:0, type:'start',   label:'Start'},
        {id:'n1',    lane:'gl', rank:1, type:'process', label:'1. บันทึกปรับปรุงรายการ (JV)'},
        {id:'jv1',   lane:'gl', rank:2, type:'process', label:'JV.'},
        {id:'src',   lane:'gl', rank:3, type:'process', label:'ข้อมูลจาก Module ต่าง ๆ'},
        {id:'adj',   lane:'gl', rank:4, type:'process', label:'บันทึกปรับปรุงรายการ'},
        {id:'jv2',   lane:'gl', rank:5, type:'process', label:'JV.'},
        {id:'end',   lane:'gl', rank:6, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'n1'},
        {from:'n1', to:'jv1'},
        {from:'jv1', to:'src'},
        {from:'src', to:'adj'},
        {from:'adj', to:'jv2'},
        {from:'jv2', to:'end'}
      ],
      narrative:[
        '1. การบันทึกปรับปรุงรายการ (JV) เช่น สมุดรายวันซื้อ / ทั่วไป / จ่าย / รับ',
        '» GL Module > บันทึกรายการ > บันทึกสมุดรายวัน > สร้างใบสำคัญ',
        '2. การบันทึกบัญชีแบบอัตโนมัติ — ข้อมูลส่งมาจาก Module อื่น ๆ ดังนี้',
        '» FA Depreciation (ค่าเสื่อมราคา) / FA Write off (ตัดจำหน่ายทรัพย์สิน) / IC (ตัดและโอนย้ายต้นทุนวัสดุ)',
        '» Copy Voucher / Reverse Voucher (กลับรายการ) / Rental (ค่าเช่าทรัพย์สิน)',
        '» Unbill progress submit / Retention Write off / PO Write off',
        '» Cost Sheet (ต้นทุนอสังหาฯ) / Report GL (ปรับปรุงรายได้-ต้นทุน) / MA to GL (ค่าซ่อม) / RE WIP Out (ต้นทุนบ้านสร้างเสร็จ)'
      ]
    },
    {
      id:'GL-1.2', module:'GL',
      titleTH:'การพิมพ์รายงาน',
      titleEN:'Print reports',
      lanes:[
        {key:'gl', name:'ฝ่ายบัญชี', sub:'GL Module', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'gl', rank:0, type:'start',   label:'Start'},
        {id:'p1',    lane:'gl', rank:1, type:'process', label:'1. พิมพ์รายงานบัญชีแยกประเภท'},
        {id:'r1',    lane:'gl', rank:2, type:'process', label:'Report (1-8)'},
        {id:'p2',    lane:'gl', rank:3, type:'process', label:'2. พิมพ์รายงานงบทดลอง'},
        {id:'r2',    lane:'gl', rank:4, type:'process', label:'Report (1-2)'},
        {id:'end',   lane:'gl', rank:5, type:'end',     label:'End'}
      ],
      edges:[
        {from:'start', to:'p1'},
        {from:'p1', to:'r1'},
        {from:'r1', to:'p2'},
        {from:'p2', to:'r2'},
        {from:'r2', to:'end'}
      ],
      narrative:[
        '1. การพิมพ์รายงานบัญชีแยกประเภท',
        '» GL > Report > รายงานบัญชีแยกประเภท (General ledger)',
        '» รายงานต่าง ๆ: 1) รายละเอียด (Detail) 2) Detail ตามโครงการ/แผนก 3) รายงานงบทดลอง 4) งบทดลองตามโครงการ/แผนก',
        '» 5) บัญชีแยกประเภท (ก่อน/หลัง) 6) งบทดลอง 7) สถานะรายรับรายจ่ายแต่ละโครงการ 8) ทุก Module แต่ไม่มีรายละเอียดโครงการ',
        '2. การพิมพ์รายงานงบทดลอง',
        '» GL > Report > งบทดลอง',
        '» เรียกรายงานตามประเภท: 1) Period 2) Year'
      ]
    },

    /* ===== Period-end close (AP → AR → GL) ===== */
    {
      id:'AP-Close', module:'AP',
      titleTH:'การปิดงบการเงิน — โอนข้อมูล AP ไปบัญชีแยกประเภท',
      titleEN:'Period close — AP to GL',
      lanes:[
        {key:'a', name:'ฝ่ายบัญชี', sub:'', module:'AP'},
        {key:'b', name:'ฝ่ายบัญชี', sub:'', module:'AP'}
      ],
      nodes:[
        {id:'start', lane:'a', rank:0, type:'start',    label:'เริ่มต้น'},
        {id:'n11',   lane:'a', rank:1, type:'process',  label:'1.1 กระทบยอด AP ↔ GL'},
        {id:'n12',   lane:'b', rank:1, type:'process',  label:'1.2 กระทบการบันทึก Cost Code'},
        {id:'dec',   lane:'a', rank:2, type:'decision', label:'ตรวจสอบ?'},
        {id:'fix',   lane:'b', rank:3, type:'process',  label:'แก้ไข transaction'},
        {id:'post',  lane:'a', rank:3, type:'process',  label:'1.3 โอนข้อมูลไปบัญชีแยกประเภท'},
        {id:'end',   lane:'a', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n11'},
        {from:'n11', to:'n12'},
        {from:'n12', to:'dec'},
        {from:'dec', to:'post', label:'ถูกต้อง', kind:'yes'},
        {from:'dec', to:'fix', label:'ไม่ถูกต้อง', kind:'reject'},
        {from:'fix', to:'dec'},
        {from:'post', to:'end'}
      ],
      narrative:[
        'การปิดงบการเงิน — โอนข้อมูลจาก AP ไปยังบัญชีแยกประเภท (ข้อมูลการตั้งหนี้/จ่ายชำระอยู่ในระบบ AP เท่านั้น ต้องโอนไป GL ก่อนจึงดูรายงานทางการเงินได้)',
        '1.1 กระทบยอดให้ถูกต้อง ครบถ้วน และตรงกันระหว่างรายงานใน Module AP กับ Module GL เช่น',
        '» รายงานภาษีหัก ณ ที่จ่าย ↔ บัญชีภาษีหัก ณ ที่จ่าย',
        '» รายงานภาษีซื้อ ↔ บัญชีภาษีซื้อ',
        '» รายงานเจ้าหนี้คงเหลือ ↔ บัญชีเจ้าหนี้',
        '1.2 กระทบยอดการบันทึก Cost Code ให้ครบถ้วน (เทียบ Project status : GL = Project Cost control Report > Summary by Project : GL)',
        '1.3 ส่งข้อมูลไประบบบัญชีแยกประเภท — ระบุ ปี/งวดบัญชี โอนทีละกลุ่มเอกสาร: APV (PO) / APS (Subcontractor) / APO (Other) / PL (ยกเลิกการโอนเพื่อแก้ไขได้)',
        '1.4 แก้ไข Transaction — ตรวจสอบว่าบัญชี/รายงานใดผิดพลาด แล้วกลับไปแก้ที่ AP Module โดยถอยขั้นตอนทีละ Step จากขั้นตอนสุดท้ายไปถึงจุดที่ผิด'
      ]
    },
    {
      id:'AR-Close', module:'AR',
      titleTH:'การปิดงบการเงิน (2) — โอนข้อมูล AR ไปบัญชีแยกประเภท',
      titleEN:'Period close — AR to GL',
      lanes:[
        {key:'a', name:'ฝ่ายบัญชี', sub:'', module:'AR'},
        {key:'b', name:'ฝ่ายบัญชี', sub:'', module:'AR'}
      ],
      nodes:[
        {id:'start', lane:'a', rank:0, type:'start',    label:'เริ่มต้น'},
        {id:'n21',   lane:'a', rank:1, type:'process',  label:'2.1 กระทบยอด AR ↔ GL'},
        {id:'dec',   lane:'a', rank:2, type:'decision', label:'ตรวจสอบ?'},
        {id:'fix',   lane:'b', rank:2, type:'process',  label:'แก้ไข transaction'},
        {id:'post',  lane:'a', rank:3, type:'process',  label:'2.2 โอนข้อมูลไปบัญชีแยกประเภท'},
        {id:'end',   lane:'a', rank:4, type:'end',      label:'End'}
      ],
      edges:[
        {from:'start', to:'n21'},
        {from:'n21', to:'dec'},
        {from:'dec', to:'post', label:'ถูกต้อง', kind:'yes'},
        {from:'dec', to:'fix', label:'ไม่ถูกต้อง', kind:'reject'},
        {from:'fix', to:'dec'},
        {from:'post', to:'end'}
      ],
      narrative:[
        'โอนข้อมูลจาก AR ไปยังบัญชีแยกประเภท (การรับรู้รายได้/รายได้รับล่วงหน้าอยู่ในระบบ AR เท่านั้น ต้องโอนไป GL ก่อน)',
        '2.1 กระทบยอดให้ถูกต้อง ครบถ้วน และตรงกันระหว่างรายงานใน Module AR กับ Module GL เช่น',
        '» รายงานภาษีถูกหัก ณ ที่จ่าย ↔ บัญชีภาษีถูกหัก ณ ที่จ่าย',
        '» รายงานภาษีขาย ↔ บัญชีภาษีขาย',
        '» รายงานลูกหนี้คงเหลือ ↔ บัญชีลูกหนี้',
        '2.2 ส่งข้อมูลไประบบบัญชีแยกประเภท — ระบุ ปี/งวดบัญชี/Data Type/กลุ่มเอกสาร โอนทีละกลุ่ม: AR (Construction) / AR (Trading) / AR (Other) / AR (Real Estate) / RL-RV'
      ]
    },
    {
      id:'GL-Close', module:'GL',
      titleTH:'การปิดงบการเงิน (3) — Posting และปิดบัญชี',
      titleEN:'Period close — posting & close year',
      lanes:[
        {key:'gl', name:'ฝ่ายบัญชี', sub:'GL Module', module:'GL'}
      ],
      nodes:[
        {id:'start', lane:'gl', rank:0, type:'start',   label:'เริ่มต้น'},
        {id:'n3',    lane:'gl', rank:1, type:'process', label:'3. ผ่านรายการบัญชีแยกประเภท (Posting)'},
        {id:'n4',    lane:'gl', rank:2, type:'process', label:'4. สร้างรายงานทางการเงิน'},
        {id:'fmt',   lane:'gl', rank:3, type:'process', label:'รูปแบบของรายงาน'},
        {id:'n41',   lane:'gl', rank:4, type:'process', label:'4.1 พิมพ์รายงานทางการเงินต่าง ๆ'},
        {id:'n5',    lane:'gl', rank:5, type:'process', label:'5. ทำการปิดบัญชี – Close Year'},
        {id:'end',   lane:'gl', rank:6, type:'end',     label:'สิ้นสุดงานปิดบัญชี'}
      ],
      edges:[
        {from:'start', to:'n3'},
        {from:'n3', to:'n4'},
        {from:'n4', to:'fmt'},
        {from:'fmt', to:'n41'},
        {from:'n41', to:'n5'},
        {from:'n5', to:'end'}
      ],
      narrative:[
        '3. ผ่านรายการไปยังบัญชีแยกประเภท (Posting) — หลังโอนข้อมูลจาก AP และ AR มาที่ GL ข้อมูลในสมุดรายวันจะมีสถานะ Not post (N) ต้องทำ Posting โดยระบุ GL Year และ GL Period (เลือก Post บางรายการได้ ระบุเลขที่/วันที่ Voucher; ยกเลิก Post เพื่อแก้ไขได้)',
        '4. สร้างรายงานทางการเงิน (Custom Financial Report) — เช่น งบแสดงฐานะการเงิน / งบกำไรขาดทุน / งบกระแสเงินสด ผ่านข้อมูลที่ Posting แล้ว กำหนดช่วงเวลาได้ (รูปแบบรายงานสร้างครั้งเดียวใช้ได้ตลอด)',
        '4.1 การพิมพ์รายงานทางการเงิน — พิมพ์ได้เมื่อทำขั้นตอนที่ 3 เรียบร้อยแล้ว',
        '5. การปิดบัญชี (Close Year) — หลังสิ้นงวดและตรวจสอบโดยผู้สอบบัญชีแล้ว ปิดรายได้และค่าใช้จ่ายเพื่อเริ่มรอบใหม่ ระบุปีบัญชี และรหัสบัญชีกำไรขาดทุนสุทธิ/กำไรสะสมที่ยังไม่ได้จัดสรร'
      ]
    }
  ];
