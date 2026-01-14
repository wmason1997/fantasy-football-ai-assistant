# Deployment Guide

Complete guide to deploying the Fantasy Football AI Assistant to production using Vercel (frontend) and Railway (backend).

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Backend Deployment (Railway)](#backend-deployment-railway)
4. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
5. [Database Setup & Migrations](#database-setup--migrations)
6. [CI/CD Setup](#cicd-setup)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ GitHub account with this repository
- ✅ Railway account (free tier available)
- ✅ Vercel account (free tier available)
- ✅ Node.js 20+ installed locally
- ✅ pnpm installed (`npm install -g pnpm`)
- ✅ Railway CLI installed (`npm install -g @railway/cli`)
- ✅ Vercel CLI installed (optional, `npm install -g vercel`)

---

## Quick Start

**5-minute deployment checklist:**

1. ✅ Deploy backend to Railway (5 min)
2. ✅ Add PostgreSQL + Redis to Railway (2 min)
3. ✅ Configure environment variables (3 min)
4. ✅ Run database migrations (1 min)
5. ✅ Deploy frontend to Vercel (2 min)
6. ✅ Configure Vercel environment variables (1 min)
7. ✅ Test the deployment (2 min)

**Total: ~15-20 minutes**

---

## Backend Deployment (Railway)

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your `fantasy-football-ai-assistant` repository
6. Railway will auto-detect the Node.js app

### Step 2: Add Database Services

#### PostgreSQL

1. In your Railway project dashboard, click **"New Service"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will create a PostgreSQL instance and set `DATABASE_URL` automatically
4. Note: This is free on Starter plan (up to 1GB storage)

#### Redis

1. Click **"New Service"** again
2. Select **"Database"** → **"Redis"**
3. Railway will create a Redis instance and set `REDIS_URL` automatically
4. Note: This is free on Starter plan (up to 100MB)

### Step 3: Configure API Service

1. Click on your API service in the Railway dashboard
2. Go to **"Settings"** → **"Root Directory"**
3. Set root directory to: `apps/api`
4. Railway will automatically detect the Dockerfile

### Step 4: Set Environment Variables

In the Railway API service, go to **"Variables"** and add:

```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=<run: openssl rand -base64 32>
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
FRONTEND_URL=https://your-app.vercel.app
```

**Important:**
- Generate `JWT_SECRET` locally: `openssl rand -base64 32`
- Replace `FRONTEND_URL` with your actual Vercel URL (you'll get this in Step 5)
- `DATABASE_URL` and `REDIS_URL` are automatically provided by Railway plugins

### Step 5: Deploy API

1. Click **"Deploy"** in Railway
2. Railway will build using the Dockerfile
3. Wait for deployment to complete (~3-5 minutes)
4. Copy your Railway API URL (e.g., `https://fantasy-football-api.up.railway.app`)

### Step 6: Run Database Migrations

Using Railway CLI:

```bash
# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run --service api pnpm --filter database exec prisma migrate deploy
```

Or use the GitHub Actions workflow (see [CI/CD Setup](#cicd-setup)).

---

## Frontend Deployment (Vercel)

### Step 1: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your `fantasy-football-ai-assistant` repository
4. Vercel will auto-detect Next.js

### Step 2: Configure Build Settings

In the project setup:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm install && pnpm --filter @fantasy-football/web build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |

**Note:** Vercel may auto-detect these settings correctly.

### Step 3: Set Environment Variables

In Vercel project settings → **Environment Variables**, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.up.railway.app` | Production |

Replace with your actual Railway API URL from Step 5 above.

### Step 4: Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy (~2-3 minutes)
3. Copy your Vercel deployment URL (e.g., `https://fantasy-football-ai.vercel.app`)
4. **Go back to Railway** and update `FRONTEND_URL` to this Vercel URL

### Step 5: Redeploy API (if needed)

After updating `FRONTEND_URL` in Railway:
1. Go to your Railway API service
2. Click **"Deploy"** to redeploy with the correct CORS settings

---

## Database Setup & Migrations

### Initial Migration

After deploying to Railway:

```bash
# Using Railway CLI
railway run --service api pnpm --filter database exec prisma migrate deploy
```

### Future Migrations

Whenever you create new migrations:

```bash
# Locally, create a migration
pnpm db:migrate

# Commit the migration files
git add packages/database/prisma/migrations
git commit -m "Add migration for X"

# Push to GitHub
git push origin main

# Run migration on Railway
railway run --service api pnpm --filter database exec prisma migrate deploy
```

### Automated Migrations (Recommended)

Use the GitHub Actions workflow:
1. Go to your repository → **Actions**
2. Select **"Run Database Migrations"**
3. Click **"Run workflow"**
4. Choose environment (production/staging)

---

## CI/CD Setup

### GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description | How to Get |
|--------|-------------|------------|
| `RAILWAY_TOKEN` | Railway API token | Railway dashboard → Account Settings → Tokens |
| `VERCEL_TOKEN` | Vercel API token | Vercel dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | Run `vercel link` locally |
| `VERCEL_PROJECT_ID` | Vercel project ID | Run `vercel link` locally |
| `API_URL` | Production API URL | Your Railway API URL |
| `WEB_URL` | Production web URL | Your Vercel deployment URL |

### Getting Vercel IDs

```bash
# In apps/web directory
cd apps/web
vercel link

# This creates .vercel/project.json with:
# - orgId → VERCEL_ORG_ID
# - projectId → VERCEL_PROJECT_ID
```

### Workflows

Three GitHub Actions workflows are configured:

1. **CI (`.github/workflows/ci.yml`)**
   - Runs on all PRs and pushes
   - Executes tests, linting, type checking
   - Runs E2E tests with Playwright

2. **Deploy (`.github/workflows/deploy.yml`)**
   - Runs on push to `main` branch
   - Deploys API to Railway
   - Deploys frontend to Vercel
   - Runs health checks

3. **Migrate DB (`.github/workflows/migrate-db.yml`)**
   - Manual workflow trigger
   - Runs database migrations on Railway

### Enable Automatic Deployments

Once secrets are configured:
1. Push to `main` branch
2. GitHub Actions will automatically deploy
3. Check the **Actions** tab to monitor progress

---

## Post-Deployment Verification

### 1. API Health Check

```bash
curl https://your-api.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

### 2. Frontend Check

Visit: `https://your-app.vercel.app`

Verify:
- ✅ Page loads without errors
- ✅ Login page is accessible
- ✅ No CORS errors in browser console (F12)

### 3. Database Connection

```bash
# Using Railway CLI
railway run --service api pnpm --filter database exec prisma studio
```

This opens Prisma Studio to view your production database.

### 4. Test Complete Flow

1. Register a new user
2. Login
3. Connect a Sleeper league
4. View trade recommendations
5. Check waiver wire suggestions

---

## Monitoring & Maintenance

### Railway Monitoring

Railway provides built-in monitoring:
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: Deployment history

Access: Railway Dashboard → Your Service → Metrics/Logs

### Vercel Analytics

Vercel provides:
- **Web Vitals**: Performance metrics
- **Error Tracking**: Runtime errors
- **Edge Logs**: Request/response logs

Access: Vercel Dashboard → Your Project → Analytics

### Recommended External Tools

For production, consider adding:

1. **Sentry** (Error Tracking)
   ```bash
   pnpm add @sentry/node @sentry/nextjs
   ```

2. **Datadog** (APM & Metrics)
   - Integrates with Railway
   - Real-time performance monitoring

3. **LogDNA/LogRocket** (Logging)
   - Centralized log aggregation
   - Session replay for debugging

### Database Backups

Railway automatically backs up PostgreSQL:
- **Frequency**: Daily
- **Retention**: 7 days (Starter plan)
- **Manual backups**: Railway Dashboard → Database → Backups

### Health Checks

Set up monitoring for:
- API health endpoint: `https://your-api.up.railway.app/health`
- Frontend uptime: `https://your-app.vercel.app`

Use services like:
- UptimeRobot (free, simple uptime monitoring)
- Pingdom (advanced monitoring)
- Better Uptime (modern, developer-friendly)

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Solution:**
```bash
# Verify FRONTEND_URL in Railway matches Vercel URL exactly
# Must include https:// and no trailing slash
FRONTEND_URL=https://fantasy-football-ai.vercel.app
```

#### 2. Database Connection Failed

**Symptom:** API logs show "Can't reach database server"

**Solution:**
- Verify PostgreSQL plugin is installed in Railway
- Check `DATABASE_URL` is set automatically
- Ensure database is running (Railway Dashboard → Database)

#### 3. Redis Connection Failed

**Symptom:** Cache errors, session failures

**Solution:**
- Verify Redis plugin is installed in Railway
- Check `REDIS_URL` is set automatically
- Test connection: `railway run redis-cli -u $REDIS_URL ping`

#### 4. Build Failures

**Symptom:** Deployment fails during build

**Solution:**
```bash
# Test build locally first
pnpm build

# Check TypeScript errors
pnpm --filter @fantasy-football/api build:strict

# Review Railway build logs for specific errors
```

#### 5. Migrations Not Applied

**Symptom:** Database schema doesn't match code

**Solution:**
```bash
# Check migration status
railway run --service api pnpm --filter database exec prisma migrate status

# Force apply migrations
railway run --service api pnpm --filter database exec prisma migrate deploy
```

#### 6. Environment Variables Not Updating

**Symptom:** Changed env vars not taking effect

**Solution:**
- Railway: Variables update automatically, but you need to redeploy
- Vercel: Redeploy after changing variables
- Both: Hard refresh browser cache (Cmd+Shift+R)

### Logs & Debugging

#### View Railway Logs
```bash
# Real-time logs
railway logs --service api

# Filter logs
railway logs --service api --filter error
```

#### View Vercel Logs
```bash
# Using Vercel CLI
vercel logs https://your-app.vercel.app
```

Or use the Vercel Dashboard → Runtime Logs.

### Performance Issues

If experiencing slow response times:

1. **Check Railway metrics** - CPU/Memory usage
2. **Review database queries** - Use Prisma logging
3. **Check Redis hit rate** - Verify caching is working
4. **Optimize API calls** - Review Sleeper API rate limits
5. **Consider scaling** - Railway offers more powerful plans

### Emergency Rollback

If deployment breaks production:

#### Railway
1. Go to Deployments tab
2. Click on previous working deployment
3. Click **"Rollback to this deployment"**

#### Vercel
1. Go to Deployments tab
2. Find last working deployment
3. Click **"⋯"** → **"Promote to Production"**

---

## Cost Estimates

### Free Tier (Development/Testing)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Railway | $5/month credit | 500 hours execution, 1GB DB |
| Vercel | 100GB bandwidth | 100 deployments/day |
| **Total** | **$0/month** | Good for development |

### Starter Tier (Production)

| Service | Cost | Specs |
|---------|------|-------|
| Railway Pro | ~$10-20/month | Based on usage |
| Vercel Pro | $20/month | Unlimited deployments |
| **Total** | **$30-40/month** | Good for small user base |

### Estimated Production (500 users)

| Resource | Monthly Cost |
|----------|--------------|
| Railway API | $15 |
| PostgreSQL | $10 |
| Redis | $5 |
| Vercel Hosting | $20 |
| **Total** | **~$50/month** |

---

## Security Checklist

Before going live:

- ✅ Generated strong `JWT_SECRET`
- ✅ HTTPS enabled (automatic on Railway/Vercel)
- ✅ CORS configured to specific domain
- ✅ Rate limiting enabled (already in code)
- ✅ Environment variables not committed to Git
- ✅ Database backups enabled
- ✅ Error logging configured
- ✅ Dependency vulnerabilities checked (`pnpm audit`)

---

## Next Steps

After successful deployment:

1. ✅ Set up monitoring (Sentry, Datadog)
2. ✅ Configure custom domain (Vercel/Railway)
3. ✅ Enable SSL certificate (automatic)
4. ✅ Set up uptime monitoring
5. ✅ Create runbook for incidents
6. ✅ Document emergency procedures
7. ✅ Plan scaling strategy
8. ✅ Schedule regular dependency updates

---

## Support & Resources

- **Railway Documentation**: https://docs.railway.app
- **Vercel Documentation**: https://vercel.com/docs
- **Prisma Migrations**: https://www.prisma.io/docs/guides/migrate
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-14 | 1.0.0 | Initial deployment guide |

---

**Need help?** Open an issue on GitHub or check the troubleshooting section above.
