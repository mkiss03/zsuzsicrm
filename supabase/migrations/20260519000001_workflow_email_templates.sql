-- Workflow email templates (default, read-only)
-- These are the 5 templates used by the automated workflow steps.
-- They are seeded once; admins can duplicate them to customise.

INSERT INTO email_templates (name, type, subject, body, variables, is_default, created_at, updated_at)
VALUES

-- 1. Booking confirmation  (step: confirmation_sent)
(
  'Workflow – Foglalási visszaigazolás',
  'confirmation',
  'Foglalási visszaigazolás – {{trip_name}}',
  E'Kedves {{client_name}}!\n\nNagy örömmel tájékoztatjuk, hogy foglalása sikeresen rögzítésre került. Köszönjük bizalmát!\n\nFoglalás részletei:\n• Foglalási kód: {{booking_code}}\n• Utazás neve: {{trip_name}}\n• Indulás dátuma: {{departure_date}}\n• Összeg: {{total_amount}} Ft\n\nA következő lépésekben elküldjük Önnek az utazási nyilatkozatokat aláírásra, majd az előlegfizetési felszólítást.\n\nKérdés esetén forduljon hozzánk bizalommal!\n\nÜdvözlettel,\nUtazóFotós csapata',
  ARRAY['client_name', 'booking_code', 'trip_name', 'departure_date', 'total_amount'],
  true,
  NOW(),
  NOW()
),

-- 2. Deposit request  (step: deposit_request)
(
  'Workflow – Előlegfizetési felszólítás',
  'deposit_request',
  'Előlegfizetési felszólítás – {{trip_name}}',
  E'Kedves {{client_name}}!\n\nKöszönjük, hogy aláírta a nyilatkozatokat. A foglalás véglegesítéséhez kérjük, fizesse be az előleget az alábbi adatokra:\n\n• Összeg: {{deposit_amount}} Ft\n• Bankszámlaszám: {{bank_account}}\n• Közlemény: {{booking_code}}\n• Határidő: {{payment_deadline}}\n\nAz előleg beérkezése után visszaigazolást küldünk, és a foglalás véglegessé válik.\n\nKérdés esetén állunk rendelkezésére!\n\nÜdvözlettel,\nUtazóFotós csapata',
  ARRAY['client_name', 'booking_code', 'trip_name', 'deposit_amount', 'bank_account', 'payment_deadline'],
  true,
  NOW(),
  NOW()
),

-- 3. Payment reminder  (step: full_payment_request)
(
  'Workflow – Végösszeg fizetési emlékeztető',
  'reminder',
  'Fizetési emlékeztető – {{trip_name}}',
  E'Kedves {{client_name}}!\n\nEmlékeztetjük, hogy az utazás végösszegének befizetési határideje közeleg.\n\n• Foglalási kód: {{booking_code}}\n• Utazás: {{trip_name}}\n• Fizetendő összeg: {{remaining_amount}} Ft\n• Bankszámlaszám: {{bank_account}}\n• Közlemény: {{booking_code}}\n• Határidő: {{payment_deadline}}\n\nKérjük, hogy a határidőig szíveskedjen az összeget átutalni. Késedelmes fizetés esetén a foglalás törlésre kerülhet.\n\nKöszönjük megértését!\n\nÜdvözlettel,\nUtazóFotós csapata',
  ARRAY['client_name', 'booking_code', 'trip_name', 'remaining_amount', 'bank_account', 'payment_deadline'],
  true,
  NOW(),
  NOW()
),

-- 4. Pre-trip briefing  (step: pre_trip_send)
(
  'Workflow – Utazás előtti tájékoztató',
  'pre_trip',
  'Fontos tudnivalók az utazáshoz – {{trip_name}}',
  E'Kedves {{client_name}}!\n\nHamarosan indul az utazásunk! Kérjük, olvassa el figyelmesen az alábbi tájékoztatót.\n\nIndulás: {{departure_date}}, {{meeting_time}}\nTalálkozási pont: {{meeting_point}}\n\nFontos tudnivalók:\n• Poggyász: kézipoggyász + 1 db feladott bőrönd (max. 23 kg)\n• Útiokmányok: érvényes személyigazolvány vagy útlevél\n• Biztosítás: kérjük, hozza magával a kötvény másolatát\n• Öltözet: kényelmes, réteges ruházat ajánlott\n\nFényképezési felszerelés:\n{{photo_equipment_notes}}\n\nAz utazás programja elérhető a csatolt PDF-ben.\n\nVárjuk szeretettel!\n\nÜdvözlettel,\nUtazóFotós csapata',
  ARRAY['client_name', 'trip_name', 'departure_date', 'meeting_time', 'meeting_point', 'photo_equipment_notes'],
  true,
  NOW(),
  NOW()
),

-- 5. Post-trip follow-up  (step: followup_sent)
(
  'Workflow – Köszönő és visszajelzés kérő',
  'post_trip',
  'Köszönjük az utazást! Visszajelzésére kíváncsiak vagyunk – {{trip_name}}',
  E'Kedves {{client_name}}!\n\nRemeljük, hogy élménydús és emlékezetes utazásban volt része velünk!\n\nAz elkészült képek feldolgozása megkezdődött, és {{delivery_date}}-ig küldjük el Önnek a galériához való hozzáférési linket.\n\nKérjük, ossza meg velünk tapasztalatait egy rövid visszajelzéssel – ez nagyban segít abban, hogy a jövőben még jobb élményt nyújthassunk:\n\n👉 Értékelés: {{review_link}}\n\nHa valamilyen kérdése, észrevétele van a képekkel vagy az utazással kapcsolatban, keressen minket bátran.\n\nReméljük, hamarosan újra együtt utazhatunk!\n\nSzeretettel,\nUtazóFotós csapata',
  ARRAY['client_name', 'trip_name', 'delivery_date', 'review_link'],
  true,
  NOW(),
  NOW()
)

ON CONFLICT DO NOTHING;
