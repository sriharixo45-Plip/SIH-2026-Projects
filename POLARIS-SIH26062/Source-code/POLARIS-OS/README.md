# POLARIS-OS

SIH26062 integrated polar expedition logistics and asset management prototype.

## Architecture

- `services/api`: NestJS API, Prisma 7, PostgreSQL/PostGIS migrations, authentication, permissions, audit records, and the station-scoped change feed.
- `apps/hq-dashboard`: React HQ client. Production requests use the same-origin `/api` reverse proxy.
- Android Field App: separate authoritative project at `E:\GitHub\POLARIS-Field`. It uses the existing Kotlin/Compose UI, Room, SyncManager, and WorkManager offline queue. Build/install from that repository; `apps/field-android` in this repository is a duplicate, non-authoritative artifact and must not be used for demonstrations.
- `services/api`: optionally connects to AISStream using the server-only `AISSTREAM_API_KEY`. Received Antarctic positions are persisted to PostGIS and served through authenticated vessel endpoints. No credentials means the AIS feed remains disabled and the UI shows that state.
- `docker-compose.yml`: local demo deployment with database, migration-on-start API, and Nginx-served dashboard.

Field clients receive station-scoped records from `GET /sync-operations/changes`, then submit durable operations to `POST /sync-operations`. Device identity, operation idempotency, optimistic versions, and change cursors are checked by the API. A field role cannot use unscoped operational listing endpoints.

## Local demonstration

1. Copy `.env.example` to `.env` and replace all three example values with private values. `JWT_SECRET` must have at least 32 characters and `DEMO_PASSWORD` at least 12. Never commit `.env`.
2. Start the full server stack. The API waits for PostGIS, deploys Prisma migrations, and exposes its database health check.

   ```powershell
   docker compose up --build -d
   docker compose ps
   ```

3. Create the demo accounts and operational records:

   ```powershell
   docker compose exec api npm run seed:demo
   ```

   The seed is idempotent. It creates an HQ Administrator account (`EMP-001`, `admin@polaris.org`) and a station-scoped Station Operator (`EMP-002`, `field@polaris.org`); both use the private `DEMO_PASSWORD` from `.env`. The seed never contains a baked-in password. For the local SIH demonstration only, set `DEMO_PASSWORD=PolarisDemo2026!` in `.env`; both demo accounts use that password. The API stores Argon2id hashes, and the dashboard does not contain the password. Use a unique secret for any deployed environment; never use these demo accounts in production.

4. Open `http://<demo-host>:8080` for HQ. Sign in as the admin account. A demo device can use the operator account. Ensure the demo host firewall permits inbound port 8080 from the phone and laptop.
5. Install the Android debug APK using the build steps below. In Settings, use `http://<demo-host>:8080/api/` as the backend URL for a trusted demo LAN. Debug builds allow HTTP for this purpose; release builds require HTTPS. For deployment, put TLS in front of the dashboard/API and use the HTTPS URL.

## Development commands

```powershell
npm ci
npm run build
npm test
npm run test:e2e
```

For a local API without Docker, configure `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and `CORS_ORIGINS` in `services/api/.env`; deploy migrations with `npx prisma migrate deploy` from `services/api`; then run `npm run dev:api`. For the dashboard dev server, set `VITE_API_PROXY_TARGET` in `apps/hq-dashboard/.env.local` to the API origin and run `npm run dev:dashboard`.

## Android APK

Install Android Studio or Android SDK Platform 35 and JDK 17, then run:

```powershell
cd E:\GitHub\POLARIS-Field
.\gradlew.bat :app:assembleDebug
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

The backend can be selected in the field app settings. The default debug endpoint is `http://127.0.0.1:3000/` (use `adb reverse tcp:3000 tcp:3000` for a phone connected over USB). A deployment can also set `-PpolarisApiBaseUrl=https://api.example.org/`. Release APKs require HTTPS and a deployment signing configuration.

## SIH demonstration sequence

1. Start the Compose stack, seed demo data, and sign into HQ.
2. Install the field APK and sign in as `EMP-002` at the demo backend. Initial station data downloads to Room.
3. Disable the phone’s network. Confirm previously downloaded expedition, cargo, inventory, personnel, and transport records remain visible.
4. Save an incident and queue a supported status/quantity update. Close and reopen the app; the queued operations remain visible in Sync.
5. Re-enable network. WorkManager registers the device, sends operations in local sequence order, retrieves incremental station changes, and advances its local cursor. Refresh HQ and confirm the incident/update.
6. To demonstrate a stale-version conflict, update the same supported record from HQ after the phone’s last synchronization, then submit a field update based on its earlier version. The phone retains both values and offers “Keep server” or “Keep local”. The backend applies the incoming operation against the latest version when selected and records the resolution in the audit log.
7. Inspect Sync Operations, Conflicts, and Audit in HQ. Confirm the resolution and final authoritative record.

The complete flow requires a physical phone and reachable PostgreSQL/API host. Enable AIS by setting `AISSTREAM_API_KEY` in the backend environment. The key is not sent to or bundled in the dashboard. Run the full flow and verify actual feed data before presenting; automated service tests are not a substitute for that demonstration.
