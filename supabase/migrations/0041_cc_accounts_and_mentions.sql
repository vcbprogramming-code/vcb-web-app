-- สำเนาเรียน (CC) as real accounts, and @mentions in the document conversation.
--
-- Until now CC was a single free-text field that a regex scraped addresses out
-- of. That was enough to email someone a read-only link, but the client now
-- wants CC recipients to open the SAME document page as everyone else and take
-- part in the conversation — which needs a real account behind each one.
--
-- documents.cc_recipients is deliberately left alone: it still holds the text
-- printed as "สำเนาเรียน" on the letter, and every existing document keeps
-- exactly what it has today. This table is an additional layer, so nothing that
-- was created before this migration changes or breaks.
create table if not exists document_cc (
  document_id uuid not null references documents(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (document_id, profile_id)
);
create index if not exists document_cc_profile_idx on document_cc (profile_id);

-- Who was tagged in a conversation message. One row per person per message;
-- the notification email is sent from these.
create table if not exists document_message_mentions (
  message_id uuid not null references document_messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index if not exists message_mentions_profile_idx on document_message_mentions (profile_id);
