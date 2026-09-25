'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'exhibitions.json';

const STATUSES = ['current', 'upcoming', 'past'];

function load() {
  const data = store.readJSON(FILE, { exhibitions: [] });
  if (!Array.isArray(data.exhibitions)) return { exhibitions: [] };
  return data;
}
function save(data) { store.writeJSON(FILE, data); }
function slugify(t) {
  return String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function nextOrder(items) {
  return items.length ? Math.max(...items.map((i) => i.order || 0)) + 1 : 1;
}

function deleteImageFiles(paths) {
  paths.forEach((p) => {
    try {
      if (!p) return;
      const disk = path.join(__dirname, '..', '..', p.replace(/^\/+/, ''));
      if (fs.existsSync(disk)) fs.unlinkSync(disk);
    } catch (e) { /* ignore */ }
  });
}

function sanitize(body) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required.');

  let year = null;
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    year = parseInt(body.year, 10);
    if (Number.isNaN(year)) throw new Error('Year must be a number.');
  }

  let status = String(body.status || '').trim().toLowerCase();
  if (status && !STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
  }

  return {
    title,
    venue: String(body.venue || '').trim(),
    location: String(body.location || '').trim(),
    dateLabel: String(body.dateLabel || '').trim(),
    year,
    status: status || 'past',
    image: body.image ? String(body.image) : null,
  };
}

router.get('/', (req, res) => {
  const data = load();
  const exhibitions = [...data.exhibitions].sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ exhibitions });
});

router.get('/:id', (req, res) => {
  const data = load();
  const found = data.exhibitions.find((e) => e.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Exhibition not found.' });
  res.json({ exhibition: found });
});

router.post('/', (req, res) => {
  try {
    const clean = sanitize(req.body);
    const data = load();
    const exhibition = {
      id: uuidv4(),
      slug: slugify(clean.title),
      ...clean,
      order: nextOrder(data.exhibitions),
      createdAt: new Date().toISOString(),
    };
    data.exhibitions.push(exhibition);
    save(data);
    res.status(201).json({ exhibition });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const data = load();
    const found = data.exhibitions.find((e) => e.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Exhibition not found.' });

    const oldImage = found.image;
    const clean = sanitize(req.body);
    Object.assign(found, clean, {
      slug: slugify(clean.title),
      updatedAt: new Date().toISOString(),
    });
    if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
      const ord = parseInt(req.body.order, 10);
      if (!Number.isNaN(ord)) found.order = ord;
    }
    save(data);
    if (oldImage && oldImage !== found.image) deleteImageFiles([oldImage]);
    res.json({ exhibition: found });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.exhibitions.findIndex((e) => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Exhibition not found.' });
  const removed = data.exhibitions.splice(idx, 1)[0];
  save(data);
  if (removed.image) deleteImageFiles([removed.image]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.STATUSES = STATUSES;
