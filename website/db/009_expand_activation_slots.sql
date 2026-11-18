-- Activation slots above five are permitted only when the account owns paid extra_slots.
-- Keep this storage constraint aligned with smallint and getMaxSlots().
ALTER TABLE seven_desk_app_tokens
  DROP CONSTRAINT IF EXISTS seven_desk_app_tokens_slot_check;
ALTER TABLE seven_desk_app_tokens
  ADD CONSTRAINT seven_desk_app_tokens_slot_check
  CHECK (slot BETWEEN 1 AND 32767);
