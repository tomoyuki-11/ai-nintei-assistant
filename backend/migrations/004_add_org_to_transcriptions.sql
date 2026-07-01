ALTER TABLE transcriptions
    ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
