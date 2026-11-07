// Fills in missing search vectors for projects that already have a report.
// Usage (AI engine must be running): node scripts/backfill-embeddings.js
require('dotenv').config({ quiet: true });
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

(async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, title, report FROM "Project"
    WHERE embedding IS NULL AND report IS NOT NULL AND status IN ('Completed', 'Demo Mode')
  `;
  console.log(`Backfilling ${rows.length} project(s) using ${aiUrl}`);

  for (const p of rows) {
    try {
      const { data } = await axios.post(`${aiUrl}/create-vector`, { text: `${p.title}: ${p.report.substring(0, 500)}` }, { timeout: 30000 });
      const vectorString = `[${data.vector.join(',')}]`;
      await prisma.$executeRaw`UPDATE "Project" SET embedding = ${vectorString}::vector WHERE id = ${p.id}`;
      console.log(`  ok   ${p.title.substring(0, 60)}`);
    } catch (e) {
      console.error(`  fail ${p.title.substring(0, 60)}: ${e.message}`);
    }
  }
  await prisma.$disconnect();
})();
