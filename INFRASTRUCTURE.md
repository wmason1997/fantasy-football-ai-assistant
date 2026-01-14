# Infrastructure Overview

Complete overview of the deployment infrastructure for the Fantasy Football AI Assistant.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐           ┌──────────────────────────────┐  │
│  │   Vercel     │◄─────────►│         Railway              │  │
│  │              │   HTTPS    │                              │  │
│  │  Next.js     │           │  ┌────────────────────────┐  │  │
│  │  Frontend    │           │  │   Node.js/Fastify      │  │  │
│  │              │           │  │   API Server           │  │  │
│  └──────────────┘           │  └─────────┬──────────────┘  │  │
│                             │            │                  │  │
│                             │  ┌─────────▼──────────────┐  │  │
│                             │  │   PostgreSQL 15+       │  │  │
│                             │  │   (TimescaleDB)        │  │  │
│                             │  └────────────────────────┘  │  │
│                             │                              │  │
│                             │  ┌────────────────────────┐  │  │
│                             │  │   Redis 7              │  │  │
│                             │  │   (Cache & Sessions)   │  │  │
│                             │  └────────────────────────┘  │  │
│                             └──────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         CI/CD PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GitHub Push → GitHub Actions → Test → Build → Deploy          │
│                                                                 │
│  - Automated testing (unit, integration, E2E)                  │
│  - Type checking and linting                                   │
│  - Automatic deployment on push to main                        │
│  - Database migration runner                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Configuration Files

### Frontend (Vercel)

| File | Purpose |
|------|---------|
| `apps/web/vercel.json` | Vercel project configuration |
| `apps/web/.env.example` | Environment variables template |

**Configuration Highlights:**
- ✅ Automatic Next.js detection
- ✅ Monorepo build configuration
- ✅ Environment variable management
- ✅ Zero-downtime deployments

### Backend API (Railway)

| File | Purpose |
|------|---------|
| `apps/api/Dockerfile` | Multi-stage Docker build |
| `apps/api/.dockerignore` | Docker build optimization |
| `apps/api/railway.json` | Railway service configuration |
| `apps/api/.env.example` | Environment variables template |

**Configuration Highlights:**
- ✅ Optimized multi-stage Docker build
- ✅ Health check endpoint integration
- ✅ Auto-restart on failure
- ✅ PostgreSQL & Redis plugin support

### Database

| File | Purpose |
|------|---------|
| `packages/database/scripts/migrate-production.sh` | Bash migration script |
| `packages/database/scripts/migrate-deploy.ts` | TypeScript migration script |
| `packages/database/package.json` | Updated with migration scripts |

**New Scripts:**
```json
{
  "migrate:deploy": "prisma migrate deploy",
  "migrate:status": "prisma migrate status",
  "migrate:production": "tsx scripts/migrate-deploy.ts"
}
```

---

## CI/CD Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:** Pull requests and pushes to `main`/`develop`

**Jobs:**
- ✅ Test & Lint
  - PostgreSQL service container
  - Redis service container
  - Unit tests with coverage
  - Integration tests
  - TypeScript type checking
  - ESLint linting
  - Frontend build verification

- ✅ E2E Tests
  - Full stack testing with Playwright
  - Real database and API server
  - Browser automation tests
  - Artifact upload for test reports

**Duration:** ~8-12 minutes

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers:** Push to `main` or manual dispatch

**Jobs:**
1. Deploy API to Railway
   - Build and deploy using Railway CLI
   - Run database migrations
2. Deploy Web to Vercel
   - Deploy frontend (waits for API)
   - Updates with latest API URL
3. Health Check
   - Verify API `/health` endpoint
   - Verify frontend loads successfully
   - Send deployment notification

**Duration:** ~5-8 minutes

### 3. Migration Workflow (`.github/workflows/migrate-db.yml`)

**Triggers:** Manual dispatch only

**Purpose:** Run database migrations on production

**Features:**
- Environment selection (production/staging)
- Safe migration deployment
- Status verification
- Manual approval required

**Duration:** ~2-3 minutes

---

## Environment Variables

### Required for Railway (Backend)

```bash
NODE_ENV=production               # Environment mode
PORT=3001                         # Server port
DATABASE_URL=<auto-provided>      # PostgreSQL connection
REDIS_URL=<auto-provided>         # Redis connection
JWT_SECRET=<generate-securely>    # JWT signing key
SLEEPER_API_BASE_URL=https://api.sleeper.app/v1
FRONTEND_URL=https://your-app.vercel.app
```

### Required for Vercel (Frontend)

```bash
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
NODE_ENV=production               # Auto-set by Vercel
```

### Required GitHub Secrets (CI/CD)

```bash
RAILWAY_TOKEN                     # Railway API token
VERCEL_TOKEN                      # Vercel API token
VERCEL_ORG_ID                     # Vercel organization ID
VERCEL_PROJECT_ID                 # Vercel project ID
API_URL                          # Production API URL
WEB_URL                          # Production web URL
```

---

## Documentation Files

| File | Description |
|------|-------------|
| `DEPLOYMENT.md` | **Complete** deployment guide (50+ sections) |
| `DEPLOYMENT_QUICK_START.md` | **15-minute** quick start checklist |
| `ENV_SETUP.md` | **Environment variables** reference guide |
| `INFRASTRUCTURE.md` | **This file** - architecture overview |

---

## Monitoring & Observability

### Built-in Monitoring

**Railway:**
- Real-time logs
- CPU/Memory metrics
- Network usage
- Deployment history
- Automatic PostgreSQL backups (daily)

**Vercel:**
- Web Vitals analytics
- Error tracking
- Edge network logs
- Performance insights
- Build/deployment logs

### Recommended Additions

For production, consider integrating:

1. **Sentry** - Error tracking
   - Captures exceptions in API and frontend
   - Source maps for debugging
   - Performance monitoring

2. **Datadog** - APM & Metrics
   - Database query performance
   - API response times
   - Custom business metrics

3. **UptimeRobot** - Uptime monitoring
   - 5-minute checks on `/health` endpoint
   - Email/SMS alerts on downtime
   - Status page for users

---

## Security Features

### Network Security
- ✅ HTTPS/TLS encryption (Railway & Vercel)
- ✅ CORS configured to specific domains
- ✅ Rate limiting on API endpoints
- ✅ Helmet.js security headers

### Authentication & Secrets
- ✅ JWT-based authentication
- ✅ bcrypt password hashing
- ✅ Secure JWT secret generation
- ✅ Environment variable encryption

### Database Security
- ✅ Connection pooling with Prisma
- ✅ SQL injection prevention (Prisma ORM)
- ✅ Encrypted at rest (Railway PostgreSQL)
- ✅ Daily automated backups

### API Security
- ✅ Input validation with Zod
- ✅ Rate limiting per IP
- ✅ Request timeout protection
- ✅ Error sanitization in production

---

## Scaling Strategy

### Current Setup (Free/Starter Tier)

| Resource | Limits | Good For |
|----------|--------|----------|
| Railway API | 500 hours/month | 1-50 concurrent users |
| PostgreSQL | 1GB storage | ~10,000 leagues |
| Redis | 100MB | 1,000 concurrent sessions |
| Vercel | 100GB bandwidth | ~10,000 page views/month |

### Growth Plan

**50-200 Users:**
- ✅ Current setup sufficient
- ✅ Monitor Railway usage
- ✅ Cost: $0-5/month

**200-1,000 Users:**
- Upgrade Railway to Pro ($10-20/month)
- Increase PostgreSQL storage
- Add Redis persistence
- Enable Vercel Analytics
- Cost: $30-50/month

**1,000-10,000 Users:**
- Migrate to dedicated servers
- Add read replicas for database
- Implement CDN for static assets
- Add load balancer
- Cost: $100-300/month

**10,000+ Users:**
- Kubernetes orchestration
- Multi-region deployment
- Dedicated Redis cluster
- Advanced caching strategy
- Cost: $500+/month

---

## Disaster Recovery

### Backup Strategy

**Database (PostgreSQL):**
- Automatic daily backups (Railway)
- 7-day retention (free tier)
- Manual backups before major migrations
- Export to S3 for long-term storage (optional)

**Application Code:**
- Git version control
- Tagged releases for production
- Rollback capability via Railway/Vercel

### Recovery Procedures

**API Service Failure:**
1. Check Railway logs for errors
2. Rollback to previous deployment
3. Verify health check passes
4. Monitor error rates

**Database Corruption:**
1. Restore from latest backup
2. Re-run migrations if needed
3. Verify data integrity
4. Test critical flows

**Complete Outage:**
1. Deploy new Railway project
2. Restore database from backup
3. Update Vercel environment variables
4. Run health checks
5. Update DNS if using custom domain

**Recovery Time Objective (RTO):** < 30 minutes
**Recovery Point Objective (RPO):** < 24 hours (daily backups)

---

## Cost Estimation

### Development (Free Tier)
- Railway: $5 credit/month (free)
- Vercel: Free tier
- **Total: $0/month**

### Production (Small)
- Railway Pro: $10-20/month
- Vercel Pro: $20/month
- **Total: $30-40/month**

### Production (Medium - 500 users)
- Railway: $50/month
- Vercel: $20/month
- Monitoring (Sentry): $26/month
- **Total: $96/month**

### Production (Large - 5,000 users)
- Railway: $150/month
- Vercel: $20/month
- Monitoring: $50/month
- CDN: $20/month
- **Total: $240/month**

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing locally
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup strategy confirmed
- [ ] Monitoring tools configured

### Initial Deployment
- [ ] Backend deployed to Railway
- [ ] PostgreSQL and Redis added
- [ ] Migrations run successfully
- [ ] Frontend deployed to Vercel
- [ ] Health checks passing
- [ ] CORS configured correctly

### Post-Deployment
- [ ] Test user registration/login
- [ ] Verify league connection works
- [ ] Check trade analyzer functionality
- [ ] Test waiver wire recommendations
- [ ] Monitor error logs (24 hours)
- [ ] Set up uptime monitoring
- [ ] Document any issues

### CI/CD Setup
- [ ] GitHub secrets configured
- [ ] CI workflow passing
- [ ] Deploy workflow tested
- [ ] Migration workflow tested
- [ ] Notifications configured

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | < 200ms | TBD |
| Page Load Time | < 2s | TBD |
| Database Query Time | < 50ms | TBD |
| API Uptime | > 99.5% | TBD |
| Error Rate | < 0.1% | TBD |

### Load Testing

Recommended tools:
- **Artillery** - API load testing
- **k6** - Modern load testing
- **Lighthouse** - Frontend performance

---

## Maintenance Schedule

### Daily
- Monitor error logs
- Check uptime status
- Review user feedback

### Weekly
- Review performance metrics
- Check database size
- Review security alerts
- Update dependencies (patch versions)

### Monthly
- Database backup verification
- Cost review and optimization
- Performance analysis
- Security audit
- Dependency updates (minor versions)

### Quarterly
- Major dependency updates
- Security penetration testing
- Disaster recovery drill
- Architecture review
- Capacity planning

---

## Support Contacts

### Services
- **Railway Support:** https://railway.app/help
- **Vercel Support:** https://vercel.com/support
- **GitHub Actions:** https://github.com/support

### Documentation
- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Prisma Migrations:** https://www.prisma.io/docs/guides/migrate
- **Next.js Deployment:** https://nextjs.org/docs/deployment

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-14 | 1.0.0 | Initial deployment infrastructure setup |

---

**Status:** ✅ Deployment infrastructure complete and production-ready

**Next Step:** Follow [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md) to deploy
