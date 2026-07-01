ALTER TABLE organizations
  ADD COLUMN transcription_save_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
  ADD COLUMN formatted_save_mode VARCHAR(20) NOT NULL DEFAULT 'auto';
