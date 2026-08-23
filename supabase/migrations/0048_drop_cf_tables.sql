-- Remove the cf_* tables added in 0047.
--
-- 0047 was a mistake: it built a second credit-facility schema alongside the one
-- this system has had since Module 3 (facilities / credit_ledger / credit_requests
-- / credit_audit / cash_plans). Two schemas for the same subject is worse than
-- either one alone — a later reader cannot tell which holds the real figures.
--
-- Nothing is lost: every cf_ table was empty except cf_facility_types, which held
-- only the ten reference rows seeded by 0047 itself. The existing module keeps
-- its data untouched.
drop table if exists cf_audit;
drop table if exists cf_category_caps;
drop table if exists cf_requests;
drop table if exists cf_transactions;
drop table if exists cf_facilities;
drop table if exists cf_facility_types;
