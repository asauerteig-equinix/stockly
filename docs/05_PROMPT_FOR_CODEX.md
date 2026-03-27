# 05_PROMPT_FOR_CODEX.md

## Direkter Prompt für Codex in VS Code

Nutze die Dateien im Ordner `/docs` als verbindlichen Projektkontext, insbesondere:
- `01_PROJECT_BRIEF.md`
- `02_CODEX_INSTRUCTIONS.md`
- `03_IMPLEMENTATION_TASKLIST.md`
- `04_ARCHITECTURE_DECISIONS.md`

Du arbeitest an einer **modernen, schlanken, responsiven Warenwirtschaft** für den internen Einsatz im Firmennetzwerk.

## Projektziel

Entwickle eine produktionsnahe MVP-Webanwendung mit zwei Hauptbereichen:

1. **Admin-Oberfläche**
   - für Master Admin und Admins
   - Artikelverwaltung
   - Bestandsverwaltung
   - Wareneingang
   - Korrekturen
   - Warnungen
   - Auswertungen
   - Standortverwaltung

2. **Kiosk-Oberfläche im Lager**
   - touchfreundlich
   - Barcode-Scan über Onboard-Kamera
   - Entnahme von Artikeln
   - Rückgabe / Wiedereinbuchung von Artikeln
   - feste Bindung des Kiosks an einen Standort per PIN

## Verbindliche Rahmenbedingungen

- Die Anwendung läuft **nur im lokalen Firmennetzwerk**
- Heute gibt es **einen Standort / ein Lager**, aber das Datenmodell muss von Anfang an **mehrere eigenständige Standorte** unterstützen
- Jeder Standort soll später eigene:
  - Artikel
  - Bestände
  - Low-Stock-Regeln
  - Aging-Regeln
  verwalten können
- Deployment-Ziel ist später **GitHub + Portainer + Podman**
- Aktuelle Entwicklung erfolgt **containerisiert auf Docker-Basis**
- Verwende **PostgreSQL**
- Die Anwendung soll **modern und professionell** aussehen
- Die Oberfläche ist **deutschsprachig**

## Verbindlicher Stack

Nutze diesen Stack:
- **Next.js**
- **TypeScript**
- **App Router**
- **Tailwind CSS**
- **shadcn/ui**
- **Prisma**
- **PostgreSQL**
- **Zod**
- **react-hook-form**
- **Recharts**
- **@zxing/browser** für Barcode-Scanning

Für den MVP sollen Frontend und Backend pragmatisch in **einem Next.js-Projekt** umgesetzt werden.

## Rollenmodell

### Master Admin
- darf alles
- verwaltet globale Einstellungen
- verwaltet Standorte
- verwaltet Admins
- sieht alle Daten aller Standorte

### Admin
- verwaltet einen oder mehrere zugewiesene Standorte
- darf Artikel, Bestände, Wareneingänge, Korrekturen, Warnungen und Auswertungen für seine Standorte verwalten

### Kiosk
- kein klassischer Benutzer
- gerätegebunden an genau einen Standort
- keine personenbezogene Zuordnung der Kiosk-Buchungen im MVP notwendig

## Kiosk-Logik

Beim ersten Start oder nach Reset muss der Kiosk:
- einen Standort auswählen
- einen passenden PIN eingeben
- danach dauerhaft mit diesem Standort verbunden bleiben

Anforderungen:
- langlebige Session / persistente Gerätebindung
- Kiosk darf nur für den verbundenen Standort buchen
- Reset oder Neuverbindung nur über geschützten Ablauf

## Fachlogik Artikel

Ein Artikel hat mindestens:
- kurzer lesbarer Name
- Barcode
- Beschreibung
- Hersteller-Nummer
- Supplier-Nummer / Lieferantenbezeichnung
- Kategorie
- Mindestbestand
- Aktiv-/Archiv-Status
- Standortbezug

Nicht nötig im MVP:
- Varianten
- Größen
- Farben
- Leihlogik

Regeln:
- Barcode muss innerhalb eines Standorts eindeutig sein
- Artikel bevorzugt archivieren statt hart löschen

## Lagerbewegungen

Im MVP gibt es diese Bewegungstypen:
- **TAKE**
- **RETURN**
- **GOODS_RECEIPT**
- **CORRECTION**

Jede Bewegung protokolliert mindestens:
- Standort
- Artikel
- Bewegungstyp
- Menge
- Zeitstempel
- Quelle (`ADMIN` oder `KIOSK`)
- optionale Bemerkung
- bei Entnahme zusätzlich Verwendungszweck

## Kiosk-Entnahmegründe

Diese Entnahmegründe sollen auswählbar sein:
- crossconnect
- smarthand
- custom order
- projekt

Anforderung:
- Im Kiosk sollen diese Gründe dynamisch nach Häufigkeit sortiert werden
- Die am meisten genutzten Gründe sollen zuerst angezeigt werden

## Warnungen und Reporting

Baue mindestens:
- Low-Stock-Warnungen bei Bestand <= Mindestbestand
- Aging-Warnungen, wenn ein Artikel über definierbare Tage nicht entnommen wurde
- Dashboard mit:
  - aktuellem Bestand
  - Warnungen
  - Verbrauch pro Zeitraum
  - meist entnommenen Artikeln
  - zuletzt bewegten Artikeln
  - Artikeln ohne Bewegung
  - Auswertung nach Verwendungszweck

Warnregeln sollen standortbezogen sein.

## UX-Anforderungen

### Admin-UI
- modern
- clean
- professionell
- responsive
- effiziente Tabellen und Formulare
- gute Suche und Filterung

### Kiosk-UI
- große Buttons
- hoher Kontrast
- klarer Scanbereich
- große Mengensteuerung
- wenig Klicks
- deutliche Erfolgs- und Fehlermeldungen
- für Touch optimiert

## Sicherheitsanforderungen

### Admin
- Login mit sicherer Session
- HTTP-only Cookies
- serverseitige Rollenprüfung

### Kiosk
- Standortbindung via PIN
- langlebiger Kiosk-Token
- keine Admin-Rechte

### Allgemein
- Zod-Validierung an API-Grenzen
- kein Vertrauen in Client-Daten
- serverseitige Standortprüfung

## Umsetzungsvorgabe

Arbeite in dieser Reihenfolge:

1. Projektstruktur aufsetzen
2. Next.js + Tailwind + shadcn/ui einrichten
3. Prisma + PostgreSQL integrieren
4. Datenmodell erstellen
5. Seed-Daten anlegen
6. Auth- und Rollenmodell bauen
7. Standortverwaltung bauen
8. Artikelverwaltung bauen
9. Bestandslogik und Lagerbewegungen bauen
10. Admin-Seiten für Wareneingang und Korrektur bauen
11. Kiosk-Registrierung mit Standort + PIN bauen
12. Barcode-Scan im Kiosk bauen
13. Entnahme und Rückgabe im Kiosk bauen
14. Warnlogik bauen
15. Dashboard und Reports bauen
16. Containerisierung fertigstellen
17. README schreiben

## Erwartete Ergebnisse

Liefere:
- vollständige Projektstruktur
- Prisma-Schema
- Migrationen
- Seed-Datei
- Next.js Seiten
- Route Handler / API-Endpunkte
- Auth-Logik
- Kiosk-Logik
- Barcode-Integration
- Admin- und Kiosk-UI
- Dockerfile
- docker-compose.yml
- `.env.example`
- README

## Qualitätsregeln

- TypeScript strikt nutzen
- saubere Benennung
- wiederverwendbare Komponenten
- Fachlogik nicht unkontrolliert in UI verteilen
- sinnvolle Lade-, Fehler- und Erfolgszustände
- kein unnötig komplexes ERP bauen
- MVP-orientiert arbeiten
- robust und wartbar implementieren

## Direkte Arbeitsanweisung

Beginne mit:
1. Architekturkurzfassung
2. Verzeichnisstruktur
3. Prisma-Datenmodell
4. Auth- und Rollenmodell
5. Seitenstruktur für Admin und Kiosk
6. dann mit der konkreten Implementierung

Treffe keine alternativen Stack-Entscheidungen ohne klaren Grund.
Bevorzuge einfache, robuste und produktionsnahe Lösungen für ein internes Business-Tool.
