CREATE TABLE IF NOT EXISTS app_meta (
  id TEXT PRIMARY KEY CHECK (id = 'main'),
  revision INTEGER NOT NULL DEFAULT 0,
  clock TEXT NOT NULL
);
INSERT OR IGNORE INTO app_meta (id, revision, clock)
VALUES ('main', 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- A failed compare-and-swap inserts 0 and violates this CHECK, rolling back the D1 batch.
CREATE TABLE IF NOT EXISTS app_write_guard (
  value INTEGER NOT NULL CHECK (value = 1)
);

CREATE TABLE IF NOT EXISTS app_accounts (
  user_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('child','volunteer','teacher','operator')),
  status TEXT NOT NULL CHECK (status IN ('pending','active','disabled')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_applications_user ON app_applications(user_id, status);
CREATE TABLE IF NOT EXISTS app_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_consents (
  id TEXT PRIMARY KEY,
  child_id TEXT,
  teacher_id TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_privacy_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_people (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  nickname TEXT NOT NULL,
  teacher_id TEXT,
  account_status TEXT,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_people_role_status ON app_people(role, account_status);
CREATE TABLE IF NOT EXISTS app_pairs (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  volunteer_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_pairs_child_status ON app_pairs(child_id, status);
CREATE INDEX IF NOT EXISTS app_pairs_volunteer_status ON app_pairs(volunteer_id, status);
CREATE INDEX IF NOT EXISTS app_pairs_teacher_status ON app_pairs(teacher_id, status);
CREATE TABLE IF NOT EXISTS app_letters (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  recipient_id TEXT,
  created_by TEXT NOT NULL,
  reply_to TEXT,
  moderation TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_letters_pair_updated ON app_letters(pair_id, updated_at);
CREATE INDEX IF NOT EXISTS app_letters_recipient_moderation ON app_letters(recipient_id, moderation);
CREATE INDEX IF NOT EXISTS app_letters_author_moderation ON app_letters(author_id, moderation);
CREATE TABLE IF NOT EXISTS app_letter_versions (
  letter_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (letter_id, revision)
);
CREATE TABLE IF NOT EXISTS app_deliveries (
  letter_id TEXT PRIMARY KEY,
  printed_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_reply_tasks (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL UNIQUE,
  pair_id TEXT NOT NULL,
  recipient_id TEXT,
  status TEXT NOT NULL,
  due_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_reply_tasks_recipient_due ON app_reply_tasks(recipient_id, status, due_at);
CREATE TABLE IF NOT EXISTS app_reviews (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_reviews_letter ON app_reviews(letter_id, created_at);
CREATE TABLE IF NOT EXISTS app_followups (
  id TEXT PRIMARY KEY,
  pair_id TEXT,
  task_id TEXT,
  requester_id TEXT,
  owner_id TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  next_followup_at TEXT,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_followups_owner_status ON app_followups(owner_id, status, next_followup_at);
CREATE TABLE IF NOT EXISTS app_attachments (
  id TEXT PRIMARY KEY,
  pair_id TEXT,
  owner_id TEXT,
  storage_path TEXT,
  size INTEGER,
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_receipts (
  actor_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (actor_id, request_id)
);
CREATE INDEX IF NOT EXISTS app_receipts_created_at ON app_receipts(created_at);
CREATE TABLE IF NOT EXISTS app_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_audit_actor_created ON app_audit_events(actor_id, created_at);
CREATE TABLE IF NOT EXISTS app_rate_limits (
  rate_key TEXT PRIMARY KEY,
  minute INTEGER NOT NULL,
  count INTEGER NOT NULL
);
