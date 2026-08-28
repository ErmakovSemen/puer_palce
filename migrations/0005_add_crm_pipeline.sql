ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'new';
CREATE INDEX IF NOT EXISTS crm_contacts_pipeline_stage_idx ON crm_contacts(pipeline_stage, owner_id);
