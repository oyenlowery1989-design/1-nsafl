-- Rename asset-specific column to a generic name so this base template
-- doesn't carry a misleadingly NSAFL-named column into a rebrand.
ALTER TABLE "public"."wallet_balances"
  RENAME COLUMN "nsafl_balance" TO "primary_asset_balance";
