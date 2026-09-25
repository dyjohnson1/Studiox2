'use strict';
const express = require('express');
const auth = require('../auth');

const router = express.Router();

// GET /api/users - list admin users (no password hashes)
router.get('/', (req, res) => {
  res.json({ users: auth.listUsers() });
});

// POST /api/users - add a new admin user
router.post('/', (req, res) => {
  try {
    const user = auth.addUser(req.body.username, req.body.password);
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/users/:id/password - change a user's password
router.put('/:id/password', (req, res) => {
  try {
    auth.changePassword(req.params.id, req.body.password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/users/:id - remove a user
router.delete('/:id', (req, res) => {
  try {
    // Prevent deleting the currently logged-in account to avoid lockout confusion.
    if (req.session && req.session.userId === req.params.id) {
      return res
        .status(400)
        .json({ error: 'You cannot remove the account you are logged in as.' });
    }
    auth.removeUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
