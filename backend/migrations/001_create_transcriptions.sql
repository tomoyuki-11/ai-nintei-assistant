CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE transcriptions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    text       TEXT        NOT NULL,
    formatted  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
