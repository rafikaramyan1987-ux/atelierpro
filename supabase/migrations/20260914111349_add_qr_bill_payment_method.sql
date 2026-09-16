/*
# Add QR-bill payment method to invoices

## Changes
1. Add 'qr_bill' to the payment_method CHECK constraint on invoices
   - Allows invoices to be marked as paid via Swiss QR-bill (QR-facture)
   - Existing payment methods (twint, especes, carte, virement) remain unchanged

## Security
- No RLS policy changes needed
- Only modifies the CHECK constraint on the invoices table
*/

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check
  CHECK (payment_method IN ('twint', 'especes', 'carte', 'virement', 'qr_bill'));
