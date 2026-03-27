# Architekturueberblick

## Kernentscheidungen

- Ein einziges Next.js-Projekt vereint Admin-Frontend, Kiosk-Frontend und Route-Handler fuer den MVP.
- Prisma verwaltet PostgreSQL-Schema, Migrationen und Seeds.
- Session-basierte Admin-Authentifizierung wird ueber eine `AdminSession`-Tabelle plus HTTP-only Cookie umgesetzt.
- Der Kiosk wird ueber `KioskDevice` und einen langlebigen Token an genau einen Standort gebunden.

## Domainen

- `Location` und `LocationSettings` kapseln standortbezogene Regeln.
- `Article` beschreibt den Artikelstamm je Standort.
- `StockMovement` ist das historische Bewegungsjournal.
- `InventoryBalance` haelt den aktuellen Bestand pro Artikel fuer schnelle Abfragen.

## Admin-Flow

- Login prueft Passwort gegen gehashte Userdaten.
- Erfolgreiche Anmeldung erzeugt eine Session in der Datenbank.
- Routen und APIs pruefen Rollen und sichtbare Standorte serverseitig.

## Kiosk-Flow

- Pairing: Standort + PIN + Geraetelabel.
- Nach erfolgreichem Pairing wird ein `KioskDevice` mit Token erzeugt.
- Buchungen duerfen ausschliesslich auf dem gekoppelten Standort laufen.
- Reset setzt die Bindung erst nach PIN-Bestaetigung ausser Kraft.

## Reporting und Warnungen

- Low-Stock prueft `InventoryBalance.quantity <= Article.minimumStock`.
- Aging berechnet sich aus der letzten `TAKE`-Bewegung je Artikel.
- Dashboarddaten werden aus Bewegungen und Bestaenden aggregiert.
