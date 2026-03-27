# 04_ARCHITECTURE_DECISIONS.md

## Ziel

Diese Datei definiert die verbindlichen Architekturentscheidungen für das Projekt, damit Codex in VS Code zielgerichtet und konsistent arbeiten kann.

Projektziel:
Eine moderne, schlanke, responsive Warenwirtschaft für internes Arbeiten im Firmennetzwerk mit:
- Admin-Oberfläche für Verwaltung und Auswertung
- Kiosk-Oberfläche für Barcode-Scan, Entnahme und Rückgabe
- PostgreSQL als produktionsfähige Datenbank
- Container-fähiger Architektur für Docker heute und Podman/Portainer später

---

## Verbindlicher Tech Stack

### Frontend
- **Next.js**
- **TypeScript**
- **App Router**
- **Tailwind CSS**
- **shadcn/ui**
- **react-hook-form**
- **zod**

### Backend
- **Next.js API Routes oder Route Handlers** für MVP
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL**
- **Zod** für Request-Validierung

### Authentifizierung / Sessions
- Admin-Login über **session-basierte Authentifizierung**
- Sichere HTTP-only Cookies
- Rollen:
  - Master Admin
  - Admin
- Kiosk-Authentifizierung separat über **persistente Gerätebindung + PIN-basierte Standortkopplung**

### Barcode-Scanning
- Browserbasierte Kamera-Lösung
- Bevorzugte Library:
  - **@zxing/browser**
- Fallback:
  - manuelle Barcode-Eingabe

### Charts / Reporting
- **Recharts**
- Fokus auf einfache operative Diagramme, keine komplexe BI-Struktur

### Deployment / Infra
- **Docker Compose** für Entwicklung
- So strukturieren, dass spätere Nutzung als **Portainer Stack auf Podman-Basis** problemlos möglich ist
- Services:
  - app
  - db
- Optional später:
  - reverse-proxy
  - backup-job

---

## Begründung dieser Entscheidungen

### Warum Next.js?
- Frontend und Backend können für den MVP in einem Projekt sauber zusammengeführt werden
- Gute Developer Experience
- Saubere UI-Architektur
- Einfacher Container-Betrieb
- Schnell produktiv für interne Business-Anwendungen

### Warum PostgreSQL?
- Direkte Vorbereitung auf spätere Erweiterung auf mehrere Standorte
- Robuster als SQLite für gleichzeitige Nutzung
- Bessere Grundlage für Reporting und relationale Integrität

### Warum Prisma?
- Schnelle Entwicklung
- Typisierte Datenzugriffe
- Gute Migrations- und Seed-Workflows
- Sehr passend für MVP + spätere Skalierung

### Warum Tailwind + shadcn/ui?
- Moderne, professionelle Business-UI
- Schnell konsistente Oberflächen baubar
- Gut geeignet für Desktop-Admin und reduziertes Kiosk-UI

### Warum session-basierte Admin-Auth?
- Für interne Anwendungen meist pragmatischer und sicherer als unnötig komplexe Token-Modelle im Browser
- Gute Grundlage für rollenbasierten Zugriff

### Warum separater Kiosk-Mechanismus?
- Der Kiosk ist kein klassischer User-Login
- Das Gerät muss robust an einen Standort gebunden sein
- Verhindert Fehlbuchungen zwischen Standorten

---

## Architekturprinzipien

Diese Prinzipien sind einzuhalten:

1. **MVP first**
- Nur Kernfunktionen bauen
- Keine ERP-Überfrachtung
- Keine unnötigen Nebenfeatures

2. **Standortfähigkeit von Anfang an**
- Fast alle fachlichen Daten sind an einen Standort gebunden
- Auch wenn zunächst nur ein Standort aktiv ist

3. **Klare Trennung der Oberflächen**
- Admin-UI
- Kiosk-UI
- Unterschiedliche UX, unterschiedliche Navigationslogik

4. **Saubere Domänenlogik**
- Bestandsberechnung
- Lagerbewegungen
- Warnlogik
- Rechteprüfung
- Nicht alles direkt in UI-Komponenten mischen

5. **Containerfreundlichkeit**
- Lokale Entwicklung und späterer Stack-Betrieb müssen sauber unterstützt werden

6. **Robuste Datenintegrität**
- Lagerbewegungen sind historisch nachvollziehbar
- Bestände müssen korrekt und konsistent sein

---

## Empfohlene Projektstruktur

```text
/apps/web
  /src
    /app
      /(auth)
      /(admin)
      /(kiosk)
      /api
    /components
    /features
      /auth
      /inventory
      /kiosk
      /locations
      /reports
      /warnings
    /lib
    /server
    /types
    /styles
  prisma
    schema.prisma
    seed.ts
  public
  Dockerfile
  package.json

/infrastructure
  docker-compose.yml
  .env.example

/docs
  01_PROJECT_BRIEF.md
  02_CODEX_INSTRUCTIONS.md
  03_IMPLEMENTATION_TASKLIST.md
  04_ARCHITECTURE_DECISIONS.md
```

---

## Domänenmodell

Folgende Haupt-Entities sind vorgesehen:

- User
- Role
- Location
- KioskDevice
- Category
- Item
- InventoryBalance
- StockMovement
- UsageReason
- LocationSettings

### Wichtig
Bestände sollen **nicht nur aus UI-Zuständen entstehen**, sondern sauber aus:
- Artikel
- Standort
- Bewegungen
- aggregiertem Bestand / Balance-Modell

Empfohlener Ansatz:
- Bewegungen historisch speichern
- aktuellen Bestand zusätzlich in einer eigenen Tabelle oder sauberem Aggregat verwalten

---

## Verbindliche Fachregeln

### Standortbindung
- Jeder Artikel gehört genau zu einem Standort
- Barcode muss innerhalb des Standorts eindeutig sein
- Admins sehen nur ihre freigegebenen Standorte
- Master Admin sieht alles

### Kiosk
- Kiosk wird einmalig oder nach Reset mit Standort + PIN gekoppelt
- Danach wird eine langlebige Gerätebindung gespeichert
- Der Kiosk bucht nur für seinen gebundenen Standort
- Keine Benutzerpflicht pro Buchung

### Lagerbewegungen
Unterstützte Typen:
- TAKE
- RETURN
- GOODS_RECEIPT
- CORRECTION

Jede Bewegung enthält mindestens:
- Standort
- Artikel
- Typ
- Menge
- Zeitstempel
- Quelle
- optionale Bemerkung

Zusätzlich bei Kiosk-Entnahme:
- Verwendungszweck

### Warnungen
- Low Stock: Bestand <= Mindestbestand
- Aging: seit konfigurierbarer Anzahl Tage keine Entnahme

Warnungen sollen zunächst bevorzugt **berechnet** werden und nicht unnötig als komplexer historischer Zustand persistiert werden, außer es ist technisch sinnvoll.

---

## UI-Leitlinien

### Admin-UI
- Modern
- klar
- professionell
- gute Tabellen
- schnelle Suche
- gute Formulare
- Dashboard mit operativ nützlichen Kennzahlen

### Kiosk-UI
- maximal reduziert
- große Buttons
- großer Scanbereich
- schnelles Feedback
- Touch-optimiert
- möglichst wenige Schritte

---

## Sicherheitsgrundsätze

### Admin
- Login erforderlich
- Session in HTTP-only Cookie
- Rollenprüfung serverseitig
- API-Endpunkte immer serverseitig absichern

### Kiosk
- Standortbindung per PIN
- langlebiger Kiosk-Token nur für Gerät
- Reset geschützt
- keine Vollzugriffe wie im Admin-Bereich

### Allgemein
- Zod-Validierung an allen API-Grenzen
- Keine ungeprüften Inputs direkt in Datenbankoperationen
- Soft Delete / Archivierung bevorzugen bei Artikeln

---

## API-Richtlinien

### Grundsatz
- Route Handler in Next.js für MVP
- Saubere REST-nahe API-Struktur

### Beispiel-Endpunkte
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

- `GET /api/locations`
- `POST /api/locations`
- `PATCH /api/locations/:id`

- `GET /api/items`
- `POST /api/items`
- `PATCH /api/items/:id`

- `POST /api/inventory/goods-receipt`
- `POST /api/inventory/correction`

- `POST /api/kiosk/register`
- `POST /api/kiosk/scan/take`
- `POST /api/kiosk/scan/return`

- `GET /api/movements`
- `GET /api/warnings`
- `GET /api/reports/consumption`

### API-Regeln
- Alle Requests validieren
- Fehler strukturiert zurückgeben
- Standortkontext konsequent prüfen
- Keine Logik nur im Frontend abbilden

---

## Datenbankrichtlinien

### Prisma
- Nutze sprechende Modelnamen
- Nutze Enums für Rollen und Bewegungstypen
- Zeitstempel überall sinnvoll pflegen
- Indexe setzen für:
  - barcode
  - locationId
  - createdAt
  - itemId
  - movementType

### Löschstrategie
- Artikel bevorzugt archivieren
- Bewegungen niemals hart löschen
- Kiosk-Geräte deaktivierbar statt löschen

---

## Reporting-Richtlinien

MVP-Reports:
- aktueller Bestand
- Low-Stock
- Aging
- Verbrauch pro Zeitraum
- meist entnommene Artikel
- zuletzt bewegte Artikel
- Artikel ohne Bewegung
- Verwendungszwecke nach Häufigkeit

Filter:
- Zeitraum
- Standort
- Kategorie

Keine überkomplexen Analytics bauen.
Fokus auf operative Nutzung.

---

## Container- und Betriebsrichtlinien

### Entwicklung
- App und PostgreSQL per Docker Compose starten
- ENV-Dateien verwenden
- Prisma-Migrationen sauber dokumentieren

### Produktion / späterer Stack
- Compose so schreiben, dass Portainer ihn gut als Stack verwenden kann
- Keine lokalen Sonderlösungen einbauen, die Podman-Betrieb erschweren
- Möglichst einfache Service-Struktur

### Mindestanforderungen
- Dockerfile
- `.env.example`
- `docker-compose.yml`
- Healthcheck für App
- Persistentes Volume für PostgreSQL

---

## Nicht-Ziele für den MVP

Diese Dinge jetzt bewusst **nicht** priorisieren:
- komplexes ERP
- Einkaufssystem
- Lieferkettenmanagement
- Variantenlogik
- Mehrsprachigkeit
- externe Cloud-Anbindung
- SSO
- feingranulares Benutzertracking am Kiosk
- native Mobile App

---

## Reihenfolge der Umsetzung

Codex soll in dieser Reihenfolge arbeiten:

1. Basis-Projekt aufsetzen
2. PostgreSQL + Prisma integrieren
3. Auth und Rollenmodell bauen
4. Standortmodell bauen
5. Artikelverwaltung bauen
6. Lagerbewegungen im Admin bauen
7. Kiosk-Kopplung mit PIN bauen
8. Barcode-Scan im Kiosk bauen
9. Entnahme / Rückgabe bauen
10. Warnungen und Dashboard bauen
11. Reporting-Grundlagen bauen
12. Containerisierung und README fertigstellen

---

## Qualitätsanforderungen

- TypeScript strikt nutzen
- Komponenten wiederverwendbar bauen
- Fachlogik nicht unkontrolliert in UI mischen
- Verständliche Benennung
- Solide Fehlermeldungen
- Saubere Lade- und Erfolgszustände
- Deutsches UI-Wording
- Kommentiere nur dort, wo es sinnvoll ist
- Keine unnötige Komplexität einführen

---

## Direkte Arbeitsanweisung an Codex

Nutze diese Architekturentscheidungen als verbindliche Grundlage.
Treffe keine alternativen Stack-Entscheidungen ohne klaren Grund.
Arbeite MVP-orientiert, aber mit sauberer Erweiterbarkeit.
Bevorzuge robuste, einfache und gut wartbare Lösungen für ein internes Business-Tool.
