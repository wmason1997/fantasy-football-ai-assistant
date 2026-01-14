# Environment Variables Setup Guide

This guide explains how to configure environment variables for development and production deployments.

## Overview

The application requires environment variables in two places:
1. **Backend API** (`apps/api`) - Node.js/Fastify server
2. **Frontend Web** (`apps/web`) - Next.js application

---

## Backend API Environment Variables

### Development (.env)

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/fantasy_football

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Sleeper API
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1

# CORS
FRONTEND_URL=http://localhost:3000
```

### Production (Railway)

When deploying to Railway, configure these environment variables in the Railway dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `3001` | Or use Railway's `$PORT` variable |
| `DATABASE_URL` | Auto-provided | Railway PostgreSQL plugin provides this |
| `REDIS_URL` | Auto-provided | Railway Redis plugin provides this |
| `JWT_SECRET` | **Generate securely** | Run: `openssl rand -base64 32` |
| `SLEEPER_API_BASE_URL` | `https://api.sleeper.app/v1` | Required |
| `FRONTEND_URL` | Your Vercel URL | e.g., `https://fantasy-football-ai.vercel.app` |

**Important Security Notes:**
- ✅ **Always generate a new `JWT_SECRET` for production** using `openssl rand -base64 32`
- ✅ **Never commit `.env` files** to version control
- ✅ **Set `FRONTEND_URL` to your actual Vercel deployment URL** for CORS

---

## Frontend Web Environment Variables

### Development (.env.local)

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

### Production (Vercel)

Configure these in the Vercel dashboard under Project Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway API URL | e.g., `https://fantasy-football-api.up.railway.app` |
| `NODE_ENV` | `production` | Auto-set by Vercel |

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser and bundled at build time.

---

## Quick Setup Checklist

### Railway (Backend API)

1. **Create a new Railway project**
2. **Add PostgreSQL plugin** - Provides `DATABASE_URL` automatically
3. **Add Redis plugin** - Provides `REDIS_URL` automatically
4. **Set custom environment variables:**
   ```bash
   NODE_ENV=production
   JWT_SECRET=<generated-secret>
   SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. **Deploy from GitHub** - Connect your repository
6. **Run database migrations** - See Database Migrations section below

### Vercel (Frontend)

1. **Import project from GitHub**
2. **Set Root Directory** to `apps/web`
3. **Configure environment variables:**
   ```bash
   NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
   ```
4. **Deploy**

---

## Database Migrations

### Development

Run migrations locally:
```bash
pnpm db:migrate
```

### Production (Railway)

Railway will automatically run migrations on deployment if you add a build script. Add this to `apps/api/package.json`:

```json
"scripts": {
  "build": "prisma migrate deploy && tsc",
  ...
}
```

Or run manually via Railway CLI:
```bash
railway run pnpm --filter database migrate deploy
```

---

## Generating Secrets

### JWT Secret
```bash
openssl rand -base64 32
```

### Strong Password
```bash
openssl rand -base64 16
```

---

## Verification

### Backend API Health Check
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

### Frontend
Visit `https://your-app.vercel.app` and verify:
- ✅ Login page loads
- ✅ API calls work (check browser console)
- ✅ No CORS errors

---

## Common Issues

### CORS Errors
**Problem:** Browser shows CORS policy errors
**Solution:** Ensure `FRONTEND_URL` in Railway matches your Vercel deployment URL exactly (including https://)

### Database Connection Errors
**Problem:** API can't connect to database
**Solution:** Verify Railway PostgreSQL plugin is installed and `DATABASE_URL` is set

### Redis Connection Errors
**Problem:** Cache/session errors
**Solution:** Verify Railway Redis plugin is installed and `REDIS_URL` is set

### Build Failures
**Problem:** TypeScript or build errors on deployment
**Solution:** Run `pnpm build` locally first to catch errors early

---

## Environment-Specific Behavior

| Feature | Development | Production |
|---------|-------------|------------|
| Hot Reload | ✅ Enabled | ❌ Disabled |
| Source Maps | ✅ Full | ⚠️ Limited |
| Error Stack Traces | ✅ Full | ⚠️ Sanitized |
| Logging | Verbose | Minimal |
| CORS | Localhost only | Configured domain |

---

## Security Best Practices

1. ✅ **Never commit secrets** - Use `.env.local` for development
2. ✅ **Rotate JWT secrets** - Change every 90 days
3. ✅ **Use HTTPS only** - Both Vercel and Railway provide SSL automatically
4. ✅ **Restrict CORS** - Only allow your Vercel domain
5. ✅ **Enable rate limiting** - Already configured in the API
6. ✅ **Monitor logs** - Use Railway logs and Vercel analytics

---

## Next Steps

After configuring environment variables:
1. Deploy the backend API to Railway
2. Deploy the frontend to Vercel
3. Test the full application flow
4. Set up monitoring (see DEPLOYMENT.md)
5. Configure CI/CD pipeline (see .github/workflows)
