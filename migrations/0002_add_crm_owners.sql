CREATE TABLE IF NOT EXISTS crm_admins (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'new';
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS owner_id integer REFERENCES crm_admins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_owner_status_idx ON crm_contacts(owner_id, work_status);
