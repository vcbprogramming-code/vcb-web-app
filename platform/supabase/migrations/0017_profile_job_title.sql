-- User profile: job title shown under the signature on memos (e.g. "ผู้จัดการ
-- ฝ่ายวิศวกรรม"). profiles.signature_url already exists for the default signature
-- image; this adds the title. Both are editable on the "My Profile" page.

alter table profiles
  add column if not exists job_title text;
