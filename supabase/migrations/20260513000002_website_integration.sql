-- =============================================================================
-- ZsuzsiCRM — Website integration migration
-- 1. Make bookings.trip_id nullable so website-form submissions without a
--    matched trip can still be stored (trip name goes into notes).
-- 2. Seed notification_email setting so the owner gets a copy of every
--    website booking submission.
-- =============================================================================

-- Allow bookings that don't yet have a matched trip (website enquiries).
-- The sync_trip_bookings trigger already handles NULL trip_id safely
-- (coalesce returns NULL → WHERE t.id = NULL → no rows updated).
ALTER TABLE bookings ALTER COLUMN trip_id DROP NOT NULL;

-- Add notification email setting (falls back to agency_email if empty).
INSERT INTO settings (key, value) VALUES ('notification_email', '')
ON CONFLICT (key) DO NOTHING;

-- Add CORS origin override setting so the allowed website domain
-- can be configured without re-deploying.
INSERT INTO settings (key, value) VALUES ('booking_form_allowed_origin', 'https://utazofotos.com')
ON CONFLICT (key) DO NOTHING;
