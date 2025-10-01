const express = require('express');
const router = express.Router();
const { readQueue } = require('./queueUtils'); // adjust path as needed

// Middleware for token-based auth
router.use((req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});

// View technician queue
router.get('/viewQueue', (req, res) => {
  const queue = readQueue();
  res.json(queue);
});

// Add more admin routes here...

module.exports = router;