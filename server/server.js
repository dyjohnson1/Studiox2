'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const store = require('./store');
const auth = require('./auth');
const seriesRoutes = require('./routes/series');
const worksRoutes = require('./routes/works');
const usersRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');
const exhibitionsRoutes = require('./routes/exhibitions');
const acquireRoutes = require('./routes/acquire');
const writingsRoutes = require('./routes/writings');

const ROOT = path.join(__dirname, '..'); // the flat static site lives at project root
const ADMIN_DIR = path.join(ROOT, 'admin');
const UPLOADS_DIR = store.UPLOADS_DIR;
const PORT = process.env.PORT || 3000;

// Make sure data/ and uploads/ exist and seed a default admin if needed.
store.ensureDirs();
auth.seedDefaultAdmin();

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'xhs.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ---------- Auth endpoints (public) ----------

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = auth.verifyCredentials(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true, user: { id: user.id, username: user.username } });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('xhs.sid');
    res.json({ ok: true });
  });
});

// GET /api/me - who am I (used by admin UI to check session)
app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: { id: req.session.userId, username: req.session.username },
    });
  }
  res.json({ authenticated: false });
});

// ---------- Public uploads (served read-only) ----------
app.use('/uploads', express.static(UPLOADS_DIR));

// ---------- Protected API routes ----------
app.use('/api/series', auth.requireAuth, seriesRoutes);
app.use('/api/works', auth.requireAuth, worksRoutes);
app.use('/api/users', auth.requireAuth, usersRoutes);
app.use('/api/upload', auth.requireAuth, uploadRoutes);
app.use('/api/settings', auth.requireAuth, settingsRoutes);
app.use('/api/exhibitions', auth.requireAuth, exhibitionsRoutes);
app.use('/api/acquire', auth.requireAuth, acquireRoutes);
app.use('/api/writings', auth.requireAuth, writingsRoutes);

// ---------- Public read-only API (for the live site) ----------
// The public archive fetches published content without auth.
app.get('/api/public/series', (req, res) => {
  const data = store.readJSON('series.json', { series: [] });
  const series = Array.isArray(data.series)
    ? [...data.series].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];
  res.json({ series });
});

app.get('/api/public/works', (req, res) => {
  const data = store.readJSON('works.json', { works: [] });
  let works = Array.isArray(data.works) ? [...data.works] : [];
  if (req.query.seriesId) {
    works = works.filter((w) => w.seriesId === req.query.seriesId);
  }
  works.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ works });
});

app.get('/api/public/settings', (req, res) => {
  const data = store.readJSON('settings.json', { settings: {} });
  res.json({ settings: data.settings || {} });
});

app.get('/api/public/exhibitions', (req, res) => {
  const data = store.readJSON('exhibitions.json', { exhibitions: [] });
  const exhibitions = Array.isArray(data.exhibitions)
    ? [...data.exhibitions].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];
  res.json({ exhibitions });
});

app.get('/api/public/acquire', (req, res) => {
  const data = store.readJSON('acquire.json', { items: [] });
  let items = Array.isArray(data.items) ? [...data.items] : [];
  if (req.query.category) items = items.filter((i) => i.category === req.query.category);
  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ items });
});

app.get('/api/public/writings', (req, res) => {
  const data = store.readJSON('writings.json', { writings: [] });
  let writings = Array.isArray(data.writings) ? [...data.writings] : [];
  if (req.query.type) writings = writings.filter((w) => w.type === req.query.type);
  writings.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ writings });
});

// Single public writing (by slug or id) — used by writing-detail.html.
app.get('/api/public/writings/:idOrSlug', (req, res) => {
  const data = store.readJSON('writings.json', { writings: [] });
  const list = Array.isArray(data.writings) ? data.writings : [];
  const key = req.params.idOrSlug;
  const found = list.find((w) => w.id === key) || list.find((w) => w.slug === key);
  if (!found) return res.status(404).json({ error: 'Writing not found.' });
  res.json({ writing: found });
});

// ---------- Admin UI (protected) ----------
// login.html must stay public; everything else under /admin needs a session.
app.get('/admin', (req, res) => res.redirect('/admin/dashboard.html'));

app.use('/admin', (req, res, next) => {
  const p = req.path;
  // Allow the login page and shared admin assets without a session.
  if (p === '/login.html' || p === '/' || p.startsWith('/assets/')) {
    return next();
  }
  return auth.requireAuth(req, res, next);
});
app.use('/admin', express.static(ADMIN_DIR));

// ---------- Public static site (project root) ----------
// Block sensitive project files/dirs from being served to the public.
const BLOCKED_PREFIXES = ['/server', '/data', '/node_modules', '/.vscode', '/.git'];
const BLOCKED_FILES = ['/package.json', '/package-lock.json', '/cms-plan.md', '/_parts.json'];
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    BLOCKED_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/')) ||
    BLOCKED_FILES.includes(p)
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

// Served last so it never shadows /api, /admin, or /uploads.
app.use(
  express.static(ROOT, {
    index: 'index.html',
    extensions: ['html'],
  })
);

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`\nXavier Haughton Studios CMS running:`);
  console.log(`  Public site: http://localhost:${PORT}`);
  console.log(`  Admin:       http://localhost:${PORT}/admin\n`);
});
