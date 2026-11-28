-- Personal never creates a payment or overwrites a paid subscription.
CREATE TABLE IF NOT EXISTS seven_desk_personal_enrollments (
    user_id uuid PRIMARY KEY REFERENCES seven_users(id) ON DELETE RESTRICT,
    terms_version text NOT NULL CHECK (terms_version = 'personal-v1'),
    accepted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    CHECK (revoked_at IS NULL OR revoked_at >= accepted_at)
);
