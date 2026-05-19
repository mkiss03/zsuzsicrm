-- Add signature_data column to booking_contracts
-- Stores the base64-encoded PNG image of a handwritten canvas signature.
-- NULL for typed (text-only) signatures.

alter table booking_contracts
  add column if not exists signature_data text;

comment on column booking_contracts.signature_data is
  'Base64-encoded PNG data URL of the handwritten canvas signature. NULL for typed signatures.';
