ALTER TABLE organizations ADD COLUMN license_key TEXT UNIQUE;

UPDATE organizations
    SET license_key = gen_random_uuid()::text
    WHERE license_key IS NULL;

ALTER TABLE organizations ALTER COLUMN license_key SET NOT NULL;
