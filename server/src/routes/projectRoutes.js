const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
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
    const sort = req.query.sort || "desc"; // 'asc' or 'desc'
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
      
      const aiServiceUrl = process.env.AI_SERVICE_URL;
      let vectorQuery = null;

      // 1. Convert Search Text -> Vector
      try {
        if (aiServiceUrl) {
          const vectorRes = await axios.post(`${aiServiceUrl}/create-vector`, { text: search });
          vectorQuery = vectorRes.data.vector;
        }
      } catch (e) {
        console.error("Vector generation failed, falling back to keyword only");
      }

      // 2. Build Raw SQL
      // We use a neat SQL trick: (param = 'All' OR status = param) to handle filtering logic inside SQL
      if (vectorQuery) {
        const vectorString = `[${vectorQuery.join(',')}]`;
        
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
          ORDER BY (embedding <=> ${vectorString}::vector) ASC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        // Note: Exact count for hybrid is complex, we use a placeholder or separate query
        // For a resume demo, setting it to '10' or length ensures pagination doesn't break
        totalCount = projects.length < limit ? projects.length : 100; 

      } else {
        // Fallback: Keyword Only (if Python is down)
        projects = await prisma.project.findMany({
          where: {
            userId: req.user.id,
            title: { contains: search, mode: 'insensitive' },
            ...(status !== 'All' && { status: status })
          },
          take: limit,
          skip: offset
        });
        totalCount = projects.length; // Approximate
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
  // EXTRACT DATA
  const { report: reportText, status: aiStatus } = aiResponse.data;

  // DETERMINE FINAL DB STATUS
  // If AI says "demo_mode", we save 'Demo Mode'. Otherwise 'Completed'.
  const finalStatus = aiStatus === 'demo_mode' ? 'Demo Mode' : 'Completed';

  if (!title) return res.status(400).send({ error: 'Title required' });

  try {
    // A. Create Draft
    const project = await prisma.project.create({
      data: {
        title,
        userId: req.user.id,
        status: 'Initializing...'
      }
    });

    // B. Respond Fast
    res.send(project);

// C. Background Task with RETRY LOGIC
    (async () => {
      if (!aiServiceUrl) return;
      
      const MAX_RETRIES = 3;
      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        try {
          attempt++;
          console.log(`[AI-TASK] Attempt ${attempt} for ${project.id}`);

          // 1. Generate Report
          const aiResponse = await axios.post(`${aiServiceUrl}/start-research`, { prompt: title });
          const reportText = aiResponse.data.report;

          // 2. Generate Embedding
          const embedText = `${title}: ${reportText.substring(0, 500)}`;
          const vectorRes = await axios.post(`${aiServiceUrl}/create-vector`, { text: embedText });
          const vectorString = `[${vectorRes.data.vector.join(',')}]`;

          // 3. Save to DB
          await prisma.$executeRaw`
            UPDATE "Project"
            SET status = ${finalStatus},
                report = ${reportText},
                embedding = ${vectorString}::vector
            WHERE id = ${project.id}
          `;
          
          console.log(`[AI-TASK] Finished ${project.id}`);
          success = true; // Exit loop

        } catch (error) {
          console.error(`[AI-TASK] Failed Attempt ${attempt}:`, error.message);
          
          // If it's a 429 (Rate Limit) or 500, wait and retry
          if (attempt < MAX_RETRIES) {
             const delay = attempt * 2000; // Wait 2s, then 4s, then 6s
             console.log(`[AI-TASK] Retrying in ${delay/1000}s...`);
             await new Promise(res => setTimeout(res, delay));
          } else {
            // Final Failure after all retries
            await prisma.project.update({
              where: { id: project.id },
              data: { 
                status: 'Failed',
                report: `System is currently experiencing high traffic (Rate Limit). Please try again later.\n\nError details: ${error.message}`
              }
            });
          }
        }
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
  try {
    const updated = await prisma.project.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { title }
    });
    res.send(updated);
  } catch (err) {
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
    res.status(500).send({ error: 'Delete failed' });
  }
});

module.exports = router;