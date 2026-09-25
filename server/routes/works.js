'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'works.json';

const MEDIUM_TYPES = ['painting', 'sculpture', 'works-on-paper'];
const COLLECTION_STATUSES = [
  'in private collection',
  'in exhibition',
  'available for purchase',
];

function load() {
  const data = store.readJSON(FILE, { works: [] });
  if (!Array.isArray(data.works)) return { works: [] };
  return data;
}

function save(data) {
  store.writeJSON(FILE, data);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nextOrder(items) {
  if (!items.length) return 1;
  return Math.max(...items.map((i) => i.order || 0)) + 1;
}

// Ensure a slug is unique across works (except for the work being edited).
function uniqueSlug(base, works, excludeId) {
  let slug = base || 'work';
  let n = 2;
  const taken = (s) => works.some((w) => w.slug === s && w.id !== excludeId);
  while (taken(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

// Normalize the images/media array: sort by order, ensure exactly one hero,
// support type 'image' | 'video', cap at 5. Backward compatible: items without
// a `type` are treated as images.
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  const cleaned = images
    .filter((img) => img && img.path)
    .map((img, i) => ({
      type: img.type === 'video' ? 'video' : 'image',
      path: String(img.path),
      order: typeof img.order === 'number' ? img.order : i + 1,
      isHero: !!img.isHero,
    }))
    .sort((a, b) => a.order - b.order)
    .map((img, i) => ({ ...img, order: i + 1 }));

  if (cleaned.length) {
    const heroIdx = cleaned.findIndex((img) => img.isHero);
    cleaned.forEach((img, i) => {
      img.isHero = i === (heroIdx === -1 ? 0 : heroIdx);
    });
  }
  return cleaned.slice(0, 5); // max 5 media items
}

function sanitize(body) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required.');

  let year = null;
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    year = parseInt(body.year, 10);
    if (Number.isNaN(year)) throw new Error('Year must be a number.');
  }

  let materials = [];
  if (Array.isArray(body.materials)) {
    materials = body.materials.map((m) => String(m).trim()).filter(Boolean);
  } else if (typeof body.materials === 'string' && body.materials.trim()) {
    materials = body.materials.split(',').map((m) => m.trim()).filter(Boolean);
  }

  const dims = body.dimensions || {};
  const parseDim = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  };
  const dimensions = {
    height: parseDim(dims.height),
    width: parseDim(dims.width),
    depth: parseDim(dims.depth),
  };

  let mediumType = String(body.mediumType || '').trim().toLowerCase();
  if (mediumType && !MEDIUM_TYPES.includes(mediumType)) {
    throw new Error(`mediumType must be one of: ${MEDIUM_TYPES.join(', ')}`);
  }

  let collectionStatus = String(body.collectionStatus || '').trim().toLowerCase();
  if (collectionStatus && !COLLECTION_STATUSES.includes(collectionStatus)) {
    throw new Error(
      `collectionStatus must be one of: ${COLLECTION_STATUSES.join(', ')}`
    );
  }

  const description = String(body.description || '').trim();
  if (description.length > 500) {
    throw new Error('Description must be 500 characters or fewer.');
  }

  return {
    title,
    seriesId: body.seriesId ? String(body.seriesId) : null,
    materials,
    year,
    dimensions,
    description,
    collectionStatus: collectionStatus || null,
    mediumType: mediumType || null,
    images: normalizeImages(body.images),
  };
}

// Delete image files that are no longer referenced by a work.
function deleteImageFiles(paths) {
  paths.forEach((p) => {
    try {
      // p is like /uploads/works/xyz.jpg -> resolve to disk path
      const rel = p.replace(/^\/+/, '');
      const disk = path.join(__dirname, '..', '..', rel);
      if (fs.existsSync(disk)) fs.unlinkSync(disk);
    } catch (err) {
      console.error('[works] Failed to delete image', p, err.message);
    }
  });
}

// GET /api/works - list all works (optionally ?seriesId=)
router.get('/', (req, res) => {
  const data = load();
  let works = [...data.works];
  if (req.query.seriesId) {
    works = works.filter((w) => w.seriesId === req.query.seriesId);
  }
  works.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ works });
});

// GET /api/works/:id
router.get('/:id', (req, res) => {
  const data = load();
  const found =
    data.works.find((w) => w.id === req.params.id) ||
    data.works.find((w) => w.slug === req.params.id);
  if (!found) return res.status(404).json({ error: 'Work not found.' });
  res.json({ work: found });
});

// POST /api/works - create
router.post('/', (req, res) => {
  try {
    const clean = sanitize(req.body);
    const data = load();
    const work = {
      id: uuidv4(),
      slug: uniqueSlug(slugify(clean.title), data.works, null),
      ...clean,
      order: nextOrder(data.works),
      createdAt: new Date().toISOString(),
    };
    data.works.push(work);
    save(data);
    res.status(201).json({ work });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/works/:id - update
router.put('/:id', (req, res) => {
  try {
    const data = load();
    const found = data.works.find((w) => w.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Work not found.' });

    const clean = sanitize(req.body);

    // Determine which image files were removed so we can clean them up.
    const oldPaths = (found.images || []).map((i) => i.path);
    const newPaths = clean.images.map((i) => i.path);
    const removed = oldPaths.filter((p) => !newPaths.includes(p));

    found.title = clean.title;
    found.slug = uniqueSlug(slugify(clean.title), data.works, found.id);
    found.seriesId = clean.seriesId;
    found.materials = clean.materials;
    found.year = clean.year;
    found.dimensions = clean.dimensions;
    found.description = clean.description;
    found.collectionStatus = clean.collectionStatus;
    found.mediumType = clean.mediumType;
    found.images = clean.images;
    if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
      const ord = parseInt(req.body.order, 10);
      if (!Number.isNaN(ord)) found.order = ord;
    }
    found.updatedAt = new Date().toISOString();
    save(data);

    if (removed.length) deleteImageFiles(removed);

    res.json({ work: found });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/works/:id
router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.works.findIndex((w) => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Work not found.' });

  const removedWork = data.works[idx];
  data.works.splice(idx, 1);
  save(data);

  const paths = (removedWork.images || []).map((i) => i.path);
  if (paths.length) deleteImageFiles(paths);

  res.json({ ok: true });
});

module.exports = router;
module.exports.MEDIUM_TYPES = MEDIUM_TYPES;
module.exports.COLLECTION_STATUSES = COLLECTION_STATUSES;
