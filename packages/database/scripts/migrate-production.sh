#!/bin/bash

# Production Database Migration Script
# Usage: ./migrate-production.sh [environment]
# Example: ./migrate-production.sh production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-production}

echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  Production Database Migration Runner     ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if environment is provided
if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified${NC}"
    echo "Usage: ./migrate-production.sh [environment]"
    echo "Example: ./migrate-production.sh production"
    exit 1
fi

echo -e "${GREEN}Environment:${NC} $ENVIRONMENT"
echo ""

# Confirmation prompt
echo -e "${YELLOW}⚠️  WARNING: You are about to run migrations on $ENVIRONMENT${NC}"
echo -e "${YELLOW}This will modify the database schema.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}Migration cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Starting migration process...${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL before running migrations."
    echo "Example: export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo -e "${GREEN}✓${NC} DATABASE_URL is set"
echo ""

# Check migration status
echo -e "${YELLOW}Checking migration status...${NC}"
npx prisma migrate status || true
echo ""

# Create backup warning
echo -e "${YELLOW}⚠️  IMPORTANT: Ensure you have a recent database backup!${NC}"
echo "Railway provides automatic daily backups."
echo "Manual backup recommended for major schema changes."
echo ""
read -p "Do you have a recent backup? (yes/no): " BACKUP_CONFIRM

if [ "$BACKUP_CONFIRM" != "yes" ]; then
    echo -e "${RED}Please create a backup before proceeding.${NC}"
    echo "Railway: Dashboard → Database → Backups → Create Backup"
    exit 0
fi

echo ""
echo -e "${GREEN}Running migrations...${NC}"
echo ""

# Run migrations
npx prisma migrate deploy

echo ""
echo -e "${GREEN}✓ Migrations completed successfully!${NC}"
echo ""

# Verify migration status
echo -e "${YELLOW}Verifying migration status...${NC}"
npx prisma migrate status

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Migration completed successfully!        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# Optional: Generate Prisma Client
read -p "Regenerate Prisma Client? (yes/no): " GENERATE_CONFIRM

if [ "$GENERATE_CONFIRM" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}Generating Prisma Client...${NC}"
    npx prisma generate
    echo -e "${GREEN}✓ Prisma Client generated${NC}"
fi

echo ""
echo -e "${GREEN}All done!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify application is working correctly"
echo "2. Monitor error logs for any issues"
echo "3. Test critical user flows"
echo ""
