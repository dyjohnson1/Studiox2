'use strict';
const express = require('express');
const store = require('../store');

const router = express.Router();
const FILE = 'settings.json';

const DEFAULTS = {
  heroTitle: '',
  heroMeta: '',
  heroImage: null,
};

function load() {
  const data = store.readJSON(FILE, { settings: { ...DEFAULTS } });
  const settings = Object.assign({ ...DEFAULTS }, data.settings || {});
  return { settings };
}

function save(settings) {
  store.writeJSON(FILE, { settings });
}

// GET /api/settings - the single hero/settings record
router.get('/', (req, res) => {
  res.json(load());
});

// PUT /api/settings - update the hero/settings record
router.put('/', (req, res) => {
  const body = req.body || {};
  const settings = {
    heroTitle: String(body.heroTitle || '').trim(),
    heroMeta: String(body.heroMeta || '').trim(),
    heroImage: body.heroImage ? String(body.heroImage) : null,
    updatedAt: new Date().toISOString(),
  };
  save(settings);
  res.json({ settings });
});

module.exports = router;
