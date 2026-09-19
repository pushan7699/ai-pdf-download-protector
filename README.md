# AI PDF Security System

GenAI-powered PDF protection with real-time AI detection, watermarking, and access control.

## Stack
- **Frontend**: React + Vite + Tailwind → Vercel
- **Backend**: Node.js + Express → Render
- **Database**: MySQL → PlanetScale / Clever Cloud / Render MySQL

---

## Local Development

### 1. Start MySQL and create database
```sql
CREATE DATABASE pdf_security;
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in your values
npm install
node src/server.js
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Cloud Deployment

### Database — PlanetScale (free)
1. Go to https://planetscale.com → Create account
2. New database → name: `pdf_security` → region closest to you
3. Connect → Node.js → copy the connection string values
4. Run the schema: paste contents of `database/schema.sql` in the console

### Backend — Render (free)
1. Go to https://render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Environment**: Node
4. Add environment variables (copy from `.env.example`, fill real values):
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `JWT_SECRET` (generate random: `openssl rand -hex 32`)
   - `SESSION_SECRET` (generate another random string)
   - `CORS_ORIGIN` = your Vercel URL (set after frontend deploy)
   - `NODE_ENV` = `production`
5. Deploy → copy the service URL e.g. `https://pdf-security-backend.onrender.com`

### Frontend — Vercel (free)
1. Go to https://vercel.com → New Project
2. Import your GitHub repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL` = your Render backend URL (no trailing slash)
5. Deploy → copy the URL
6. Go back to Render → update `CORS_ORIGIN` to your Vercel URL → redeploy

---

## Default Admin Login
- Email: `admin@example.com`
- Password: `Admin123!`

**Change this immediately after first login.**
