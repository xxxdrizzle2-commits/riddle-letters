-- Adult synthetic-data workbench only. Additive tables; no historical row is rewritten.
CREATE TABLE IF NOT EXISTS app_school_authorities (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('principal', 'safeguarding-lead')),
  backup_user_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  revoked_at TEXT,
  approved_by TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_school_authorities_school ON app_school_authorities(school_id, kind, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS app_access_grants (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  approved_by TEXT,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  emergency INTEGER NOT NULL DEFAULT 0,
  review_due_at TEXT,
  reviewed_at TEXT,
  revoked_at TEXT,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_access_grants_actor ON app_access_grants(actor_id, target_type, target_id, expires_at);
CREATE INDEX IF NOT EXISTS app_access_grants_review ON app_access_grants(emergency, reviewed_at, review_due_at);

CREATE TABLE IF NOT EXISTS app_evidence_snapshots (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  letter_id TEXT,
  version_id TEXT,
  attachment_id TEXT,
  digest TEXT NOT NULL,
  captured_by TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_evidence_snapshots_case ON app_evidence_snapshots(case_id, captured_at);

CREATE TABLE IF NOT EXISTS app_risk_signals (
  id TEXT PRIMARY KEY,
  volunteer_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_risk_signals_volunteer ON app_risk_signals(volunteer_id, status);

CREATE TABLE IF NOT EXISTS app_dispute_cases (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  pair_id TEXT,
  opened_by TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'joint-review', 'decided')),
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_dispute_cases_school ON app_dispute_cases(school_id, status);

CREATE TABLE IF NOT EXISTS app_support_tasks (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  case_id TEXT,
  pair_id TEXT,
  owner_teacher_id TEXT,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'done')),
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_support_tasks_owner ON app_support_tasks(owner_teacher_id, status, due_at);

CREATE TABLE IF NOT EXISTS app_duty_shifts (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'school')),
  school_id TEXT,
  user_id TEXT NOT NULL,
  backup_user_id TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_duty_shifts_user ON app_duty_shifts(scope, user_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS app_training_records (
  id TEXT PRIMARY KEY,
  volunteer_id TEXT NOT NULL,
  version TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS app_training_records_version ON app_training_records(volunteer_id, version);

CREATE TABLE IF NOT EXISTS app_plan_policies (
  id TEXT PRIMARY KEY,
  child_max_active_pairs INTEGER NOT NULL,
  volunteer_max_active_pairs INTEGER NOT NULL,
  new_pair_cooldown_days INTEGER NOT NULL,
  data_json TEXT NOT NULL
);

ALTER TABLE app_help_cases ADD COLUMN severity TEXT;
ALTER TABLE app_help_cases ADD COLUMN sla_due_at TEXT;
ALTER TABLE app_help_cases ADD COLUMN report_required INTEGER;
ALTER TABLE app_help_cases ADD COLUMN reported_at TEXT;

ALTER TABLE app_access_audit_events ADD COLUMN grant_id TEXT;
ALTER TABLE app_access_audit_events ADD COLUMN severity TEXT;
ALTER TABLE app_access_audit_events ADD COLUMN reason_code TEXT;
