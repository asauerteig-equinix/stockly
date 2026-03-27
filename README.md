# Stockly

Stockly ist ein produktionsnaher MVP fuer eine interne, deutschsprachige Warenwirtschaft mit klar getrennter Admin- und Kiosk-Oberflaeche. Die Anwendung ist auf lokale Firmennetze ausgelegt, nutzt PostgreSQL als Hauptdatenbank und bleibt von Beginn an mehrstandortfaehig.

## Architekturueberblick

- Frontend und Backend laufen pragmatisch in einem einzigen Next.js-Projekt unter `apps/web`.
- Der Admin-Bereich nutzt session-basierte Authentifizierung mit HTTP-only Cookies und serverseitiger Rollenpruefung.
- Der Kiosk ist kein Benutzer-Login, sondern ein langlebig an einen Standort gebundenes Geraet mit PIN-geschuetztem Pairing.
- Bestandslogik basiert auf historisierten `StockMovement`-Eintraegen plus aktueller `InventoryBalance`-Tabelle fuer schnelle Uebersichten.
- Warnungen und Reports werden bevorzugt aus Live-Daten berechnet, statt komplexe Historienstati zu persistieren.

## Projektstruktur

```text
apps/web
  prisma
  src/app
  src/components
  src/features
  src/server
docs
docker-compose.yml
.env.example
README.md
```

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- lokale `components/ui` im shadcn-Stil
- Prisma + PostgreSQL
- Zod + react-hook-form
- Recharts
- `@zxing/browser` fuer Barcode-Scan

## Portainer / Docker Stack

Der Stack in `docker-compose.yml` ist jetzt auf Portainer-Betrieb ausgelegt:

- Web-App extern auf Port `5600`
- PostgreSQL extern auf Port `5416`
- produktionsnahes Build-Target statt Dev-Server
- keine Source-Mounts
- automatisches `prisma migrate deploy` beim Start
- optionales Auto-Seeding bei leerer Datenbank

### Empfohlener Portainer-Deploy

1. Stack aus dem Git-Repository deployen, damit Portainer den Build-Kontext `apps/web` sauber verwenden kann.
2. Die Variablen aus `.env.example` als Stack-Umgebungsvariablen in Portainer setzen.
3. Vor allem `SESSION_SECRET`, `KIOSK_SECRET` und `POSTGRES_PASSWORD` produktiv ersetzen.
4. Stack deployen.

Danach ist die Anwendung unter `http://<server>:5600` erreichbar.

### Wichtig fuer die Datenbank-Verbindung in Portainer

- Innerhalb des Stacks spricht die App immer mit PostgreSQL ueber `db:5432`.
- Der externe Host-Port `5416` ist nur fuer Zugriffe von ausserhalb des Stacks gedacht.
- In Portainer solltest du deshalb **keine eigene `DATABASE_URL` mit `db:5416` oder `localhost:5416` setzen**.
- Die Compose-Datei erzeugt die korrekte interne `DATABASE_URL` jetzt automatisch aus `POSTGRES_USER`, `POSTGRES_PASSWORD` und `POSTGRES_DB`.
- Fuer internes `http` muss `COOKIE_SECURE=false` bleiben, damit Browser die Login- und Kiosk-Cookies akzeptieren.

### Wichtiger Hinweis zum ersten Start

- Wenn `AUTO_SEED=true` ist und die Datenbank leer ist, werden beim ersten Start automatisch die Seed-Daten angelegt.
- Wenn bereits Benutzer existieren, wird der Seed automatisch uebersprungen.
- Fuer eine ganz leere Produktivumgebung ohne Demo-Daten setze `AUTO_SEED=false`.

## Schnellstart mit Docker lokal

1. `.env.example` nach `.env` kopieren und Werte bei Bedarf anpassen.
2. `docker compose up --build` aus dem Projektwurzelverzeichnis starten.
3. Die Anwendung ist dann unter `http://localhost:5600` erreichbar.

## Schnellstart lokal ohne Docker

1. PostgreSQL bereitstellen.
2. In `apps/web` eine `.env` mit passender `DATABASE_URL` anlegen.
3. Abhaengigkeiten installieren und Prisma vorbereiten:

```bash
cd apps/web
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## Seed-Zugaenge

- Master Admin: `master@stockly.local` / `Stockly123!`
- Admin Berlin: `lager@stockly.local` / `Admin123!`
- Kiosk PIN Berlin: `1234`
- Kiosk PIN Hamburg: `5678`

## Rollen und Berechtigungen

- `MASTER_ADMIN`: verwaltet alle Standorte, globale Admins und sieht alle Daten.
- `ADMIN`: sieht und bearbeitet nur zugewiesene Standorte.
- `KIOSK`: besitzt keine Nutzerrolle und darf nur fuer den gekoppelten Standort buchen.

## Kiosk-Pairing

1. Kiosk-Seite unter `/kiosk` oeffnen.
2. Standort auswaehlen und PIN eingeben.
3. Es wird ein langlebiger, HTTP-only Kiosk-Cookie gesetzt und ein `KioskDevice` in der Datenbank angelegt.
4. Reset ist nur ueber den geschuetzten Flow mit erneuter PIN-Bestaetigung moeglich.

### Hinweis zum Kamera-Scan

- Der Browser erlaubt Kamera-Zugriff in der Regel nur ueber `https://` oder auf `localhost`.
- Eine normale LAN-URL ueber `http://<server>:5600` zeigt oft **kein** Kamera-Popup und blockiert den Zugriff direkt.
- Fuer echten Barcode-Scan im Kiosk sollte die Anwendung deshalb ueber HTTPS hinter einem Reverse Proxy betrieben werden.
- Die manuelle Barcode-Eingabe bleibt als Fallback weiterhin nutzbar.

## Migrationen und Datenbankfluss

- Das Prisma-Schema liegt unter `apps/web/prisma/schema.prisma`.
- Seeds liegen unter `apps/web/prisma/seed.ts`.
- Fuer die initiale Migration:

```bash
cd apps/web
npx prisma migrate dev --name init
```

- Fuer reine Client-Erzeugung:

```bash
npx prisma generate
```

## Wichtige Umgebungsvariablen

- `DATABASE_URL`: PostgreSQL-Verbindung fuer Prisma
- `APP_URL`: Basis-URL der Anwendung
- `SESSION_SECRET`: Signierung der Admin-Sessions
- `KIOSK_SECRET`: Signierung der Kiosk-Geraetebindungen
- `COOKIE_SECURE`: nur fuer echte HTTPS-Deployments auf `true` setzen
- `AUTO_SEED`: fuehrt Seed-Daten nur bei leerer Datenbank automatisch aus

## MVP-Funktionsumfang

- Admin-Login
- Dashboard mit Kennzahlen, Charts und letzten Bewegungen
- Standortverwaltung
- Artikelverwaltung mit Archivierung
- Bestandsuebersicht
- Wareneingang und Korrekturen
- Bewegungshistorie
- Low-Stock- und Aging-Warnungen
- Adminverwaltung fuer Master Admin
- Kiosk-Pairing, Scan, Entnahme, Rueckgabe, Reset

## Naechste sinnvolle Erweiterungen

- Exportfunktionen fuer Reports
- feinere Filter in Bewegungs- und Warnungsansichten
- gesonderte API-Rate-Limits fuer Kiosk-Endpunkte
- Mail- oder Messenger-Benachrichtigungen fuer Warnungen
- resetbarer Kiosk-Workflow ueber Master-Admin-Freigabe
