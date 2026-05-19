export interface Country {
  value: string;
  label: string;
}

// Most common countries for a Hungarian travel agency, with Hungarian labels.
// Hungary and neighbours first, then broader Europe, then rest of world.
export const COUNTRIES: Country[] = [
  // ── Hungary ──────────────────────────────────────────────────────────
  { value: "Magyarország",   label: "Magyarország" },
  // ── Neighbours ───────────────────────────────────────────────────────
  { value: "Ausztria",       label: "Ausztria" },
  { value: "Szlovákia",      label: "Szlovákia" },
  { value: "Ukrajna",        label: "Ukrajna" },
  { value: "Románia",        label: "Románia" },
  { value: "Szerbia",        label: "Szerbia" },
  { value: "Horvátország",   label: "Horvátország" },
  { value: "Szlovénia",      label: "Szlovénia" },
  // ── Europe ───────────────────────────────────────────────────────────
  { value: "Albánia",        label: "Albánia" },
  { value: "Andorra",        label: "Andorra" },
  { value: "Belarusz",       label: "Belarusz" },
  { value: "Belgium",        label: "Belgium" },
  { value: "Bosznia-Hercegovina", label: "Bosznia-Hercegovina" },
  { value: "Bulgária",       label: "Bulgária" },
  { value: "Ciprus",         label: "Ciprus" },
  { value: "Csehország",     label: "Csehország" },
  { value: "Dánia",          label: "Dánia" },
  { value: "Észtország",     label: "Észtország" },
  { value: "Finnország",     label: "Finnország" },
  { value: "Franciaország",  label: "Franciaország" },
  { value: "Görögország",    label: "Görögország" },
  { value: "Hollandia",      label: "Hollandia" },
  { value: "Írország",       label: "Írország" },
  { value: "Izland",         label: "Izland" },
  { value: "Lengyelország",  label: "Lengyelország" },
  { value: "Lettország",     label: "Lettország" },
  { value: "Liechtenstein",  label: "Liechtenstein" },
  { value: "Litvánia",       label: "Litvánia" },
  { value: "Luxemburg",      label: "Luxemburg" },
  { value: "Macedónia",      label: "Macedónia" },
  { value: "Málta",          label: "Málta" },
  { value: "Moldova",        label: "Moldova" },
  { value: "Monaco",         label: "Monaco" },
  { value: "Montenegró",     label: "Montenegró" },
  { value: "Németország",    label: "Németország" },
  { value: "Norvégia",       label: "Norvégia" },
  { value: "Olaszország",    label: "Olaszország" },
  { value: "Oroszország",    label: "Oroszország" },
  { value: "Portugália",     label: "Portugália" },
  { value: "San Marino",     label: "San Marino" },
  { value: "Spanyolország",  label: "Spanyolország" },
  { value: "Svájc",          label: "Svájc" },
  { value: "Svédország",     label: "Svédország" },
  { value: "Törökország",    label: "Törökország" },
  { value: "Vatikán",        label: "Vatikán" },
  // ── Americas ─────────────────────────────────────────────────────────
  { value: "Amerikai Egyesült Államok", label: "Amerikai Egyesült Államok" },
  { value: "Argentína",      label: "Argentína" },
  { value: "Brazília",       label: "Brazília" },
  { value: "Chile",          label: "Chile" },
  { value: "Kanada",         label: "Kanada" },
  { value: "Mexikó",         label: "Mexikó" },
  // ── Asia ─────────────────────────────────────────────────────────────
  { value: "Banglades",      label: "Banglades" },
  { value: "Egyesült Arab Emírségek", label: "Egyesült Arab Emírségek" },
  { value: "Fülöp-szigetek", label: "Fülöp-szigetek" },
  { value: "India",          label: "India" },
  { value: "Indonézia",      label: "Indonézia" },
  { value: "Izrael",         label: "Izrael" },
  { value: "Japán",          label: "Japán" },
  { value: "Jordánia",       label: "Jordánia" },
  { value: "Kína",           label: "Kína" },
  { value: "Kuba",           label: "Kuba" },
  { value: "Pakisztán",      label: "Pakisztán" },
  { value: "Szaúd-Arábia",   label: "Szaúd-Arábia" },
  { value: "Thaiföld",       label: "Thaiföld" },
  { value: "Vietnám",        label: "Vietnám" },
  // ── Africa / Oceania ─────────────────────────────────────────────────
  { value: "Ausztrália",     label: "Ausztrália" },
  { value: "Dél-afrikai Köztársaság", label: "Dél-afrikai Köztársaság" },
  { value: "Egyiptom",       label: "Egyiptom" },
  { value: "Marokkó",        label: "Marokkó" },
  { value: "Nigéria",        label: "Nigéria" },
  { value: "Tunézia",        label: "Tunézia" },
  { value: "Új-Zéland",      label: "Új-Zéland" },
];

export const NATIONALITIES: Country[] = COUNTRIES;
