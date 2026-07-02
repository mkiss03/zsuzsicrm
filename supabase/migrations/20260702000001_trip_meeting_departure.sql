alter table trips
  add column if not exists meeting_point text,
  add column if not exists departure_time text;
