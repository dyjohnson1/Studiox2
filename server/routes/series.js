'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'series.json';

function load() {
  const data = store.readJSON(FILE, { series: [] });
  if (!Array.isArray(data.series)) return { series: [] };
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

// Normalize + validate incoming series payload.
function sanitize(body) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required.');

  let year = null;
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    year = parseInt(body.year, 10);
    if (Number.isNaN(year)) throw new Error('Year must be a number.');
  }

  return {
    title,
    description: String(body.description || '').trim(),
    year,
    heroImage: body.heroImage ? String(body.heroImage) : null,
  };
}

// GET /api/series - list all series (ordered)
router.get('/', (req, res) => {
  const data = load();
  const series = [...data.series].sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ series });
});

// GET /api/series/:id - single series
router.get('/:id', (req, res) => {
  const data = load();
  const found = data.series.find((s) => s.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Series not found.' });
  res.json({ series: found });
});

// POST /api/series - create
router.post('/', (req, res) => {
  try {
    const clean = sanitize(req.body);
    const data = load();
    const series = {
      id: uuidv4(),
      slug: slugify(clean.title),
      title: clean.title,
      description: clean.description,
      year: clean.year,
      heroImage: clean.heroImage,
      order: nextOrder(data.series),
      createdAt: new Date().toISOString(),
    };
    data.series.push(series);
    save(data);
    res.status(201).json({ series });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/series/:id - update
router.put('/:id', (req, res) => {
  try {
    const data = load();
    const found = data.series.find((s) => s.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Series not found.' });

    const clean = sanitize(req.body);
    found.title = clean.title;
    found.slug = slugify(clean.title);
    found.description = clean.description;
    found.year = clean.year;
    found.heroImage = clean.heroImage;
    if (body_has(req.body, 'order')) {
      const ord = parseInt(req.body.order, 10);
      if (!Number.isNaN(ord)) found.order = ord;
    }
    found.updatedAt = new Date().toISOString();
    save(data);
    res.json({ series: found });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/series/:id - remove series (works keep their seriesId but will be treated as solo)
router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.series.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Series not found.' });

  // Detach works from the deleted series.
  const worksData = store.readJSON('works.json', { works: [] });
  if (Array.isArray(worksData.works)) {
    let changed = false;
    worksData.works.forEach((w) => {
      if (w.seriesId === req.params.id) {
        w.seriesId = null;
        changed = true;
      }
    });
    if (changed) store.writeJSON('works.json', worksData);
  }

  data.series.splice(idx, 1);
  save(data);
  res.json({ ok: true });
});

function body_has(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

module.exports = router;
