-- The first approval step is the ผู้จัดการโครงการ / ผู้ลงนาม (signer): they approve
-- first, and their signature is stamped under "ขอแสดงความนับถือ" (not in the
-- ผู้อนุมัติ row), so a PM who is also an approver never signs twice.
alter table approval_steps add column if not exists is_signer boolean not null default false;
