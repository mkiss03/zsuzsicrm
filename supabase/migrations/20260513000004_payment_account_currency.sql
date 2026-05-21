-- =============================================================================
-- Migration: Add account and currency columns to payments table
-- =============================================================================

alter table payments
  add column if not exists account  text check (account in ('huf_account', 'eur_account', 'revolut')),
  add column if not exists currency text check (currency in ('HUF', 'EUR')) default 'HUF';
