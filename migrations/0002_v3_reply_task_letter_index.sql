-- app_reply_tasks.letter_id is empty for a pair's "first-letter" task, so a plain
-- UNIQUE constraint blocks every pairing after the first. Rebuild the table and
-- keep uniqueness only for tasks that point at a real letter.
CREATE TABLE IF NOT EXISTS app_reply_tasks_rebuilt (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  recipient_id TEXT,
  status TEXT NOT NULL,
  due_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);
INSERT INTO app_reply_tasks_rebuilt (id, letter_id, pair_id, recipient_id, status, due_at, data_json)
  SELECT id, letter_id, pair_id, recipient_id, status, due_at, data_json FROM app_reply_tasks;
DROP TABLE app_reply_tasks;
ALTER TABLE app_reply_tasks_rebuilt RENAME TO app_reply_tasks;
CREATE INDEX IF NOT EXISTS app_reply_tasks_recipient_due ON app_reply_tasks(recipient_id, status, due_at);
CREATE UNIQUE INDEX IF NOT EXISTS app_reply_tasks_letter ON app_reply_tasks(letter_id) WHERE letter_id <> '';
