ALTER TABLE users DROP CONSTRAINT users_email_key;
ALTER TABLE users ADD CONSTRAINT users_org_login_unique UNIQUE (organization_id, email);
