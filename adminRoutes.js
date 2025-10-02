const express = require('express');

// Export a factory that accepts a broadcastQueue function so admin routes can notify SSE clients
module.exports = function (broadcastQueue) {
  const router = express.Router();
  const { readQueue, writeQueue, removeTechnician } = require('./queueUtils');

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

  router.post('/removeTechnician', (req, res) => {
    try {
      const { technician } = req.body || {};

      if (!technician || typeof technician !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing technician name' });
      }

      const queue = readQueue();
      const techExists = queue.some(t => t.name === technician);

      if (!techExists) {
        return res.status(404).json({ error: 'Technician not found' });
      }

      const updatedQueue = removeTechnician(queue, technician);

      if (!Array.isArray(updatedQueue)) {
        return res.status(500).json({ error: 'Invalid queue format' });
      }

      try {
        writeQueue(updatedQueue);
      } catch (err) {
        console.error('Failed to write queue from admin removeTechnician:', err);
        return res.status(500).json({ error: 'Failed to persist queue' });
      }

      // notify SSE clients if broadcastQueue is provided
      if (typeof broadcastQueue === 'function') {
        try { broadcastQueue(updatedQueue); } catch (err) { /* ignore broadcast errors */ }
      }

      res.json({ message: `Technician "${technician}" removed successfully.` });
    } catch (error) {
      console.error('removeTechnician failed:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Add more admin routes here...

  return router;
};
