// Fills in search vectors for projects that already have a report.
// Usage: node scripts/backfill-embeddings.js          (only missing vectors)
//        node scripts/backfill-embeddings.js --all    (recompute all, e.g. after switching provider)
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { embed, toPgVector, provider } = require('../src/services/embeddings');

const prisma = new PrismaClient();
const all = process.argv.includes('--all');

(async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, title, report FROM "Project"
    WHERE (embedding IS NULL OR ${all}) AND report IS NOT NULL AND status IN ('Completed', 'Demo Mode')
  `;
  console.log(`Backfilling ${rows.length} project(s) using ${provider()}`);

  for (const p of rows) {
    try {
      const vectorString = toPgVector(await embed(`${p.title}: ${p.report.substring(0, 500)}`, { timeout: 30000 }));
      await prisma.$executeRaw`UPDATE "Project" SET embedding = ${vectorString}::vector WHERE id = ${p.id}`;
      console.log(`  ok   ${p.title.substring(0, 60)}`);
    } catch (e) {
      console.error(`  fail ${p.title.substring(0, 60)}: ${e.message}`);
    }
  }
  await prisma.$disconnect();
})();
