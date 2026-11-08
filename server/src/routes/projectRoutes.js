const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { embed, toPgVector } = require('../services/embeddings');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

// Middleware
const requireAuth = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).send({ error: 'You must log in!' });
  }

  try {
    const decoded = jwt.verify(token, process.env.COOKIE_KEY);
    req.user = decoded; // Attach user ID to request
    next();
  } catch (err) {
    return res.status(401).send({ error: 'Invalid token' });
  }
};

// --- 1. GET ALL PROJECTS (The Hybrid Search Masterpiece) ---
router.get('/', requireAuth, async (req, res) => {
  try {
    // Extract Query Params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const status = req.query.status || "All"; // 'All', 'Completed', etc.

    const offset = (page - 1) * limit;
    let projects = [];
    let totalCount = 0;

    // --- STRATEGY A: Standard Browsing (Prisma ORM) ---
    // Used when user is NOT searching. Supports date sorting & filtering.
    if (!search) {
      const whereClause = {
        userId: req.user.id,
      };

      // Apply Filter if not "All"
      if (status !== 'All') {
        whereClause.status = status;
      }

      projects = await prisma.project.findMany({
        where: whereClause,
        orderBy: { createdAt: sort }, // Sort by Date
        skip: offset,
        take: limit,
      });

      totalCount = await prisma.project.count({ where: whereClause });

    } else {
      // --- STRATEGY B: Hybrid Search (Raw SQL + Vectors) ---
      // Used when user types in search bar. Sorts by RELEVANCE (Similarity).
      
      let vectorQuery = null;

      // 1. Convert Search Text -> Vector
      try {
        vectorQuery = await embed(search);
      } catch (e) {
        console.error("Vector generation failed, falling back to keyword only:", e.message);
      }

      // 2. Build Raw SQL
      // We use a neat SQL trick: (param = 'All' OR status = param) to handle filtering logic inside SQL
      if (vectorQuery) {
        const vectorString = `[${vectorQuery.join(',')}]`;

        try {
          projects = await prisma.$queryRaw`
            SELECT id, title, status, report, "createdAt"
            FROM "Project"
            WHERE "userId" = ${req.user.id}
            AND (${status} = 'All' OR status = ${status})
            AND (
              title ILIKE ${`%${search}%`}
              OR
              embedding <=> ${vectorString}::vector < 0.5
            )
            ORDER BY (embedding <=> ${vectorString}::vector) ASC NULLS LAST
            LIMIT ${limit} OFFSET ${offset}
          `;

          const [{ count }] = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM "Project"
            WHERE "userId" = ${req.user.id}
            AND (${status} = 'All' OR status = ${status})
            AND (
              title ILIKE ${`%${search}%`}
              OR
              embedding <=> ${vectorString}::vector < 0.5
            )
          `;
          totalCount = count;
        } catch (e) {
          console.error("Vector search failed, falling back to keyword only:", e.message);
          vectorQuery = null;
        }
      }

      if (!vectorQuery) {
        // Keyword only (AI engine down or vector query failed)
        const keywordWhere = {
          userId: req.user.id,
          title: { contains: search, mode: 'insensitive' },
          ...(status !== 'All' && { status: status })
        };
        projects = await prisma.project.findMany({
          where: keywordWhere,
          orderBy: { createdAt: sort },
          take: limit,
          skip: offset
        });
        totalCount = await prisma.project.count({ where: keywordWhere });
      }
    }

    res.send({
      projects,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit) || 1
      }
    });

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).send({ error: 'Database search failed' });
  }
});

// --- 2. GET SINGLE PROJECT (Includes Notes) ---
router.get('/:id', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id, userId: req.user.id },
    include: { notes: { orderBy: { createdAt: 'desc' } } } // Fetch notes too
  });
  
  if (!project) return res.status(404).send({ error: 'Not found' });
  res.send(project);
});

// --- 3. CREATE PROJECT (Fire-and-Forget + Vector Write) ---
router.post('/', requireAuth, async (req, res) => {
  const { title } = req.body;
  const aiServiceUrl = process.env.AI_SERVICE_URL;

  if (!title || !title.trim()) return res.status(400).send({ error: 'Title required' });

  try {
    // A. Create Draft (Initial "Initializing" state)
    const project = await prisma.project.create({
      data: {
        title,
        userId: req.user.id,
        status: 'Initializing...'
      }
    });

    // B. Respond Fast to Frontend (Fire and Forget)
    res.send(project);

    // C. Background Task with RETRY LOGIC
    (async () => {
      if (!aiServiceUrl) {
        await prisma.project.update({
          where: { id: project.id },
          data: { status: 'Failed', report: 'AI service is not configured on the server (AI_SERVICE_URL is missing).' }
        });
        return;
      }

      const MAX_RETRIES = 3;
      let reportText = null;
      let aiStatus = null;
      let lastError = null;

      // 1. Generate Report (retried)
      for (let attempt = 1; attempt <= MAX_RETRIES && reportText === null; attempt++) {
        try {
          console.log(`[AI-TASK] Attempt ${attempt} for ${project.id}`);
          const aiResponse = await axios.post(`${aiServiceUrl}/start-research`, { prompt: title }, { timeout: 180000 });
          reportText = aiResponse.data.report || '';
          aiStatus = aiResponse.data.status;
        } catch (error) {
          lastError = error;
          console.error(`[AI-TASK] Failed Attempt ${attempt}:`, error.response?.data || error.message);
          if (attempt < MAX_RETRIES) {
            const delay = attempt * 2000; // 2s, 4s
            console.log(`[AI-TASK] Retrying in ${delay / 1000}s...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      try {
        if (reportText === null) {
          const status = lastError?.response?.status;
          const detail = lastError?.response?.data?.detail || lastError?.message || 'Unknown error';
          const isRateLimit = status === 429 || /exhausted|rate limit/i.test(String(detail));
          const reason = isRateLimit
            ?'The AI provider is rate limiting requests right now. Please try again in a few minutes.'
            : 'The AI engine could not complete this research.';
          await prisma.project.update({
            where: { id: project.id },
            data: { status: 'Failed', report: `${reason}\n\nError details: ${detail}` }
          });
          return;
        }

        // If AI says "demo_mode", we save 'Demo Mode'. Otherwise 'Completed'.
        const finalStatus = aiStatus === 'demo_mode' ? 'Demo Mode' : 'Completed';

        // 2. Save the report first so it is never lost
        await prisma.project.update({
          where: { id: project.id },
          data: { status: finalStatus, report: reportText }
        });

        // 3. Generate + store embedding for semantic search (optional; search falls back to keywords)
        try {
          const embedText = `${title}: ${reportText.substring(0, 500)}`;
          const vectorString = toPgVector(await embed(embedText, { timeout: 30000 }));
          await prisma.$executeRaw`
            UPDATE "Project" SET embedding = ${vectorString}::vector WHERE id = ${project.id}
          `;
        } catch (e) {
          console.error(`[AI-TASK] Embedding failed for ${project.id} (report kept):`, e.message);
        }

        console.log(`[AI-TASK] Finished ${project.id} with status: ${finalStatus}`);
      } catch (e) {
        console.error(`[AI-TASK] Could not save result for ${project.id}:`, e.message);
      }
    })();

  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Creation failed' });
  }
});

// --- 4. UPDATE PROJECT (Rename) ---
router.put('/:id', requireAuth, async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).send({ error: 'Title required' });
  try {
    const updated = await prisma.project.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { title }
    });
    res.send(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).send({ error: 'Not found' });
    res.status(500).send({ error: 'Update failed' });
  }
});

// --- 5. DELETE PROJECT ---
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.project.delete({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.send({ message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).send({ error: 'Not found' });
    res.status(500).send({ error: 'Delete failed' });
  }
});

module.exports = router;