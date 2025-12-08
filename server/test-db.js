// server/test-db.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Turn on verbose logs
});

async function main() {
  console.log("Testing connection to:", process.env.DATABASE_URL);
  try {
    const users = await prisma.user.findMany();
    console.log("✅ Connection Successful! Found users:", users.length);
  } catch (e) {
    console.error("❌ Connection Failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();