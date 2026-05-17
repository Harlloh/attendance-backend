# Attendance System — Backend

REST API for the NYSC CDS Attendance & Queue Management System. Handles session management, geofence validation, queue assignment, QR code verification, and attendance export.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| Framework | Express 5 (ESM) |
| ORM | Prisma 7 |
| Database | PostgreSQL (Neon) |
| Cache | Redis |
| Auth | JWT (access + refresh token rotation) |
| Error Tracking | Sentry |
| Export | ExcelJS |

---

## Prerequisites

- **Node.js** — Latest LTS version
- **PostgreSQL** — A live database. The project is configured for [Neon](https://neon.tech) but any PostgreSQL provider works
- **Redis** — Required. The four highest-traffic endpoints depend on Redis for caching. You can remove the caching logic if you intentionally don't want it, but it is strongly recommended

---

## Project Structure

```
attendance-backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── db.js
│   │   ├── redis.js
│   │   └── utils.js
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   └── userRoutes.js
│   └── server.js
├── load_testing/
├── instrument.js
├── prisma.config.ts
├── seed.js
└── package.json
```

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd attendance-backend
npm install
```

### 2. Configure environment variables

Copy the example below into a `.env` file at the root of the project:

```env
PORT=8000
FRONTEND_URL='http://localhost:5173'

DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"

NODE_ENV="dev"

JWT_ACCESS_SECRET='your-secret-here'

# JWT access token expiry — standard JWT duration string (e.g. '15m', '50m', '1h')
ACCESS_EXPIRY_TIME='50m'

# Refresh token cookie expiry — integer representing number of DAYS
# e.g. 30 = cookie expires in 30 days
REFRESH_EXPIRY_TIME='30'

# Initial admin credentials — used by the seed script
ADMIN_EMAIL='admin@example.com'
ADMIN_PASSWORD='your-strong-password'

REDIS_URL=redis://127.0.0.1:6379
```

> **Note on `REFRESH_EXPIRY_TIME`:** This value is parsed as an integer and treated as **days**. The value `30` sets the refresh token cookie to expire in 30 days.

### 3. Configure Sentry

Sentry is initialised in `instrument.js`, which is imported at the top of `server.js` before anything else loads. Add your Sentry DSN to `instrument.js` to enable error tracking. If you don't have a Sentry project, you can leave this unconfigured and the app will run normally without it.

### 4. Set up the database

```bash
# Generate the Prisma client
npm run build

# Push the schema to your database
npx prisma db push
```


### 5. Start the development server

```bash
npm run start
```

This starts the server with `--watch` for hot reloading and loads environment variables from `.env` automatically via Node's `--env-file` flag.

For production:

```bash
npm run start:prod
```

---

## Data Models

```
Admin             — Admin account. One admin maps to one LGA.
LGA               — Local Government Area config: name, coordinates, radius, check-in slug.
Session           — An attendance session opened by an admin for their LGA.
AttendanceRecord  — A single corper's check-in record within a session.
VerificationToken — Refresh token records tied to an admin account.
```

Key constraints:
- One admin is linked to exactly one LGA and vice versa
- Within a session, a corper's state code, queue number, and device fingerprint are each unique — this prevents duplicate check-ins at all three levels
- Multiple devices can be logged into a single admin account simultaneously — this is intentional and avoids unnecessary sub-admin complexity given the project scope

---

## Authentication

The API uses **JWT with access and refresh token rotation**:

- **Access token** — Short-lived, verified by `authMiddleware` on all `/admin` routes. Expiry controlled by `ACCESS_EXPIRY_TIME`.
- **Refresh token** — Stored as an `httpOnly`, `secure`, `sameSite=none` cookie. Expiry controlled by `REFRESH_EXPIRY_TIME` (in days).
- `GET /auth/refresh` exchanges a valid refresh token cookie for a new access token
- `GET /auth/logout` clears the refresh token cookie and invalidates the session

---

## API Reference

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Returns server status, uptime, and a basic database connectivity check. |

---

### Auth Routes — `/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Log in with email and password. Returns an access token and sets the refresh token cookie. |
| GET | `/auth/refresh` | Exchange a valid refresh token cookie for a new access token. |
| GET | `/auth/logout` | Clear the refresh token cookie and invalidate the session. |

> `POST /auth/register` exists in the codebase but is intentionally commented out.

---

### Admin Routes — `/admin`

All admin routes are protected by `authMiddleware`. A valid access token must be present on every request.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/admin/update-lga` | Update the LGA's name, coordinates, and geofence radius. Automatically generates a unique `checkInSlug` which forms the corper-facing check-in URL: `yourdomain.com/<checkInSlug>`. |
| POST | `/admin/open-session` | Open a new attendance session for the admin's LGA. |
| POST | `/admin/close-session` | Close the currently active session. |
| POST | `/admin/assign-number` | Manually assign a queue number to a corper — for cases where a corper cannot use their mobile device. |
| GET | `/admin/attendanceList` | Retrieve the attendance list for the active session. |
| GET | `/admin/attendanceList/search` | Search the attendance list by name or state code. |
| GET | `/admin/getAdmin` | Fetch the current admin's details and their linked LGA. Used by connected devices to sync state when an admin makes changes. |
| POST | `/admin/scan` | Validate a corper's QR code and mark them as verified for the session. |
| GET | `/admin/sessions` | List all sessions (active and historical) for this admin's LGA. |
| GET | `/admin/sessions/:sessionId/export` | Export a session's full attendance record as an Excel (`.xlsx`) file. |

---

### User Routes — `/user`

User routes do not require authentication but are gated by session and location validation logic.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/user/validateSession` | Check whether a session is currently open for the LGA. |
| GET | `/user/validateLocation` | Validate that the corper's device coordinates fall within the LGA's configured geofence radius using the Haversine formula. |
| POST | `/user/getNumber` | Assign a queue number to the corper and generate their personal QR code. Requires an open session and a passed location check. |

---

## Check-In Flow

1. Admin updates LGA details → a unique `checkInSlug` is auto-generated
2. Admin prints or displays the QR code for their LGA's check-in URL: `yourdomain.com/<checkInSlug>`
3. Corper scans the QR code on arrival and lands on the check-in page
4. Frontend calls `validateSession` → `validateLocation` → `getNumber` in sequence
5. Corper receives their queue number and a personal QR code
6. Admin scans the corper's QR code via `POST /admin/scan` to mark them as verified

---

## Redis Caching

Redis is used on the four endpoints expected to receive the highest concurrent traffic during an open session:

- `GET /user/validateSession`
- `GET /user/validateLocation`
- `POST /user/getNumber`
- `POST /admin/scan`

To remove Redis from the project, remove the caching logic from these four endpoints and their associated files in `src/config/redis.js`.

---

## Error Handling

The server handles graceful shutdown on `SIGINT`, `unhandledRejection`, and `uncaughtException` — closing the HTTP server and disconnecting from the database before exiting. Sentry's error handler is registered as the last middleware in the chain to capture any unhandled Express errors.

---

## Deployment (Render)

1. Create a new **Web Service** on [Render](https://render.com)
2. Set the **build command**:
   ```bash
   npm install && npm run build
   ```
3. Set the **start command**:
   ```bash
   npm run start:prod
   ```
4. Add all environment variables from the `.env` reference above in Render's environment settings
5. Provision a Redis instance (Render managed Redis or an external provider like [Upstash](https://upstash.com)) and update `REDIS_URL` accordingly

---

## Scripts

| Command | Description |
|---|---|
| `npm run start` | Start dev server with `--watch` hot reload |
| `npm run start:prod` | Start production server |
| `npm run build` | Generate the Prisma client |
| `npx prisma db push` | Push schema changes to the database |
| `npx prisma db seed` | Seed initial admin and test attendance data |
| `npx prisma studio` | Open Prisma Studio to browse the database |
