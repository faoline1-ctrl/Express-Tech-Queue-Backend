const express = require('express');

// Export a factory that accepts a broadcastQueue function so admin routes can notify SSE clients
module.exports = function (broadcastQueue) {
  const router = express.Router();
  const { readQueue, writeQueue, removeTechnician } = require('./queueUtils'); // adjust path as needed

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
      const { technician } = req.body;
      console.log('[DEBUG] Technician to remove:', technician);

      if (!technician || typeof technician !== 'string') {
        console.log('[DEBUG] Invalid technician name');
        return res.status(400).json({ error: 'Invalid or missing technician name' });
      }

      const queue = readQueue();
      console.log('[DEBUG] Original queue:', queue);

      const techExists = queue.some(t => t.name === technician);
      console.log('[DEBUG] Technician exists:', techExists);

      if (!techExists) {
        return res.status(404).json({ error: 'Technician not found' });
      }

      const updatedQueue = removeTechnician(queue, technician);
      console.log('[DEBUG] Updated queue:', updatedQueue);

      if (!Array.isArray(updatedQueue)) {
        console.log('[DEBUG] Updated queue is not an array');
        return res.status(500).json({ error: 'Invalid queue format' });
      }

      writeQueue(updatedQueue);
      console.log('[DEBUG] Queue written successfully');

      // notify SSE clients if broadcastQueue is provided
      try {
        if (typeof broadcastQueue === 'function') {
          broadcastQueue(updatedQueue);
        }
      } catch (err) {
        console.error('[ERROR] broadcasting updated queue from adminRoutes:', err);
      }

      res.json({ message: `Technician "${technician}" removed successfully.` });
    } catch (error) {
      console.error('[ERROR] removeTechnician failed:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Add more admin routes here...

  return router;
};
