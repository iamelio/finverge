## Finverge – online loan application system

simple full‑stack demo for submitting, reviewing, and approving loan requests.

### structure
- `backend/` – Node.js + Express API using SQLite via `better-sqlite3`
- `frontend/` – static html/css/js (Bootstrap) that calls the API

### prerequisites
- Node.js 18+ and npm

### quick start
1) backend setup
open the terminal, then type and paste these line by line.
   ```bash
   cd backend
   npm install
   cp .env.example .env   # adjust if needed
   npm run migrate        # create tables and optionally seed admin
   npm run dev            # starts on http://localhost:4000
   ```

1) frontend
- you can run it with the "Live Server" extension in VS Code.

OR

- open `frontend/index.html` directly, or serve the folder, e.g.:
  ```bash
  npx http-server frontend -p 3000
  ```
- API base URL comes from `frontend/config.js` (`window.API_BASE_URL`, default `http://localhost:4000/api`).

### configuration (backend/.env)
- `PORT` – API port (default `4000`)
- `DATABASE_PATH` – SQLite file path (default `./data/loan_app.db` relative to backend)
- `CORS_ORIGINS` – comma‑separated allowed origins (wildcards like `http://localhost:*` supported)
- `JWT_SECRET` / `JWT_EXPIRES_IN` – JWT signing and expiry
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` – optional admin user created by `npm run migrate`

### auth
- the API accepts JWTs either via `Authorization: Bearer <token>` or an HTTP‑only cookie (set by auth routes). the provided frontend stores the token and uses the `Authorization` header.

### endpoints
- all endpoints are under `/api`.
- notable ones: `GET /api/health`, auth (`/api/auth/*`), loans (`/api/loans/*`), admin (`/api/admin/*`).
- see `backend/src/routes/` for the complete, current list.

### scripts (backend)
- `npm run dev` – start with nodemon
- `npm start` – start server
- `npm run migrate` – run migrations and optional admin seed
- `npm test` – run unit tests (Node test runner)

### notes
- the SQLite database is in `backend/data/`. to reset it on your laptop, delete the db file and run `npm run migrate`.
- configure CORS via `.env` for your frontend origin(s). if you're using the same ports as i mentioned and did the `cp .env.example .env` thing, you shouldn't have any CORS problems. :)
