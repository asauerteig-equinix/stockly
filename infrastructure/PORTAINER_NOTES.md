# Portainer / Podman Hinweise

- Die Anwendung ist bewusst als Zwei-Service-Stack (`app` und `db`) gehalten.
- `docker-compose.yml` ist auf Portainer-Stack-Betrieb ausgerichtet und nutzt das `production`-Target aus `apps/web/Dockerfile`.
- Die Web-App ist extern auf Port `5600` gemappt, PostgreSQL auf `5416`.
- Innerhalb des Stacks nutzt die App trotzdem immer die interne Datenbank-Adresse `db:5432`.
- Beim Containerstart werden zuerst `prisma migrate deploy` und optional ein Seed bei leerer Datenbank ausgefuehrt.
- Der Bootstrap versucht Datenbankmigrationen mehrfach erneut, falls PostgreSQL kurz nach dem Stack-Start noch nicht bereit ist.
- Fuer internes HTTP sollte `COOKIE_SECURE=false` gesetzt bleiben, damit Browser die Session-Cookies nicht verwerfen.
- Fuer den browserbasierten Kamera-Scan im Kiosk ist in der Praxis HTTPS oder `localhost` noetig. Reines LAN-HTTP blockiert den Kamerazugriff meist ohne Berechtigungsdialog.
- Wenn bereits ein vorgeschalteter Nginx-Proxy HTTPS terminiert, sollte die App intern auf `http://<host>:5600` bleiben.
- In diesem Fall `APP_URL` auf die externe HTTPS-Adresse des Proxys setzen und `COOKIE_SECURE=true` aktivieren.
- Fuer den Scanner zaehlt die HTTPS-Verbindung zwischen Browser und Proxy. Die Verbindung vom Proxy zur App darf dabei weiterhin HTTP sein.
- Wichtig bleibt, dass das Proxy-Zertifikat vom Browser als vertrauenswuerdig akzeptiert wird.
- Vor dem ersten Produktivstart sollten `SESSION_SECRET`, `KIOSK_SECRET` und PostgreSQL-Zugangsdaten ersetzt werden.
