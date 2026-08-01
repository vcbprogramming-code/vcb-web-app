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
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
    ...(isProd ? {} : { stack: err.stack }),
  });
}
