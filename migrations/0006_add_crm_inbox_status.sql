ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS inbox_status text NOT NULL DEFAULT 'none';
CREATE INDEX IF NOT EXISTS crm_contacts_inbox_status_idx ON crm_contacts(inbox_status, updated_at DESC);
