ALTER TABLE organizations
    ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial',
    ADD COLUMN license_expires_at TIMESTAMPTZ,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
