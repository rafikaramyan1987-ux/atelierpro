-- Add workspace_name column to repair_orders
-- The application code reads/writes this column but no migration had created it.
ALTER TABLE repair_orders ADD COLUMN IF NOT EXISTS workspace_name text;