const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken')

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

// POST /api/notes (Create Op #2)
router.post('/', requireAuth, async (req, res) => {
  const { content, projectId } = req.body;
  const note = await prisma.note.create({
    data: { content, projectId }
  });
  res.send(note);
});

// PUT /api/notes/:id (Update Op #2)
router.put('/:id', requireAuth, async (req, res) => {
  const { content } = req.body;
  const note = await prisma.note.update({
    where: { id: req.params.id },
    data: { content }
  });
  res.send(note);
});

// DELETE /api/notes/:id (Delete Op #2)
router.delete('/:id', requireAuth, async (req, res) => {
  await prisma.note.delete({ where: { id: req.params.id } });
  res.send({ message: 'Deleted' });
});

module.exports = router;