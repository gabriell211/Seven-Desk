ALTER TABLE seven_desk_subscriptions
    ADD COLUMN IF NOT EXISTS extra_slots integer NOT NULL DEFAULT 0 CHECK (extra_slots >= 0);

ALTER TABLE seven_desk_payment_orders
    DROP CONSTRAINT IF EXISTS seven_desk_payment_orders_plan_check;
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_plan_check
    CHECK (plan IN ('monthly', 'yearly', 'extra_slot'));

ALTER TABLE seven_desk_payment_orders
    DROP CONSTRAINT IF EXISTS seven_desk_payment_orders_amount_cents_check;
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_amount_cents_check
    CHECK ((plan = 'monthly' AND amount_cents = 3990) OR
           (plan = 'yearly' AND amount_cents = 40000) OR
           (plan = 'extra_slot' AND amount_cents = 700));
