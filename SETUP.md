# Setup Instructions - Fantasy Football AI Assistant

## ✅ Completed Steps

1. ✅ pnpm installed
2. ✅ Project dependencies installed
3. ✅ Environment files created
4. ✅ Prisma client generated

## 🔧 Remaining Steps

### 1. Install Docker Desktop

Docker is required to run PostgreSQL and Redis locally.

**Download and install Docker Desktop:**
- Visit: https://www.docker.com/products/docker-desktop
- Download for your platform (macOS/Windows/Linux)
- Install and start Docker Desktop
- Verify installation by running: `docker --version`

### 2. Start Docker Services

Once Docker is installed and running:

```bash
docker compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

Verify services are running:
```bash
docker compose ps
```

You should see both `fantasy-football-postgres` and `fantasy-football-redis` containers running.

### 3. Push Database Schema

Once PostgreSQL is running:

```bash
pnpm db:push
```

This creates all the tables in your database.

### 4. Start Development Servers

```bash
pnpm dev
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### 5. Test the Application

1. Open http://localhost:3000 in your browser
2. Click "Get Started" to register a new account
3. Fill in your email and password
4. You should be redirected to the dashboard

## 🐛 Troubleshooting

### Docker won't start
- Make sure Docker Desktop is running (check the icon in your system tray/menu bar)
- Try restarting Docker Desktop

### Port conflicts
If you get "port already in use" errors:

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # Frontend
lsof -i :3001  # API

# Stop existing containers if needed
docker compose down
```

### Database connection errors
```bash
# Check Docker logs
docker compose logs postgres

# Restart services
docker compose restart
```

### Frontend/Backend won't start
```bash
# Clear and reinstall
rm -rf node_modules
pnpm install
pnpm rebuild
```

## 📋 Quick Reference Commands

```bash
# Start everything
docker compose up -d
pnpm dev

# Stop Docker services
docker compose down

# View Docker logs
docker compose logs -f

# Restart a specific service
docker compose restart postgres

# Database commands
pnpm db:studio     # Open Prisma Studio (database GUI)
pnpm db:push       # Push schema changes
pnpm db:generate   # Regenerate Prisma client

# Development
pnpm dev           # Start all dev servers
pnpm build         # Build for production
pnpm lint          # Run linter
```

## 🎯 Next Steps After Setup

Once your app is running, you can:

1. **Connect a Sleeper League**
   - Click "Connect League" on the dashboard
   - Enter your Sleeper League ID
   - Your roster will be synced automatically

2. **Explore the Code**
   - Backend API: `apps/api/src/`
   - Frontend: `apps/web/app/`
   - Database schema: `packages/database/prisma/schema.prisma`

3. **Start Building Features**
   - Trade analyzer algorithm
   - Waiver wire optimizer
   - Player projections sync

---

**Need help?** Check the main [README.md](./README.md) or [PRD](./fantasy-football-ai-prd.md)
