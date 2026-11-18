-- Pairing starts disabled: both the technician code and the device activation
-- are required once before a device can obtain a remote-access license.
ALTER TABLE seven_desk_app_tokens
  ADD COLUMN IF NOT EXISTS technician_verified boolean NOT NULL DEFAULT false;
