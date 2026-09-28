'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();
const FILE = 'exhibitions.json';

const STATUSES = ['current', 'upcoming', 'past'];
const MAX_MEDIA = 15;

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

  let year = null;
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    year = parseInt(body.year, 10);
    if (Number.isNaN(year)) throw new Error('Year must be a number.');
  }

  let status = String(body.status || '').trim().toLowerCase();
  if (status && !STATUSES.includes(status)) {
    throw new Error(`status must be one of: ${STATUSES.join(', ')}`);
  }

  // Media: prefer body.media[]; fall back to single body.image for compatibility.
  let media = normalizeMedia(body.media);
  if (!media.length && body.image) {
    media = normalizeMedia([{ type: 'image', path: body.image, order: 1, isHero: true }]);
  }

  return {
    title,
    venue: String(body.venue || '').trim(),
    location: String(body.location || '').trim(),
    dateLabel: String(body.dateLabel || '').trim(),
    year,
    status: status || 'past',
    media,
    // Single `image` mirror (hero) for older consumers.
    image: media.length ? (media.find((m) => m.isHero) || media[0]).path : null,
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
  const paths = (removed.media || []).map((m) => m.path);
  if (removed.image && !paths.includes(removed.image)) paths.push(removed.image);
  if (paths.length) deleteImageFiles(paths);
  res.json({ ok: true });
});

module.exports = router;
module.exports.STATUSES = STATUSES;
