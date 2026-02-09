# Deploy Now - Interactive Guide

Follow this guide step by step to deploy your Fantasy Football AI Assistant.

**Estimated Time:** 15-20 minutes

---

## ✅ Prerequisites Installed

- ✅ Railway CLI installed
- ✅ Vercel CLI installed
- ✅ Git repository is up to date

---

## 🚂 Part 1: Deploy to Railway (Backend)

### Step 1.1: Login to Railway

Run this command in your terminal:

```bash
railway login
```

This will:
1. Open your browser
2. Ask you to authorize the Railway CLI
3. Return to terminal when done

**If you don't have a Railway account:**
- Go to [railway.app](https://railway.app)
- Sign up with GitHub (recommended)
- Then run `railway login`

---

### Step 1.2: Create Railway Project (Option A - Using CLI)

```bash
# Initialize new Railway project
railway init

# When prompted:
# - Project name: fantasy-football-ai
# - Start from: Empty Project
```

### Step 1.2: Create Railway Project (Option B - Using Dashboard)

**Easier approach - Use the Railway Dashboard:**

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Empty Project"**
3. Name it: `fantasy-football-ai`
4. Click **"Add Service"** → **"GitHub Repo"**
5. Select `fantasy-football-ai-assistant` repository
6. Railway will detect the monorepo

---

### Step 1.3: Configure API Service

**In Railway Dashboard:**

1. Click on your API service
2. Go to **Settings** tab
3. Set **Root Directory**: `apps/api`
4. Set **Build Command**: (leave default, Dockerfile will be used)
5. Click **"Save"**

---

### Step 1.4: Add PostgreSQL Database

**In Railway Dashboard:**

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway will create a PostgreSQL instance
3. `DATABASE_URL` will be automatically provided to your API service

---

### Step 1.5: Add Redis Cache

**In Railway Dashboard:**

1. Click **"+ New"** → **"Database"** → **"Add Redis"**
2. Railway will create a Redis instance
3. `REDIS_URL` will be automatically provided to your API service

---

### Step 1.6: Configure Environment Variables

**In Railway Dashboard:**

1. Go to your API service
2. Click **"Variables"** tab
3. Add these variables:

```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=<paste-generated-secret>
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
FRONTEND_URL=https://temporary-url.vercel.app
```

**Generate JWT_SECRET:**

Run this in your terminal and copy the output:

```bash
openssl rand -base64 32
```

Paste the result as `JWT_SECRET` value in Railway.

**Note:** We'll update `FRONTEND_URL` later after deploying to Vercel.

---

### Step 1.7: Deploy API

**Option A - Automatic Deployment:**

Railway will automatically deploy when you push to GitHub (already done!)

Check the **Deployments** tab to see the build progress.

**Option B - Manual Deployment via CLI:**

```bash
# Link to your Railway project
railway link

# Deploy
railway up
```

**Wait for deployment to complete** (~3-5 minutes)

---

### Step 1.8: Get Your Railway API URL

**In Railway Dashboard:**

1. Go to your API service
2. Click **"Settings"** tab
3. Scroll to **"Domains"**
4. Click **"Generate Domain"**
5. Copy your Railway URL (e.g., `https://fantasy-football-api.up.railway.app`)

**Save this URL - you'll need it for Vercel!**

---

### Step 1.9: Run Database Migrations

Now that the database is set up, run migrations:

```bash
# Using Railway CLI
railway run --service <your-api-service-name> pnpm --filter database migrate:deploy
```

**Or use the migration script:**

```bash
# Set DATABASE_URL from Railway
railway variables | grep DATABASE_URL

# Export it
export DATABASE_URL="<paste-database-url-from-above>"

# Run migrations
cd packages/database
pnpm migrate:production
```

---

## ▲ Part 2: Deploy to Vercel (Frontend)

### Step 2.1: Login to Vercel

```bash
cd apps/web
vercel login
```

This will:
1. Open your browser
2. Ask you to authorize the Vercel CLI
3. Return to terminal when done

---

### Step 2.2: Deploy to Vercel

```bash
# From apps/web directory
vercel
```

**Follow the prompts:**

1. **Set up and deploy?** `Y`
2. **Which scope?** (Select your account)
3. **Link to existing project?** `N`
4. **What's your project's name?** `fantasy-football-ai`
5. **In which directory is your code located?** `./` (it's already in apps/web)
6. **Want to modify settings?** `N`

Vercel will:
- Detect Next.js
- Install dependencies
- Build your app
- Deploy to a preview URL

**Copy the preview URL** (e.g., `https://fantasy-football-ai-xxxxx.vercel.app`)

---

### Step 2.3: Deploy to Production

```bash
# Deploy to production
vercel --prod
```

**Copy the production URL** (e.g., `https://fantasy-football-ai.vercel.app`)

---

### Step 2.4: Configure Environment Variable in Vercel

**Option A - Via CLI:**

```bash
# Add your Railway API URL
vercel env add NEXT_PUBLIC_API_URL production

# When prompted, paste your Railway URL:
# https://fantasy-football-api.up.railway.app
```

**Option B - Via Dashboard:**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add:
   - **Name:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://your-railway-api.up.railway.app`
   - **Environment:** Production

---

### Step 2.5: Redeploy with Environment Variable

```bash
# Redeploy to production with new env var
vercel --prod
```

---

## 🔄 Part 3: Update Railway CORS

Now that you have your Vercel URL, update Railway:

### Step 3.1: Update FRONTEND_URL in Railway

**In Railway Dashboard:**

1. Go to your API service
2. Click **"Variables"** tab
3. Find `FRONTEND_URL`
4. Update to your Vercel production URL: `https://fantasy-football-ai.vercel.app`
5. Click **"Save"**

---

### Step 3.2: Redeploy API (if needed)

Railway will automatically redeploy when you change environment variables.

Check the **Deployments** tab to monitor progress.

---

## ✅ Part 4: Verification

### Step 4.1: Check API Health

```bash
curl https://your-railway-api.up.railway.app/health
```

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected"
}
```

---

### Step 4.2: Check Frontend

Open your Vercel URL in a browser:

```
https://fantasy-football-ai.vercel.app
```

**Verify:**
- ✅ Page loads without errors
- ✅ Open browser console (F12) - no CORS errors
- ✅ Login page is accessible

---

### Step 4.3: Test the Full Flow

1. **Register a new user**
   - Navigate to `/register`
   - Create an account

2. **Login**
   - Use your credentials
   - Should redirect to dashboard

3. **Connect a Sleeper league**
   - Go to "Connect League"
   - Enter your Sleeper username
   - Select a league
   - Select your team

4. **View recommendations**
   - Check Trade Analyzer
   - Check Waiver Wire
   - Verify data loads

---

## 🎉 Success!

If all verification steps pass, your app is live!

**Your URLs:**
- Frontend: `https://fantasy-football-ai.vercel.app`
- API: `https://fantasy-football-api.up.railway.app`

---

## 📊 Next Steps

### Immediate
- [ ] Bookmark your production URLs
- [ ] Test all core features
- [ ] Monitor Railway logs for errors
- [ ] Check Vercel analytics

### Short Term
- [ ] Set up GitHub Actions secrets for CI/CD
- [ ] Configure custom domain (optional)
- [ ] Add error monitoring (Sentry)
- [ ] Set up uptime monitoring

### Long Term
- [ ] Invite beta testers
- [ ] Gather user feedback
- [ ] Plan feature improvements
- [ ] Scale infrastructure as needed

---

## 🔧 Troubleshooting

### CORS Errors

**Problem:** Browser shows CORS policy errors

**Solution:**
1. Verify `FRONTEND_URL` in Railway exactly matches Vercel URL
2. Must include `https://` and NO trailing slash
3. Redeploy API service in Railway

---

### Database Connection Failed

**Problem:** API can't connect to database

**Solution:**
1. Check Railway dashboard - is PostgreSQL running?
2. Verify `DATABASE_URL` is automatically set
3. Check API service logs in Railway

---

### Build Failures

**Problem:** Deployment fails during build

**Solution:**
1. Check Railway/Vercel deployment logs
2. Test build locally: `pnpm build`
3. Ensure all dependencies are in package.json

---

### Migrations Not Applied

**Problem:** Database schema doesn't match code

**Solution:**
```bash
# Check migration status
railway run pnpm --filter database migrate:status

# Apply migrations
railway run pnpm --filter database migrate:deploy
```

---

## 🆘 Need Help?

1. Check the logs:
   ```bash
   # Railway API logs
   railway logs

   # Vercel logs
   vercel logs https://fantasy-football-ai.vercel.app
   ```

2. Review comprehensive guides:
   - `DEPLOYMENT.md` - Full deployment guide
   - `ENV_SETUP.md` - Environment variables
   - `INFRASTRUCTURE.md` - Architecture details

3. Common issues section in `DEPLOYMENT.md`

---

## 📝 Checklist

Use this to track your progress:

### Railway
- [ ] Authenticated with Railway
- [ ] Created project
- [ ] Added PostgreSQL database
- [ ] Added Redis cache
- [ ] Configured environment variables
- [ ] Generated and set JWT_SECRET
- [ ] Deployed API service
- [ ] Generated domain
- [ ] Ran database migrations
- [ ] Verified health check

### Vercel
- [ ] Authenticated with Vercel
- [ ] Deployed to preview
- [ ] Deployed to production
- [ ] Added NEXT_PUBLIC_API_URL
- [ ] Redeployed with env var
- [ ] Verified site loads

### Integration
- [ ] Updated FRONTEND_URL in Railway
- [ ] Verified no CORS errors
- [ ] Tested user registration
- [ ] Tested league connection
- [ ] Tested trade analyzer
- [ ] Tested waiver wire

---

**Ready to deploy? Start with Step 1.1!**
