# HireFlow AI: quick start

## Option A: everything in Docker (one command)

Needs Docker Desktop running. From this folder:

```powershell
docker compose up --build
```

Then open http://localhost:5173 (API docs: http://localhost:8000/docs).
Sign in with `demo-recruiter@example.com` / `demo-password-2026` (also `demo-admin@example.com`, `demo-viewer@example.com`).

The first start builds the images, runs the database migration and loads demo data automatically. Stop with Ctrl+C, and `docker compose down` removes the containers (add `-v` to also wipe the database and uploads).

Optional real LLM: copy `.env.example` to `.env` in this folder and fill in `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` (for example Groq: `https://api.groq.com/openai/v1`), then `docker compose up --build` again. Leave them as `none` to use the built-in deterministic mode. Never commit `.env`.

Note: this Docker setup was written and its pieces checked individually (migration + seed command, frontend build), but the full `docker compose up` was not run, because the build environment had no Docker. If a step fails, paste the error.

## Option B: run without Docker for the app (database still needed)

Prerequisites: Docker Desktop, Python 3.12+ and Node 20+ (Node 22 was used for testing).

```powershell
# 1. Database (repo root)
docker compose up -d db
docker exec -it hireflow-db psql -U hireflow -d postgres -c "CREATE DATABASE hireflow_test OWNER hireflow;"

# 2. Backend (new terminal, from backend\)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env        # then set SECRET_KEY to a long random string
alembic upgrade head               # the initial migration is included
python -m app.seed --reset         # demo data; logins below
uvicorn app.main:app --reload --port 8000

# 3. Frontend (second terminal, from frontend\)
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Demo logins (password `demo-password-2026`): demo-admin@example.com, demo-recruiter@example.com, demo-viewer@example.com.

Checks: `pytest -q` in `backend\` (needs the db container and `hireflow_test`), `npm test` and `npm run build` in `frontend\`. `scripts\check.ps1` runs everything.

Notes:
- The shadcn UI components in `frontend/src/components/ui` are included (copied from the public shadcn registry source). `components.json` is set up if you want to add more with `npx shadcn@latest add <name>`.
- AI features work without any API key (deterministic mode). To use an LLM set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` in `backend/.env`.
- See README.md for architecture, deployment (Vercel, Render, Neon, R2) and limitations.
