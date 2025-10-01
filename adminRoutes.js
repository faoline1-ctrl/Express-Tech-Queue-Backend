const express = require('express');
const router = express.Router();
const { readQueue, writeQueue } = require('./queueUtils'); // adjust path as needed

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
  const { technician } = req.body;
  let queue = readQueue();

  const techExists = queue.some(t => t.name === technician);
  if (!techExists) {
    return res.status(404).json({ error: 'Technician not found' });
  }

  const updatedQueue = removeTechnician(queue, technician);
  writeQueue(updatedQueue);

  res.json({ message: `Technician "${technician}" removed successfully.` });
});

// Add more admin routes here...

module.exports = router;
