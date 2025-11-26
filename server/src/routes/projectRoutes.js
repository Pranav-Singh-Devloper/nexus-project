const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios'); // Import Axios

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ error: 'You must log in!' });
  }
  next();
};

// GET /api/projects - Fetch all projects for current user
// GET /api/projects - With Pagination, Search, and Sort
router.get('/', requireAuth, async (req, res) => {
  try {
    // 1. Extract Query Params (with defaults)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";
    const sort = req.query.sort || "desc"; // "desc" (newest) or "asc" (oldest)

    // 2. Calculate Pagination Offset
    const skip = (page - 1) * limit;

    // 3. Build the Query Object
    const whereClause = {
      userId: req.user.id,
      title: { contains: search, mode: 'insensitive' } // Searching feature
    };

    // 4. Run Two Queries (Transaction-like):
    //    A. Get the actual data
    //    B. Get the total count (for frontend pagination UI)
    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where: whereClause,
        orderBy: { createdAt: sort }, // Sorting feature
        skip: skip, // Pagination feature
        take: limit, // Pagination feature
      }),
      prisma.project.count({ where: whereClause })
    ]);

    // 5. Return structured response
    res.send({
      projects,
      pagination: {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Database error' });
  }
});

// POST /api/projects - Create a new project
router.post('/', requireAuth, async (req, res) => {
  const { title } = req.body;
  
  // Get the AI Service URL from environment variables
  const aiServiceUrl = process.env.AI_SERVICE_URL; 
  
  // 1. Validate inputs and ensure we have the necessary URL
  if (!title || !title.trim()) {
    return res.status(400).send({ error: 'Mission title is required.' });
  }
  if (!aiServiceUrl) {
    console.error("CRITICAL: AI_SERVICE_URL is missing from environment variables!");
  }

  try {
    // 2. Create the Project in the DB (Status: Initializing)
    const project = await prisma.project.create({
      data: {
        title,
        userId: req.user.id,
        status: 'Initializing...' // Status to be displayed immediately
      }
    });

    // 3. Send successful response to the Frontend immediately (200 OK)
    // This allows the Frontend to close the modal and refresh the list.
    res.send(project);
    
    // --- 4. FIRE AND FORGET: Call AI Service in the background ---
    // We use an immediately invoked async function (IIFE) so that the Node
    // server does NOT wait for the Python response.
    (async () => {
        try {
            console.log(`[AI-TASK] Triggering AI for Project ${project.id} at: ${aiServiceUrl}`);
            
            // This axios call might fail due to cold start or 502, but the user won't know yet.
            const aiResponse = await axios.post(`${aiServiceUrl}/start-research`, {
                prompt: title
            });

            // Update DB on Success
            await prisma.project.update({
                where: { id: project.id },
                data: {
                    status: 'Completed',
                    report: aiResponse.data.report
                }
            });
            console.log(`[AI-TASK] Success for Project ${project.id}.`);

        } catch (error) {
            // Update DB on Failure
            console.error(`[AI-TASK] FAILURE for Project ${project.id}:`, error.message);
            
            // Extract HTTP status if available for better logging
            const status = error.response ? `HTTP ${error.response.status}` : 'Connection Error';
            
            await prisma.project.update({
                where: { id: project.id },
                data: { 
                    status: 'Failed',
                    report: `Agent failed to start (${status}). The service may be asleep. Please try again in one minute.`
                }
            });
        }
    })();

  } catch (err) {
    // This catch block handles DB write failure ONLY.
    console.error("Database Error on Project Creation:", err);
    res.status(500).send({ error: 'Failed to save project to database.' });
  }
});



module.exports = router;