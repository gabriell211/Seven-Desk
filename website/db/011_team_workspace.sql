-- Independent team workspaces: individual subscriptions and activation tokens are unchanged.
CREATE TABLE IF NOT EXISTS seven_desk_teams (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES seven_users(id) ON DELETE RESTRICT,
    plan text NOT NULL CHECK (plan IN ('business', 'enterprise')),
    paid_through timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seven_desk_teams_owner_idx ON seven_desk_teams(owner_user_id);

CREATE TABLE IF NOT EXISTS seven_desk_team_seats (
    team_id uuid NOT NULL REFERENCES seven_desk_teams(id) ON DELETE CASCADE,
    seat smallint NOT NULL CHECK (seat BETWEEN 1 AND 10),
    invited_email text NOT NULL CHECK (char_length(invited_email) BETWEEN 3 AND 254 AND invited_email = lower(trim(invited_email))),
    invite_hash text UNIQUE CHECK (invite_hash ~ '^[a-f0-9]{64}$'),
    invite_expires_at timestamptz,
    technician_user_id uuid REFERENCES seven_users(id) ON DELETE RESTRICT,
    accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, seat),
    UNIQUE (team_id, invited_email),
    UNIQUE (team_id, technician_user_id),
    CHECK (
      (technician_user_id IS NULL AND accepted_at IS NULL AND invite_hash IS NOT NULL AND invite_expires_at IS NOT NULL)
      OR
      (technician_user_id IS NOT NULL AND accepted_at IS NOT NULL AND invite_hash IS NULL AND invite_expires_at IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS seven_desk_team_seats_user_idx ON seven_desk_team_seats(technician_user_id);
