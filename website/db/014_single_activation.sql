-- Single-key issuance needs no secondary credential. Keep hashes of legacy pairs.
ALTER TABLE seven_desk_team_activations ALTER COLUMN technician_hash DROP NOT NULL;
