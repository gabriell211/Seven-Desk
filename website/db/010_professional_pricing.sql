-- Preserve existing orders and allow the approved Professional launch prices.
ALTER TABLE seven_desk_payment_orders
    DROP CONSTRAINT IF EXISTS seven_desk_payment_orders_amount_cents_check;
ALTER TABLE seven_desk_payment_orders
    ADD CONSTRAINT seven_desk_payment_orders_amount_cents_check
    CHECK ((plan = 'monthly' AND amount_cents IN (1990, 3990)) OR
           (plan = 'yearly' AND amount_cents IN (19990, 40000)) OR
           (plan = 'extra_slot' AND amount_cents = 700));
