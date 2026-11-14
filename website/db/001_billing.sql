-- Run against a Neon branch with Managed Auth enabled before deploying billing.
CREATE TABLE IF NOT EXISTS seven_desk_subscriptions (
    user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
    paid_through timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seven_desk_payment_orders (
    order_id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
    plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    amount_cents integer NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'paid')),
    transaction_nsu text UNIQUE,
    invoice_slug text,
    checkout_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    CHECK ((plan = 'monthly' AND amount_cents = 3990) OR
           (plan = 'yearly' AND amount_cents = 40000)),
    CHECK ((state = 'pending' AND paid_at IS NULL AND transaction_nsu IS NULL) OR
           (state = 'paid' AND paid_at IS NOT NULL AND transaction_nsu IS NOT NULL))
);
