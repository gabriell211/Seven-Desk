-- Technician profiles are independent from device activation tokens.
-- Revoking or rotating a computer's activation cannot revoke its technician identity.
CREATE TABLE IF NOT EXISTS seven_desk_technicians (
  user_id uuid NOT NULL REFERENCES seven_users(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 32767),
  technician_name text NOT NULL CHECK (char_length(trim(technician_name)) BETWEEN 2 AND 100),
  technician_image text NOT NULL DEFAULT '' CHECK (char_length(technician_image) <= 512),
  code_hash text UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,slot)
);
-- Retain pre-existing technician profiles when upgrading from the old device table.
INSERT INTO seven_desk_technicians (user_id,slot,technician_name,technician_image)
SELECT user_id,slot,technician_name,technician_image
  FROM seven_desk_app_tokens
 WHERE char_length(trim(technician_name)) BETWEEN 2 AND 100
ON CONFLICT (user_id,slot) DO NOTHING;
