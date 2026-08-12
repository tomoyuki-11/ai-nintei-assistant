ALTER TABLE password_reset_tokens
    ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 minutes');
