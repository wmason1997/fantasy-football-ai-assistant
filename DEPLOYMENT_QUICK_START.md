# Deployment Quick Start Guide

**Time to Deploy: ~15 minutes**

Complete checklist to get your Fantasy Football AI Assistant live in production.

---

## Prerequisites

Install these first:
```bash
npm install -g pnpm @railway/cli vercel
```

---

## Step 1: Deploy Backend API to Railway (5 min)

### 1.1 Create Project
1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `fantasy-football-ai-assistant`

### 1.2 Add Databases
- Click **"New Service"** → **"PostgreSQL"**
- Click **"New Service"** → **"Redis"**

### 1.3 Configure API Service
- Go to Settings → Root Directory: `apps/api`

### 1.4 Set Environment Variables
```bash
NODE_ENV=production
JWT_SECRET=<run: openssl rand -base64 32>
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
FRONTEND_URL=https://your-app.vercel.app
```

### 1.5 Deploy
- Click **"Deploy"**
- Copy your Railway API URL

### 1.6 Run Migrations
```bash
railway login
railway link
railway run --service api pnpm --filter database migrate:deploy
```

---

## Step 2: Deploy Frontend to Vercel (3 min)

### 2.1 Import Project
1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import `fantasy-football-ai-assistant`

### 2.2 Configure
- Root Directory: `apps/web`
- Framework: Next.js (auto-detected)

### 2.3 Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
```

### 2.4 Deploy
- Click **"Deploy"**
- Copy your Vercel URL

### 2.5 Update Railway CORS
- Go back to Railway
- Update `FRONTEND_URL` to your Vercel URL
- Redeploy API service

---

## Step 3: Verify Deployment (2 min)

### API Health Check
```bash
curl https://your-api.up.railway.app/health
```

Expected:
```json
{"status": "ok", "database": "connected", "redis": "connected"}
```

### Frontend Check
Visit `https://your-app.vercel.app`
- ✅ Page loads
- ✅ No CORS errors in console

---

## Step 4: Set Up CI/CD (5 min)

### 4.1 Get Tokens

**Railway Token:**
- Railway Dashboard → Account Settings → Tokens
- Create new token, copy it

**Vercel Token:**
- Vercel Dashboard → Settings → Tokens
- Create new token, copy it

**Vercel IDs:**
```bash
cd apps/web
vercel link
cat .vercel/project.json
# Copy orgId and projectId
```

### 4.2 Add GitHub Secrets

Go to GitHub → Settings → Secrets → Actions, add:

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Your Railway token |
| `VERCEL_TOKEN` | Your Vercel token |
| `VERCEL_ORG_ID` | From .vercel/project.json |
| `VERCEL_PROJECT_ID` | From .vercel/project.json |
| `API_URL` | Your Railway URL |
| `WEB_URL` | Your Vercel URL |

### 4.3 Test CI/CD
```bash
git add .
git commit -m "Set up deployment infrastructure"
git push origin main
```

Watch GitHub Actions tab - should auto-deploy!

---

## Done! 🎉

Your app is now live at:
- **Frontend:** https://your-app.vercel.app
- **API:** https://your-api.up.railway.app

---

## Next Steps

1. **Set up monitoring** - See [DEPLOYMENT.md](./DEPLOYMENT.md#monitoring--maintenance)
2. **Configure custom domain** - Optional, improves branding
3. **Enable Sentry** - Error tracking for production
4. **Test with real league** - Connect your Sleeper league
5. **Plan beta testing** - Invite fellow fantasy players

---

## Cheat Sheet

### Common Commands

```bash
# View Railway logs
railway logs --service api

# Run migrations
railway run --service api pnpm --filter database migrate:deploy

# Check migration status
railway run --service api pnpm --filter database migrate:status

# View database in Prisma Studio
railway run --service api pnpm --filter database studio

# View Vercel logs
vercel logs https://your-app.vercel.app

# Redeploy Vercel
cd apps/web && vercel --prod
```

### Files Reference

| File | Purpose |
|------|---------|
| `DEPLOYMENT.md` | Complete deployment guide |
| `ENV_SETUP.md` | Environment variables reference |
| `apps/api/Dockerfile` | Docker config for Railway |
| `apps/api/railway.json` | Railway service config |
| `apps/web/vercel.json` | Vercel project config |
| `.github/workflows/ci.yml` | CI tests workflow |
| `.github/workflows/deploy.yml` | Auto-deployment workflow |
| `.github/workflows/migrate-db.yml` | Manual migrations workflow |

---

## Troubleshooting

**CORS errors?**
- Check `FRONTEND_URL` in Railway matches Vercel URL exactly
- Must include `https://` and no trailing slash

**Database not connecting?**
- Verify PostgreSQL plugin is installed in Railway
- Check `DATABASE_URL` is auto-set

**Build failing?**
- Test locally: `pnpm build`
- Check Railway/Vercel logs for specific errors

**Migrations not applied?**
- Run: `railway run --service api pnpm --filter database migrate:status`
- Deploy: `railway run --service api pnpm --filter database migrate:deploy`

---

**Need more details?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive guide.
