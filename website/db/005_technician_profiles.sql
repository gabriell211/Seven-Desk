-- Technician identity is owned by the account and assigned per activated device.
-- Display names and images are server-managed; activation tokens never contain profile data.
ALTER TABLE seven_desk_app_tokens
  ADD COLUMN IF NOT EXISTS technician_name text NOT NULL DEFAULT ''
    CHECK (char_length(technician_name) <= 100),
  ADD COLUMN IF NOT EXISTS technician_image text NOT NULL DEFAULT ''
    CHECK (char_length(technician_image) <= 512);
