-- Backfill for the "create as draft" fix. Documents created before that change
-- were inserted with status 'pending' even when no approver was chosen, so they
-- show as "รออนุมัติ" forever with an empty approval chain and no one is ever
-- prompted to act. Move any chain-less pending document back to 'draft' so its
-- owner can edit and submit it properly. Safe/idempotent.
update documents d
   set status = 'draft'
 where d.status = 'pending'
   and not exists (select 1 from approval_steps s where s.document_id = d.id);
