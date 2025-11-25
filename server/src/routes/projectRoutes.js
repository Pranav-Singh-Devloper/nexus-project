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
  
  try {
    // 1. Create "Draft" Project in DB
    const project = await prisma.project.create({
      data: {
        title,
        userId: req.user.id,
        status: 'Processing...' // Set status to processing
      }
    });

    // 2. Trigger AI (Fire and Forget or Await?)
    // For this version, we will AWAIT it so the user sees the result immediately.
    // In a production app, we would use a background queue (BullMQ).
    
    try {
      // Call Python Microservice
      const aiResponse = await axios.post('http://localhost:8000/start-research', {
        prompt: title
      });

      // 3. Update DB with the Report
      const updatedProject = await prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'Completed',
          report: aiResponse.data.report
        }
      });

      res.send(updatedProject);

    } catch (aiError) {
      console.error("AI Service Error:", aiError.message);
      // Even if AI fails, return the project but mark as failed
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'Failed' }
      });
      res.status(500).send({ error: "AI Service failed to generate report" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to create project' });
  }
});



module.exports = router;