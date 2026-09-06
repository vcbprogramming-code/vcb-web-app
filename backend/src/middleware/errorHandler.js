import { isProd } from '../config/env.js';

/** Throwable error that carries an HTTP status code. */
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

/** Multer rejects an oversized/malformed upload with its own error class, which
 *  carried no `status` and so surfaced as a 500 "Internal server error" — the user
 *  saw a crash instead of "the file is too large". Map them to 400/413 in Thai. */
const MULTER_MESSAGE = {
  LIMIT_FILE_SIZE: 'ไฟล์มีขนาดใหญ่เกินกำหนด กรุณาลดขนาดไฟล์แล้วลองใหม่',
  LIMIT_FILE_COUNT: 'แนบไฟล์เกินจำนวนที่กำหนดในครั้งเดียว',
  LIMIT_UNEXPECTED_FILE: 'รูปแบบการส่งไฟล์ไม่ถูกต้อง',
  LIMIT_PART_COUNT: 'ข้อมูลที่ส่งมามีจำนวนส่วนเกินกำหนด',
};

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
export function errorHandler(err, req, res, next) {
  if (err?.name === 'MulterError' && !err.status) {
    const msg = MULTER_MESSAGE[err.code] || 'อัปโหลดไฟล์ไม่สำเร็จ';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: msg, code: err.code });
  }
  // ฐานข้อมูลตอบรหัส 22P02 เมื่อค่าที่ส่งมาไม่ใช่รูปแบบของคอลัมน์นั้น — เกิดตอน
  // เปิดลิงก์เก่าที่รหัสเพี้ยน หรือแก้ URL เอง นั่นคือคำขอที่ผิด ไม่ใช่ระบบพัง
  // และข้อความดิบจากฐานข้อมูล ('invalid input syntax for type uuid') ไม่ควร
  // หลุดไปถึงหน้าจอผู้ใช้
  const PG_BAD_INPUT = new Set(['22P02', '22003', '22007', '22008', '22001']);
  if (!err?.status && PG_BAD_INPUT.has(err?.code)) {
    return res.status(400).json({ error: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    // ความผิดพลาดฝั่งเซิร์ฟเวอร์เก็บรายละเอียดไว้ใน log เท่านั้น ผู้ใช้เห็นข้อความ
    // ที่อ่านรู้เรื่องแทนข้อความภายในระบบ
    error: (status >= 500 && isProd) ? 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' : (err.message || 'Internal server error'),
    ...(err.details ? { details: err.details } : {}),
    ...(isProd ? {} : { stack: err.stack }),
  });
}
