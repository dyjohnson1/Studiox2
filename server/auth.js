'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('./store');

const USERS_FILE = 'users.json';
const SALT_ROUNDS = 10;

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'changeme';

function loadUsers() {
  const data = store.readJSON(USERS_FILE, { users: [] });
  if (!Array.isArray(data.users)) return { users: [] };
  return data;
}

function saveUsers(data) {
  store.writeJSON(USERS_FILE, data);
}

// Seed a default admin account if no users exist yet.
function seedDefaultAdmin() {
  const data = loadUsers();
  if (data.users.length === 0) {
    const hash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
    data.users.push({
      id: uuidv4(),
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    });
    saveUsers(data);
    console.log('\n[auth] No users found. Seeded default admin account:');
    console.log(`[auth]   username: ${DEFAULT_ADMIN_USERNAME}`);
    console.log(`[auth]   password: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('[auth]   >>> Change this password in Access Control after logging in. <<<\n');
  }
}

function findByUsername(username) {
  const data = loadUsers();
  return data.users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
}

function findById(id) {
  const data = loadUsers();
  return data.users.find((u) => u.id === id);
}

// Verify credentials. Returns the user (without hash) on success, else null.
function verifyCredentials(username, password) {
  const user = findByUsername(username);
  if (!user) return null;
  const ok = bcrypt.compareSync(String(password), user.passwordHash);
  if (!ok) return null;
  return { id: user.id, username: user.username };
}

function listUsers() {
  const data = loadUsers();
  return data.users.map((u) => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
  }));
}

function addUser(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!username || !password) {
    throw new Error('Username and password are required.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  if (findByUsername(username)) {
    throw new Error('A user with that username already exists.');
  }
  const data = loadUsers();
  const user = {
    id: uuidv4(),
    username,
    passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  saveUsers(data);
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function removeUser(id) {
  const data = loadUsers();
  if (data.users.length <= 1) {
    throw new Error('Cannot remove the last remaining admin user.');
  }
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx === -1) {
    throw new Error('User not found.');
  }
  data.users.splice(idx, 1);
  saveUsers(data);
  return true;
}

function changePassword(id, newPassword) {
  newPassword = String(newPassword || '');
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const data = loadUsers();
  const user = data.users.find((u) => u.id === id);
  if (!user) {
    throw new Error('User not found.');
  }
  user.passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  saveUsers(data);
  return true;
}

// Express middleware: require an authenticated session for protected routes.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // API requests get JSON 401; page requests get redirected to login.
  // Use originalUrl because req.path is relative to the router mount point.
  if ((req.originalUrl || req.url || '').startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.redirect('/admin/login.html');
}

module.exports = {
  seedDefaultAdmin,
  verifyCredentials,
  findById,
  listUsers,
  addUser,
  removeUser,
  changePassword,
  requireAuth,
};
