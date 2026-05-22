-- ─── lookup_options ──────────────────────────────────────────────────────────
-- Stores display labels, colors and sort order for every status / type category
-- that appears in the UI.  "System" rows (is_system = true) can be edited but
-- not deleted, because their `value` is referenced in application code.
-- Custom rows added by the agency admin can be freely deleted.

CREATE TABLE public.lookup_options (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text        NOT NULL,
  value       text        NOT NULL,
  label       text        NOT NULL,
  color       text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT  lookup_options_category_value_key UNIQUE (category, value)
);

COMMENT ON TABLE  public.lookup_options IS 'Display metadata for every enum-like category in the CRM.';
COMMENT ON COLUMN public.lookup_options.category   IS 'E.g. trip_status, booking_status, client_source …';
COMMENT ON COLUMN public.lookup_options.value      IS 'The raw code value stored in the main tables.';
COMMENT ON COLUMN public.lookup_options.label      IS 'Human-readable Hungarian label shown in the UI.';
COMMENT ON COLUMN public.lookup_options.color      IS 'Tailwind utility classes for the colour badge.';
COMMENT ON COLUMN public.lookup_options.is_system  IS 'System rows may not be deleted.';

-- Row-level security: authenticated users can read; writes go through the
-- service-role admin client (API routes), so no INSERT/UPDATE/DELETE policies.
ALTER TABLE public.lookup_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lookup_options: authenticated read"
  ON public.lookup_options
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── Seed: trip_status ───────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('trip_status', 'planned',    'Tervezett',     'bg-zinc-100 text-zinc-600',   0, true),
  ('trip_status', 'advertised', 'Hirdetve',      'bg-blue-100 text-blue-700',   1, true),
  ('trip_status', 'full',       'Telített',      'bg-amber-100 text-amber-700', 2, true),
  ('trip_status', 'ongoing',    'Folyamatban',   'bg-green-100 text-green-700', 3, true),
  ('trip_status', 'completed',  'Lezárt',        'bg-slate-100 text-slate-600', 4, true),
  ('trip_status', 'cancelled',  'Törölve',       'bg-red-100 text-red-600',     5, true);

-- ─── Seed: booking_status ────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('booking_status', 'interested',  'Érdeklődő',       'bg-purple-100 text-purple-700',  0, true),
  ('booking_status', 'booked',      'Lefoglalt',        'bg-blue-100 text-blue-700',      1, true),
  ('booking_status', 'deposit_paid','Előleg fizetve',   'bg-yellow-100 text-yellow-700',  2, true),
  ('booking_status', 'fully_paid',  'Teljesen fizetve', 'bg-green-100 text-green-700',    3, true),
  ('booking_status', 'completed',   'Teljesített',      'bg-slate-100 text-slate-600',    4, true),
  ('booking_status', 'cancelled',   'Törölve',          'bg-red-100 text-red-600',        5, true);

-- ─── Seed: client_source ─────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('client_source', 'messenger',    'Messenger',   'bg-blue-100 text-blue-700',    0, true),
  ('client_source', 'website_form', 'Weboldal',    'bg-purple-100 text-purple-700',1, true),
  ('client_source', 'referral',     'Ajánlás',     'bg-green-100 text-green-700',  2, true),
  ('client_source', 'other',        'Egyéb',       'bg-zinc-100 text-zinc-600',    3, true);

-- ─── Seed: cost_category ─────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('cost_category', 'accommodation', 'Szállás',    'bg-blue-100 text-blue-700',    0, true),
  ('cost_category', 'flight',        'Repülő',     'bg-sky-100 text-sky-700',      1, true),
  ('cost_category', 'transfer',      'Transfer',   'bg-violet-100 text-violet-700',2, true),
  ('cost_category', 'meals',         'Étkezés',    'bg-orange-100 text-orange-700',3, true),
  ('cost_category', 'tickets',       'Belépők',    'bg-pink-100 text-pink-700',    4, true),
  ('cost_category', 'other',         'Egyéb',      'bg-zinc-100 text-zinc-600',    5, true);

-- ─── Seed: invoice_status ────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('invoice_status', 'draft',     'Vázlat',    'bg-zinc-100 text-zinc-500',   0, true),
  ('invoice_status', 'sent',      'Elküldve',  'bg-blue-100 text-blue-700',   1, true),
  ('invoice_status', 'paid',      'Fizetve',   'bg-green-100 text-green-700', 2, true),
  ('invoice_status', 'overdue',   'Lejárt',    'bg-red-100 text-red-600',     3, true),
  ('invoice_status', 'cancelled', 'Törölve',   'bg-zinc-100 text-zinc-400',   4, true);

-- ─── Seed: payment_type ──────────────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('payment_type', 'deposit',      'Előleg',            'bg-yellow-100 text-yellow-700', 0, true),
  ('payment_type', 'full_payment', 'Teljes összeg',      'bg-green-100 text-green-700',   1, true),
  ('payment_type', 'partial',      'Részletfizetés',     'bg-blue-100 text-blue-700',     2, true),
  ('payment_type', 'refund',       'Visszatérítés',      'bg-red-100 text-red-600',       3, true);

-- ─── Seed: email_template_type ───────────────────────────────────────────────
INSERT INTO public.lookup_options (category, value, label, color, sort_order, is_system) VALUES
  ('email_template_type', 'confirmation',    'Visszaigazolás',      'bg-green-100 text-green-700',  0, true),
  ('email_template_type', 'deposit_request', 'Előlegkérés',         'bg-yellow-100 text-yellow-700',1, true),
  ('email_template_type', 'reminder',        'Emlékeztető',         'bg-orange-100 text-orange-700',2, true),
  ('email_template_type', 'pre_trip',        'Indulás előtt',       'bg-blue-100 text-blue-700',    3, true),
  ('email_template_type', 'post_trip',       'Visszaérkezés után',  'bg-purple-100 text-purple-700',4, true),
  ('email_template_type', 'promotional',     'Promo',               'bg-pink-100 text-pink-700',    5, true);
