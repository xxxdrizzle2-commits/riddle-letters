-- Adult synthetic-data workbench only. These additive tables do not authorize a real-child pilot.
CREATE TABLE IF NOT EXISTS app_schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  data_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_teacher_assignments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  child_id TEXT,
  scope_json TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  revoked_at TEXT,
  approved_by TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_teacher_assignments_teacher ON app_teacher_assignments(teacher_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS app_teacher_assignments_child ON app_teacher_assignments(child_id, school_id);

CREATE TABLE IF NOT EXISTS app_help_cases (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  backup_owner_id TEXT,
  school_owner_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_help_cases_owner ON app_help_cases(owner_id, status);
CREATE INDEX IF NOT EXISTS app_help_cases_requester ON app_help_cases(requester_id, created_at);

CREATE TABLE IF NOT EXISTS app_delivery_events (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_delivery_events_letter ON app_delivery_events(letter_id, created_at);

CREATE TABLE IF NOT EXISTS app_manuscript_assets (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('original', 'approved-redacted')),
  storage_path TEXT,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_manuscript_assets_letter ON app_manuscript_assets(letter_id, kind);

CREATE TABLE IF NOT EXISTS app_ocr_runs (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  manuscript_asset_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  source_sha256 TEXT NOT NULL,
  started_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_ocr_runs_letter ON app_ocr_runs(letter_id, started_at);

CREATE TABLE IF NOT EXISTS app_access_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'denied')),
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_access_audit_actor ON app_access_audit_events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS app_access_audit_target ON app_access_audit_events(target_type, target_id, created_at);
CREATE TRIGGER IF NOT EXISTS app_access_audit_no_update
BEFORE UPDATE ON app_access_audit_events
BEGIN
  SELECT RAISE(ABORT, 'access audit is append-only');
END;
CREATE TRIGGER IF NOT EXISTS app_access_audit_no_delete
BEFORE DELETE ON app_access_audit_events
BEGIN
  SELECT RAISE(ABORT, 'access audit is append-only');
END;

ALTER TABLE app_pairs ADD COLUMN school_id TEXT;
ALTER TABLE app_letters ADD COLUMN delivery_route TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS app_pairs_active_child_volunteer
  ON app_pairs(child_id, volunteer_id) WHERE status IN ('active', 'paused');

-- Preserve the frozen adult synthetic accounts under an explicit, temporary demo scope.
-- This is not a school authorization and must never be used for real children.
INSERT OR IGNORE INTO app_schools (id, name, status, data_json)
SELECT 'synthetic-legacy-school', '成年合成身份演示范围', 'active',
  json_object('id', 'synthetic-legacy-school', 'name', '成年合成身份演示范围', 'status', 'active')
WHERE EXISTS (SELECT 1 FROM app_people WHERE role = 'child');

INSERT OR IGNORE INTO app_teacher_assignments
  (id, school_id, teacher_id, child_id, scope_json, starts_at, ends_at, revoked_at, approved_by, data_json)
SELECT 'synthetic-legacy-' || id, 'synthetic-legacy-school', teacher_id, id,
  json_array('status', 'capture', 'paper-delivery'),
  '1970-01-01T00:00:00.000Z', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 year'),
  NULL, 'synthetic-migration',
  json_object('id', 'synthetic-legacy-' || id, 'schoolId', 'synthetic-legacy-school',
    'teacherId', teacher_id, 'childId', id,
    'scope', json_array('status', 'capture', 'paper-delivery'),
    'startsAt', '1970-01-01T00:00:00.000Z',
    'endsAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+1 year'),
    'approvedBy', 'synthetic-migration')
FROM app_people WHERE role = 'child' AND teacher_id IS NOT NULL;

UPDATE app_pairs SET school_id = 'synthetic-legacy-school'
WHERE school_id IS NULL AND EXISTS (SELECT 1 FROM app_schools WHERE id = 'synthetic-legacy-school');
