#!/usr/bin/env tsx
import { db } from '@fantasy-football/database';

async function main() {
  // Count projections by week
  const projectionsByWeek = await db.playerProjection.groupBy({
    by: ['week', 'source'],
    where: {
      season: 2024,
    },
    _count: true,
  });

  console.log('\nProjections by week (2024 season):');
  projectionsByWeek
    .sort((a, b) => a.week - b.week)
    .forEach(p => {
      console.log(`  Week ${p.week} (${p.source}): ${p._count} projections`);
    });

  // Sample some projections for week 7
  const week7Projections = await db.playerProjection.findMany({
    where: {
      season: 2024,
      week: 7,
    },
    include: {
      player: {
        select: {
          fullName: true,
          position: true,
        },
      },
    },
    take: 10,
    orderBy: {
      projectedPoints: 'desc',
    },
  });

  console.log('\nTop 10 projections for week 7:');
  week7Projections.forEach(p => {
    console.log(`  ${p.player.fullName} (${p.player.position}): ${p.projectedPoints.toFixed(1)} pts`);
  });
}

main()
  .finally(() => db.$disconnect());
