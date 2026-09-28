'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'acquire.json';

const CATEGORIES = ['original', 'edition'];
// Status options. Originals are typically inquiry-only; editions available/sold out.
const STATUSES = ['available', 'inquire', 'sold out'];
const MEDIUM_TYPES = ['painting', 'sculpture', 'works-on-paper'];
const MAX_MEDIA = 5;

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

// Normalize a media array of {type,path,order,isHero}, one hero, cap at MAX_MEDIA.
function normalizeMedia(media) {
  if (!Array.isArray(media)) return [];
  const cleaned = media
    .filter((m) => m && m.path)
    .map((m, i) => ({
      type: m.type === 'video' ? 'video' : 'image',
      path: String(m.path),
      order: typeof m.order === 'number' ? m.order : i + 1,
      isHero: !!m.isHero,
    }))
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({ ...m, order: i + 1 }));
  if (cleaned.length) {
    const heroIdx = cleaned.findIndex((m) => m.isHero);
    cleaned.forEach((m, i) => { m.isHero = i === (heroIdx === -1 ? 0 : heroIdx); });
  }
  return cleaned.slice(0, MAX_MEDIA);
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

  let mediumType = String(body.mediumType || '').trim().toLowerCase();
  if (mediumType && !MEDIUM_TYPES.includes(mediumType)) {
    throw new Error(`mediumType must be one of: ${MEDIUM_TYPES.join(', ')}`);
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

  // Media: prefer body.media[]; fall back to single body.image for compatibility.
  let media = normalizeMedia(body.media);
  if (!media.length && body.image) {
    media = normalizeMedia([{ type: 'image', path: body.image, order: 1, isHero: true }]);
  }

  return {
    title,
    // "details" is an optional descriptive line.
    details: String(body.details || '').trim(),
    category,
    price: String(body.price || '').trim(),
    status: status || (category === 'original' ? 'inquire' : 'available'),
    materials,
    mediumType: mediumType || null,
    dimensions,
    media,
    // Keep a single `image` mirror (hero) for older consumers.
    image: media.length ? (media.find((m) => m.isHero) || media[0]).path : null,
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
    const oldPaths = (found.media || []).map((m) => m.path);
    if (found.image && !oldPaths.includes(found.image)) oldPaths.push(found.image);
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
    const newPaths = (found.media || []).map((m) => m.path);
    const removed = oldPaths.filter((p) => p && !newPaths.includes(p));
    if (removed.length) deleteImageFiles(removed);
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
  const paths = (removed.media || []).map((m) => m.path);
  if (removed.image && !paths.includes(removed.image)) paths.push(removed.image);
  if (paths.length) deleteImageFiles(paths);
  res.json({ ok: true });
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES = STATUSES;
module.exports.MEDIUM_TYPES = MEDIUM_TYPES;
