# Fantasy Football AI Assistant

An intelligent Fantasy Football management application providing data-driven trade recommendations, automated waiver wire optimization, and real-time injury monitoring with auto-substitution.

## Project Status

**Current Phase:** Foundation (MVP in progress)
**Target Launch:** August 2026

## Features (Planned)

- **Trade Analyzer**: Identify sell-high/buy-low opportunities with AI-powered recommendations
- **Waiver Wire Optimizer**: Optimal FAAB bid calculations and claim prioritization
- **Injury Monitoring**: Real-time alerts and auto-substitution suggestions
- **Opponent Learning**: Adaptive models that learn league-specific patterns

## Tech Stack

### Frontend
- Next.js 14 (React, TypeScript)
- Tailwind CSS
- Zustand (state management)

### Backend
- Fastify (Node.js, TypeScript)
- PostgreSQL 15
- Redis
- Prisma ORM

### Infrastructure
- Docker & Docker Compose
- pnpm workspaces (monorepo)

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd fantasy-football-ai-assistant
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create `.env` files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**Important:** Update `JWT_SECRET` in `apps/api/.env` to a secure random string.

### 4. Start Docker services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

Verify services are running:
```bash
docker-compose ps
```

### 5. Run database migrations

```bash
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema to database
```

### 6. Start development servers

```bash
pnpm dev
```

This will start:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001

### 7. Open the application

Navigate to http://localhost:3000 and create an account!

## Project Structure

```
fantasy-football-ai-assistant/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Fastify backend
├── packages/
│   ├── database/         # Prisma schema & client
│   └── shared/           # Shared TypeScript types
├── docker-compose.yml    # Docker services
└── pnpm-workspace.yaml   # Monorepo configuration
```

## Development Workflow

### Database Management

```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Push schema changes to database (dev)
pnpm db:push

# Create and run migrations (production-ready)
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio
```

### Running Tests

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```

### Building for Production

```bash
pnpm build
```

## API Documentation

### Authentication Endpoints

- `POST /auth/register` - Create new user account
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user (requires auth)

### League Endpoints

- `POST /leagues/connect` - Connect a Sleeper league
- `GET /leagues` - Get all connected leagues
- `GET /leagues/:id` - Get specific league details
- `POST /leagues/:id/sync` - Manually sync league data

## Connecting Your First League

1. Register an account at http://localhost:3000/register
2. Login and navigate to the dashboard
3. Click "Connect League"
4. Enter your Sleeper League ID (found in the Sleeper app URL)
5. Optionally enter your Sleeper User ID
6. Click "Connect League" to sync your data

## Environment Variables

### Backend (apps/api/.env)

- `PORT` - API server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret key for JWT tokens (must be secure in production)
- `SLEEPER_API_BASE_URL` - Sleeper API base URL
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend (apps/web/.env)

- `NEXT_PUBLIC_API_URL` - Backend API URL

## Troubleshooting

### Docker services won't start

```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Stop and remove containers
docker-compose down -v

# Restart
docker-compose up -d
```

### Database connection errors

```bash
# Verify PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Reconnect
pnpm db:push
```

### Frontend can't reach backend

- Verify API is running on port 3001
- Check `NEXT_PUBLIC_API_URL` in `apps/web/.env`
- Check CORS settings in `apps/api/src/server.ts`

## Contributing

This is currently a personal project. Contributions will be welcome once the MVP is complete.

## License

See LICENSE file for details.

## Roadmap

### Phase 1: Foundation (Current)
- [x] Monorepo setup
- [x] Docker infrastructure
- [x] Database schema
- [x] Authentication system
- [x] Sleeper API integration
- [x] Basic league sync
- [ ] Player projections sync
- [ ] Initial frontend polish

### Phase 2: Core Features
- [ ] Trade analyzer algorithm
- [ ] Waiver wire optimizer
- [ ] Opponent learning models
- [ ] Real-time injury monitoring

### Phase 3: Launch Prep
- [ ] Mobile app (React Native)
- [ ] ESPN API integration
- [ ] Performance optimization
- [ ] Security audit
- [ ] Beta testing

## Support

For questions or issues, please check:
- [PRD Documentation](./fantasy-football-ai-prd.md)
- [CLAUDE.md](./CLAUDE.md) for technical architecture

---

**Built with** ❤️ **for fantasy football managers**
