'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { sanitizeHtml } = require('../sanitize');

const router = express.Router();
const FILE = 'writings.json';

const TYPES = ['essay', 'note', 'interview', 'catalogue'];

function load() {
  const data = store.readJSON(FILE, { writings: [] });
  if (!Array.isArray(data.writings)) return { writings: [] };
  return data;
}
function save(data) { store.writeJSON(FILE, data); }
function slugify(t) {
  return String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function nextOrder(items) {
  return items.length ? Math.max(...items.map((i) => i.order || 0)) + 1 : 1;
}
function uniqueSlug(base, items, excludeId) {
  let slug = base || 'writing';
  let n = 2;
  while (items.some((w) => w.slug === slug && w.id !== excludeId)) slug = `${base}-${n++}`;
  return slug;
}

function sanitize(body) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Title is required.');

  let type = String(body.type || '').trim().toLowerCase();
  if (!TYPES.includes(type)) {
    throw new Error(`type must be one of: ${TYPES.join(', ')}`);
  }

  const externalUrl = String(body.externalUrl || '').trim();
  if (externalUrl && !/^https?:\/\//i.test(externalUrl)) {
    throw new Error('External URL must start with http:// or https://');
  }

  const excerpt = String(body.excerpt || '').trim();
  const excerptWords = excerpt ? excerpt.split(/\s+/).length : 0;
  if (excerptWords > 20) {
    throw new Error('Excerpt must be 20 words or fewer.');
  }

  return {
    title,
    type,
    // date: free-form display string as shown on the site ("May 2026", "2025").
    date: String(body.date || '').trim(),
    // sortDate: optional ISO/parseable date used for ordering; falls back to date.
    sortDate: String(body.sortDate || body.date || '').trim(),
    excerpt,
    body: sanitizeHtml(body.body || ''),
    externalUrl: externalUrl || null,
  };
}

router.get('/', (req, res) => {
  const data = load();
  let writings = [...data.writings];
  if (req.query.type) writings = writings.filter((w) => w.type === req.query.type);
  writings.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ writings });
});

router.get('/:id', (req, res) => {
  const data = load();
  const found = data.writings.find((w) => w.id === req.params.id) ||
    data.writings.find((w) => w.slug === req.params.id);
  if (!found) return res.status(404).json({ error: 'Writing not found.' });
  res.json({ writing: found });
});

router.post('/', (req, res) => {
  try {
    const clean = sanitize(req.body);
    const data = load();
    const writing = {
      id: uuidv4(),
      slug: uniqueSlug(slugify(clean.title), data.writings, null),
      ...clean,
      order: nextOrder(data.writings),
      createdAt: new Date().toISOString(),
    };
    data.writings.push(writing);
    save(data);
    res.status(201).json({ writing });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const data = load();
    const found = data.writings.find((w) => w.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Writing not found.' });
    const clean = sanitize(req.body);
    Object.assign(found, clean, {
      slug: uniqueSlug(slugify(clean.title), data.writings, found.id),
      updatedAt: new Date().toISOString(),
    });
    if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
      const ord = parseInt(req.body.order, 10);
      if (!Number.isNaN(ord)) found.order = ord;
    }
    save(data);
    res.json({ writing: found });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.writings.findIndex((w) => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Writing not found.' });
  data.writings.splice(idx, 1);
  save(data);
  res.json({ ok: true });
});

module.exports = router;
module.exports.TYPES = TYPES;
