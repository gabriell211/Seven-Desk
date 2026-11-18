-- Better Auth creates the nullable additionalFields columns before these migrations.
-- Existing legacy accounts keep NULL until they undergo a verified upgrade.
ALTER TABLE seven_users
  ADD COLUMN IF NOT EXISTS "accountType" text,
  ADD COLUMN IF NOT EXISTS "taxIdHash" text;
ALTER TABLE seven_users
  ADD CONSTRAINT seven_users_account_type_valid
    CHECK ("accountType" IS NULL OR "accountType" IN ('PF','PJ'));
ALTER TABLE seven_users
  ADD CONSTRAINT seven_users_tax_id_hash_valid
    CHECK ("taxIdHash" IS NULL OR "taxIdHash" ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS seven_users_tax_id_unique
  ON seven_users ("taxIdHash") WHERE "taxIdHash" IS NOT NULL;
