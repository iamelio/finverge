## Online Loan Application & Verification System

This project delivers a full-stack demo platform for collecting, reviewing, and approving loan requests.

### Project Structure
- `backend/` – Node.js + Express API with SQLite storage
- `frontend/` – Static HTML/CSS/JS single-page experience that consumes the API

---

### Prerequisites
- Node.js 18+ and npm
- SQLite (bundled via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3))

---

### Setup
1. **Clone & install**
   ```bash
   git clone <repo>
   cd backend
   npm install
   ```

2. **Environment variables**
   Copy `.env.example` to `.env` inside `backend/` and adjust as needed:
   ```bash
   cp .env.example .env
   ```

3. **Run migrations & seed admin**
   ```bash
   npm run migrate
   ```
   Migrations create the required tables and (optionally) seed an administrator account if `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` are set.

4. **Start the backend**
   ```bash
   npm run dev
   ```
   The API defaults to `http://localhost:4000`.

5. **Start the frontend**
   - The static files live in `frontend/`. Any static server works; for example:
     ```bash
     npx http-server frontend -p 3000
     ```
   - Or open `frontend/index.html` directly. The frontend reads `window.API_BASE_URL` from `frontend/config.js`, which defaults to `http://localhost:4000/api`.

---

### API Overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/auth/register` | POST | Register a new user (returns session cookie) |
| `/api/auth/login` | POST | Authenticate and set session cookie |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Return current session user |
| `/api/loans` | POST | Submit a new loan request (user only) |
| `/api/loans` | GET | List loans (user = own loans, admin = all loans with filters) |
| `/api/loans/:id` | GET | Loan detail plus event history |
| `/api/loans/:id/status` | PATCH | Update status (admin only) |
| `/api/loans/:id/notes` | PATCH | Append admin notes (admin only) |
| `/api/admin/overview` | GET | Dashboard metrics & recent activity (admin) |

Authentication uses HTTP-only cookies with JWT payloads. CSRF protection relies on same-site cookies; adjust the cookie settings before production launch.

---

### Suggested Workflow
1. Register a user account via the frontend or `/api/auth/register`.
2. Submit a loan application from the frontend.
3. Login as the seeded admin user to approve or reject via the admin dashboard.

---

### Testing
- Backend unit tests live under `backend/tests/` (see `npm test`).
- Add integration tests to cover end-to-end flows using an in-memory SQLite database (`DATABASE_PATH=":memory:"`).

---

### Operational Notes
- Database files are kept under `backend/data/` and ignored from version control once `.gitignore` is applied.
- To reset the environment, delete the database files and rerun `npm run migrate`.
- In production, supply strong secrets (`JWT_SECRET`) and tighten CORS origins.

