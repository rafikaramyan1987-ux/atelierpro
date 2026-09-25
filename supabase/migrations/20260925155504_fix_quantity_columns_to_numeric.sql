-- Fix: labour hours are decimal (e.g. 2.5) but quantity columns are integer, causing insert failures

ALTER TABLE devis_items ALTER COLUMN quantity TYPE numeric(10,2);
ALTER TABLE invoice_items ALTER COLUMN quantity TYPE numeric(10,2);
ALTER TABLE repair_order_items ALTER COLUMN quantity TYPE numeric(10,2);
