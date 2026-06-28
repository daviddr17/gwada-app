-- Superadmin-Teil des Changelog-Eintrags 2026.06.28 auf Deutsch
update public.platform_changelog_entries
set body = $customer$- **Checklisten:** Übersicht und ToDo-Listen auf einer Seite — kompakte KPIs, Bereichs-/Geräte-Chips und Aufgabenliste zusammen
- **ToDo-Formular:** Prioritäten farbig, Display-Anzeige als Schalter, Bereich und Gerät direkt aus dem Formular anlegen, überarbeitete Erfassungs- und Datumsfelder
- **Display — Checklisten:** Badge oben im Header; Temperatur und Zahlen groß und tablet-tauglich erfassen; Abweichung vom Sollbereich mit Hinweis und Pflicht-Korrekturmaßnahme; erfasste Werte bleiben nach „Erledigt“ sichtbar
- **Navigation:** Sidebar-Labels gleiten beim Ein- und Ausklappen mit, Icons bleiben auf gleicher Position
- **Listen & Statistik:** Einheitlichere KPI-Karten und Pagination in Modul-Statistiken
- **Superadmin:** Paginierte Tabellen für Restaurants, Nutzer und Warteliste$customer$
  || E'\n---superadmin---\n'
  || $superadmin$- **Checklisten:** Route `/dashboard/checklisten` — Übersicht und ToDos zusammengeführt; `/todos` leitet weiter
- **Display:** Badge nur für offene Checklisten; Abweichung vom Sollbereich → Pflicht-Korrekturmaßnahme; erfasste Werte nach „Erledigt“ sichtbar
- **UI:** Sidebar-Clip-Animation; einheitliche KPI-Karten; paginierte Superadmin-Tabellen
- **Feed-Sync:** WhatsApp-Versand nur bei verbundener Plattform (Bewertungen, News, Events, Galerie)$superadmin$
where title = 'Checklisten-Übersicht, Display-Erfassung und UI-Feinschliff'
  and version = '2026.06.28';
