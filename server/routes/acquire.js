'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'acquire.json';

const CATEGORIES = ['original', 'edition'];
// Status options: originals are typically inquiry-only or in-collection;
// editions are available or sold out. We allow all four across both.
const STATUSES = ['available', 'inquire', 'in collection', 'sold out'];

function load() {
  const data = store.readJSON(FILE, { items: [] });
  if (!Array.isArray(data.items)) return { items: [] };
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

  let category = String(body.category || '').trim().toLowerCase();
  if (!CATEGORIES.includes(category)) {
    throw new Error(`category must be one of: ${CATEGORIES.join(', ')}`);
  }

  let status = String(body.status || '').trim().toLowerCase();
  if (status && !STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
  }

  return {
    title,
    // "details" is the descriptive line: e.g. "Oil on linen · 60 × 48 in · 2025"
    // or "Archival pigment print · Edition of 25".
    details: String(body.details || '').trim(),
    category,
    price: String(body.price || '').trim(), // free-form, e.g. "$650"; blank for originals
    status: status || (category === 'original' ? 'inquire' : 'available'),
    image: body.image ? String(body.image) : null,
  };
}

router.get('/', (req, res) => {
  const data = load();
  let items = [...data.items];
  if (req.query.category) items = items.filter((i) => i.category === req.query.category);
  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ items });
});

router.get('/:id', (req, res) => {
  const data = load();
  const found = data.items.find((i) => i.id === req.params.id) ||
    data.items.find((i) => i.slug === req.params.id);
  if (!found) return res.status(404).json({ error: 'Item not found.' });
  res.json({ item: found });
});

router.post('/', (req, res) => {
  try {
    const clean = sanitize(req.body);
    const data = load();
    const item = {
      id: uuidv4(),
      slug: slugify(clean.title),
      ...clean,
      order: nextOrder(data.items),
      createdAt: new Date().toISOString(),
    };
    data.items.push(item);
    save(data);
    res.status(201).json({ item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const data = load();
    const found = data.items.find((i) => i.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Item not found.' });
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
    res.json({ item: found });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found.' });
  const removed = data.items.splice(idx, 1)[0];
  save(data);
  if (removed.image) deleteImageFiles([removed.image]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
