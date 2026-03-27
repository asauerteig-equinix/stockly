# Portainer / Podman Hinweise

- Die Anwendung ist bewusst als Zwei-Service-Stack (`app` und `db`) gehalten.
- `docker-compose.yml` ist auf Portainer-Stack-Betrieb ausgerichtet und nutzt das `production`-Target aus `apps/web/Dockerfile`.
- Die Web-App ist extern auf Port `5600` gemappt, PostgreSQL auf `5416`.
- Innerhalb des Stacks nutzt die App trotzdem immer die interne Datenbank-Adresse `db:5432`.
- Beim Containerstart werden zuerst `prisma migrate deploy` und optional ein Seed bei leerer Datenbank ausgefuehrt.
- Der Bootstrap versucht Datenbankmigrationen mehrfach erneut, falls PostgreSQL kurz nach dem Stack-Start noch nicht bereit ist.
- Vor dem ersten Produktivstart sollten `SESSION_SECRET`, `KIOSK_SECRET` und PostgreSQL-Zugangsdaten ersetzt werden.
