const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireAuth } = require('../utils/session');

const STATUSES = ['draft', 'scheduled', 'published', 'failed'];
const EDITABLE = ['draft', 'failed'];

const listSelect = {
  id: true, html: true, imageUrl: true, imagePrompt: true, imageStyle: true, hashtags: true,
  status: true, provider: true, scheduledAt: true, publishedAt: true, postUrl: true, error: true,
  createdAt: true, updatedAt: true,
  project: { select: { id: true, title: true } },
};

// Only accept the fields the composer is allowed to change.
function pickDraftFields(body = {}) {
  const data = {};
  if (typeof body.html === 'string') data.html = body.html;
  if (body.imageUrl === null || typeof body.imageUrl === 'string') data.imageUrl = body.imageUrl;
  if (body.imagePrompt === null || typeof body.imagePrompt === 'string') data.imagePrompt = body.imagePrompt;
  if (body.imageStyle === null || typeof body.imageStyle === 'string') data.imageStyle = body.imageStyle;
  if (Array.isArray(body.hashtags)) data.hashtags = body.hashtags.filter(h => typeof h === 'string').slice(0, 10);
  return data;
}

const findOwned = (id, userId) => prisma.postDraft.findFirst({ where: { id, userId } });

// GET /api/drafts?status=draft|scheduled|published|failed|all
router.get('/', requireAuth, async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
  try {
    const [drafts, grouped] = await Promise.all([
      prisma.postDraft.findMany({
        where: { userId: req.userId, ...(status && { status }) },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: listSelect,
      }),
      prisma.postDraft.groupBy({ by: ['status'], where: { userId: req.userId }, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    grouped.forEach(g => { counts[g.status] = g._count._all; });
    counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ drafts, counts });
  } catch (err) {
    console.error('[Drafts] list failed:', err);
    res.status(500).json({ error: 'Failed to load drafts' });
  }
});

// GET /api/drafts/:id
router.get('/:id', requireAuth, async (req, res) => {
  const draft = await prisma.postDraft.findFirst({
    where: { id: req.params.id, userId: req.userId },
    select: listSelect,
  });
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  res.json(draft);
});

// POST /api/drafts — create a draft (optionally linked to a research project)
router.post('/', requireAuth, async (req, res) => {
  try {
    let projectId = null;
    if (req.body.projectId) {
      const project = await prisma.project.findFirst({ where: { id: req.body.projectId, userId: req.userId } });
      if (!project) return res.status(404).json({ error: 'Project not found' });
      projectId = project.id;
    }
    const draft = await prisma.postDraft.create({
      data: { ...pickDraftFields(req.body), projectId, userId: req.userId },
      select: listSelect,
    });
    res.status(201).json(draft);
  } catch (err) {
    console.error('[Drafts] create failed:', err);
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// PUT /api/drafts/:id — autosave from the composer
router.put('/:id', requireAuth, async (req, res) => {
  const draft = await findOwned(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (!EDITABLE.includes(draft.status)) {
    return res.status(409).json({ error: `This post is already ${draft.status}. Duplicate it to make changes.`, code: 'NOT_EDITABLE' });
  }
  const updated = await prisma.postDraft.update({
    where: { id: draft.id },
    data: pickDraftFields(req.body),
    select: listSelect,
  });
  res.json(updated);
});

// POST /api/drafts/:id/duplicate — copy any post into a new editable draft
router.post('/:id/duplicate', requireAuth, async (req, res) => {
  const draft = await findOwned(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  const copy = await prisma.postDraft.create({
    data: {
      html: draft.html, imageUrl: draft.imageUrl, imagePrompt: draft.imagePrompt,
      imageStyle: draft.imageStyle, hashtags: draft.hashtags, projectId: draft.projectId,
      userId: req.userId,
    },
    select: listSelect,
  });
  res.status(201).json(copy);
});

// POST /api/drafts/:id/unschedule — cancel a scheduled post and turn it back into a draft
router.post('/:id/unschedule', requireAuth, async (req, res) => {
  const draft = await findOwned(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  if (draft.status !== 'scheduled') return res.status(409).json({ error: 'This post is not scheduled.' });

  // Only pending jobs can be cancelled; one already being posted can't be stopped.
  const { count } = await prisma.scheduledPost.deleteMany({ where: { draftId: draft.id, status: 'pending' } });
  if (count === 0) return res.status(409).json({ error: 'This post is already being published.' });

  const updated = await prisma.postDraft.update({
    where: { id: draft.id },
    data: { status: 'draft', scheduledAt: null, provider: null, error: null },
    select: listSelect,
  });
  res.json(updated);
});

// DELETE /api/drafts/:id — removes it from Nexus only (never deletes a live LinkedIn/X post)
router.delete('/:id', requireAuth, async (req, res) => {
  const draft = await findOwned(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ error: 'Draft not found' });
  await prisma.$transaction([
    prisma.scheduledPost.deleteMany({ where: { draftId: draft.id, status: 'pending' } }),
    prisma.postDraft.delete({ where: { id: draft.id } }),
  ]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
