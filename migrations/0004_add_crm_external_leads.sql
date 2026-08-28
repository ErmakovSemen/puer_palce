ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS profile_url text;
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_external_id_unique ON crm_contacts(external_id) WHERE external_id IS NOT NULL;
