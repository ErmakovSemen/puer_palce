CREATE TABLE IF NOT EXISTS crm_contacts (
  id serial PRIMARY KEY,
  user_id varchar UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  telegram text,
  source text NOT NULL DEFAULT 'manual',
  stage text NOT NULL DEFAULT 'lead',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  last_contact_at text,
  last_visit_at text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'follow_up',
  due_at text,
  status text NOT NULL DEFAULT 'open',
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id serial PRIMARY KEY,
  contact_id integer NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS crm_contacts_stage_idx ON crm_contacts(stage);
CREATE INDEX IF NOT EXISTS crm_tasks_contact_status_idx ON crm_tasks(contact_id, status);
CREATE INDEX IF NOT EXISTS crm_activities_contact_created_idx ON crm_activities(contact_id, created_at DESC);
