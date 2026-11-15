ALTER TABLE seven_desk_app_tokens DROP CONSTRAINT seven_desk_app_tokens_pkey;
ALTER TABLE seven_desk_app_tokens
    ADD COLUMN slot smallint NOT NULL DEFAULT 1 CHECK (slot BETWEEN 1 AND 5),
    ADD COLUMN label text NOT NULL DEFAULT 'Meu computador' CHECK (char_length(label) BETWEEN 1 AND 60),
    ADD COLUMN device_hash text CHECK (device_hash ~ '^[0-9a-f]{64}$');
ALTER TABLE seven_desk_app_tokens ADD PRIMARY KEY (user_id, slot);
