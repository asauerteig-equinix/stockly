# 05_PROMPT_FOR_CODEX.md

## Projektname

**Stockly**

## Direkter Prompt fuer Codex in VS Code

Nutze die Dateien im Ordner `/docs` als verbindlichen Projektkontext, insbesondere:
- `01_PROJECT_BRIEF.md`
- `02_CODEX_INSTRUCTIONS.md`
- `03_IMPLEMENTATION_TASKLIST.md`
- `04_ARCHITECTURE_DECISIONS.md`

Du arbeitest an einer **modernen, schlanken, responsiven Warenwirtschaft** fuer den internen Einsatz im Firmennetzwerk.

## Projektziel

Entwickle eine produktionsnahe MVP-Webanwendung mit zwei Hauptbereichen:

1. **Admin-Oberflaeche**
   - fuer Master Admin und Admins
   - Artikelverwaltung
   - Bestandsverwaltung
   - Wareneingang
   - Korrekturen
   - Warnungen
   - Auswertungen
   - Standortverwaltung

2. **Kiosk-Oberflaeche im Lager**
   - touchfreundlich
   - Barcode-Scan ueber Onboard-Kamera
   - Entnahme von Artikeln
   - Rueckgabe / Wiedereinbuchung von Artikeln
   - feste Bindung des Kiosks an einen Standort per PIN

## Verbindliche Rahmenbedingungen

- Die Anwendung laeuft **nur im lokalen Firmennetzwerk**
- Heute gibt es **einen Standort / ein Lager**, aber das Datenmodell muss von Anfang an **mehrere eigenstaendige Standorte** unterstuetzen
- Jeder Standort soll spaeter eigene:
  - Artikel
  - Bestaende
  - Low-Stock-Regeln
  - Aging-Regeln
  verwalten koennen
- Deployment-Ziel ist spaeter **GitHub + Portainer + Podman**
- Aktuelle Entwicklung erfolgt **containerisiert auf Docker-Basis**
- Verwende **PostgreSQL**
- Die Anwendung soll **modern und professionell** aussehen
- Die Oberflaeche ist **deutschsprachig**

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
- **@zxing/browser** fuer Barcode-Scanning

Fuer den MVP sollen Frontend und Backend pragmatisch in **einem Next.js-Projekt** umgesetzt werden.

## Rollenmodell

### Master Admin
- darf alles
- verwaltet globale Einstellungen
- verwaltet Standorte
- verwaltet Admins
- sieht alle Daten aller Standorte

### Admin
- verwaltet einen oder mehrere zugewiesene Standorte
- darf Artikel, Bestaende, Wareneingaenge, Korrekturen, Warnungen und Auswertungen fuer seine Standorte verwalten

### Kiosk
- kein klassischer Benutzer
- geraetgebunden an genau einen Standort
- keine personenbezogene Zuordnung der Kiosk-Buchungen im MVP notwendig

## Kiosk-Logik

Beim ersten Start oder nach Reset muss der Kiosk:
- einen Standort auswaehlen
- einen passenden PIN eingeben
- danach dauerhaft mit diesem Standort verbunden bleiben

Anforderungen:
- langlebige Session / persistente Geraetebindung
- Kiosk darf nur fuer den verbundenen Standort buchen
- Reset oder Neuverbindung nur ueber geschuetzten Ablauf

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

Nicht noetig im MVP:
- Varianten
- Groessen
- Farben
- Leihlogik

Regeln:
- Barcode muss innerhalb eines Standorts eindeutig sein
- Artikel bevorzugt archivieren statt hart loeschen

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
- bei Entnahme zusaetzlich Verwendungszweck

## Kiosk-Entnahmegruende

Diese Entnahmegruende sollen auswaehlbar sein:
- crossconnect
- smarthand
- custom order
- projekt

Anforderung:
- Im Kiosk sollen diese Gruende dynamisch nach Haeufigkeit sortiert werden
- Die am meisten genutzten Gruende sollen zuerst angezeigt werden

## Warnungen und Reporting

Baue mindestens:
- Low-Stock-Warnungen bei Bestand <= Mindestbestand
- Aging-Warnungen, wenn ein Artikel ueber definierbare Tage nicht entnommen wurde
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
- grosse Buttons
- hoher Kontrast
- klarer Scanbereich
- grosse Mengensteuerung
- wenig Klicks
- deutliche Erfolgs- und Fehlermeldungen
- fuer Touch optimiert

## Sicherheitsanforderungen

### Admin
- Login mit sicherer Session
- HTTP-only Cookies
- serverseitige Rollenpruefung

### Kiosk
- Standortbindung via PIN
- langlebiger Kiosk-Token
- keine Admin-Rechte

### Allgemein
- Zod-Validierung an API-Grenzen
- kein Vertrauen in Client-Daten
- serverseitige Standortpruefung

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
10. Admin-Seiten fuer Wareneingang und Korrektur bauen
11. Kiosk-Registrierung mit Standort + PIN bauen
12. Barcode-Scan im Kiosk bauen
13. Entnahme und Rueckgabe im Kiosk bauen
14. Warnlogik bauen
15. Dashboard und Reports bauen
16. Containerisierung fertigstellen
17. README schreiben

## Erwartete Ergebnisse

Liefere:
- vollstaendige Projektstruktur
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

## Qualitaetsregeln

- TypeScript strikt nutzen
- saubere Benennung
- wiederverwendbare Komponenten
- Fachlogik nicht unkontrolliert in UI verteilen
- sinnvolle Lade-, Fehler- und Erfolgszustaende
- kein unnoetig komplexes ERP bauen
- MVP-orientiert arbeiten
- robust und wartbar implementieren

## Direkte Arbeitsanweisung

Beginne mit:
1. Architekturkurzfassung
2. Verzeichnisstruktur
3. Prisma-Datenmodell
4. Auth- und Rollenmodell
5. Seitenstruktur fuer Admin und Kiosk
6. dann mit der konkreten Implementierung

Treffe keine alternativen Stack-Entscheidungen ohne klaren Grund.
Bevorzuge einfache, robuste und produktionsnahe Loesungen fuer ein internes Business-Tool.
