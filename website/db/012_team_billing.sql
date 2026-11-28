-- Separate team subscriptions from individual access. Preserve legacy orders.
CREATE UNIQUE INDEX IF NOT EXISTS seven_desk_teams_owner_plan_uidx
    ON seven_desk_teams(owner_user_id, plan);

ALTER TABLE seven_desk_payment_orders
    ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES seven_desk_teams(id) ON DELETE RESTRICT;
ALTER TABLE seven_desk_payment_orders
    DROP CONSTRAINT IF EXISTS seven_desk_payment_orders_plan_check;
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_plan_check
    CHECK (plan IN ('monthly', 'yearly', 'extra_slot', 'business', 'enterprise'));
ALTER TABLE seven_desk_payment_orders
    DROP CONSTRAINT IF EXISTS seven_desk_payment_orders_amount_cents_check;
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_amount_cents_check
    CHECK ((plan = 'monthly' AND amount_cents IN (1990, 3990)) OR
           (plan = 'yearly' AND amount_cents IN (19990, 40000)) OR
           (plan = 'extra_slot' AND amount_cents = 700) OR
           (plan = 'business' AND amount_cents = 4990) OR
           (plan = 'enterprise' AND amount_cents = 14990));
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_team_check
    CHECK ((plan IN ('business','enterprise') AND (state <> 'paid' OR team_id IS NOT NULL))
       OR (plan NOT IN ('business','enterprise') AND team_id IS NULL));
