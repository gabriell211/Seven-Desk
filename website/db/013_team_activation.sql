-- One device activation per accepted team seat. Revoking a seat deletes its credential.
CREATE TABLE IF NOT EXISTS seven_desk_team_activations (
    team_id uuid NOT NULL,
    seat smallint NOT NULL,
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    technician_hash text NOT NULL UNIQUE CHECK (technician_hash ~ '^[a-f0-9]{64}$'),
    technician_verified boolean NOT NULL DEFAULT false,
    device_hash text CHECK (device_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id,seat),
    FOREIGN KEY (team_id,seat) REFERENCES seven_desk_team_seats(team_id,seat) ON DELETE CASCADE
);
