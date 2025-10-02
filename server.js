const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const { readQueue, writeQueue } = require('./queueUtils');

app.use(cors());
app.use(express.json());

// Reset queue at 4 AM daily using queue utilities (keeps a single place for file IO)
cron.schedule('0 4 * * *', () => {
  try {
    writeQueue([]);
    console.log('Technician queue reset at 4 AM');
  } catch (err) {
    console.error('Failed to reset technician queue at 4 AM:', err);
  }
});

function addTechnician(technicianName) {
  return {
    name: technicianName,
    completed_work_orders: 0,
    status: 'Available',
    status_timestamp: new Date().toISOString(),
    timestamp_joined: new Date().toISOString()
  };
}

app.post('/startWorkOrder', (req, res) => {
  const { technician } = req.body || {};
  if (!technician || typeof technician !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid technician name' });
  }

  const queue = Array.isArray(readQueue()) ? readQueue() : [];

  let tech = queue.find(t => t.name === technician);
  if (!tech) {
    tech = addTechnician(technician);
    queue.push(tech);
  } else {
    tech.completed_work_orders = (tech.completed_work_orders || 0) + 1;
    tech.status = 'Work in Progress';
    tech.status_timestamp = new Date().toISOString();
  }

  try {
    writeQueue(queue);
  } catch (err) {
    console.error('Failed to write queue on startWorkOrder:', err);
    return res.status(500).json({ error: 'Failed to persist queue' });
  }

  // notify SSE clients about the updated queue
  broadcastQueue(queue);

  res.json({ message: `Work order started for ${technician}` });
});

app.post('/setStatus', (req, res) => {
  const { technician, status } = req.body || {};
  if (!technician || typeof technician !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid technician name' });
  }
  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid status' });
  }

  const queue = Array.isArray(readQueue()) ? readQueue() : [];

  const tech = queue.find(t => t.name === technician);

  if (!tech) return res.status(404).json({ error: 'Technician not found' });

  tech.status = status;
  if (status === 'Available') {
    tech.status_timestamp = new Date().toISOString();
  }

  try {
    writeQueue(queue);
  } catch (err) {
    console.error('Failed to write queue on setStatus:', err);
    return res.status(500).json({ error: 'Failed to persist queue' });
  }

  // notify SSE clients about the updated queue
  broadcastQueue(queue);

  res.json({ message: `Status updated to "${status}" for ${technician}` });
});

app.get('/getQueue', (req, res) => {
  const queue = Array.isArray(readQueue()) ? readQueue() : [];

  const weightFactor = 10; // Each completed work order reduces priority by 10 minutes

  queue.sort((a, b) => {
    const now = Date.now();

    const aDate = new Date(a.status_timestamp || a.timestamp_joined);
    const bDate = new Date(b.status_timestamp || b.timestamp_joined);
    const aWait = Number.isFinite(aDate.getTime()) ? (now - aDate) / 60000 : 0;
    const bWait = Number.isFinite(bDate.getTime()) ? (now - bDate) / 60000 : 0;

    const aCompleted = typeof a.completed_work_orders === 'number' ? a.completed_work_orders : 0;
    const bCompleted = typeof b.completed_work_orders === 'number' ? b.completed_work_orders : 0;

    const aScore = a.status === 'Available' ? aWait - (aCompleted * weightFactor) : -Infinity;
    const bScore = b.status === 'Available' ? bWait - (bCompleted * weightFactor) : -Infinity;

    return bScore - aScore; // Higher score = higher priority
  });

  res.json(queue);
});

// Note: adminRoutes exposes admin endpoints under /admin/* (with auth)

const sseClients = new Set();

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  // send an initial comment to establish the stream
  res.write(': connected\n\n');

  // send current queue immediately
  try {
    const initial = readQueue();
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
  } catch (err) {
    // ignore; stream stays open
  }

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
    try { res.end(); } catch (e) { /* noop */ }
  });
});

// helper to broadcast
function broadcastQueue(queue) {
  const payload = `data: ${JSON.stringify(queue)}\n\n`;
  for (const res of Array.from(sseClients)) {
    try {
      res.write(payload);
    } catch (err) {
      // client might be gone — remove from set
      sseClients.delete(res);
      try { res.end(); } catch (e) { /* noop */ }
    }
  }
}

// Mount admin routes and pass broadcastQueue so admin actions broadcast updates
try {
  const adminRoutesFactory = require('./adminRoutes');
  const adminRoutes = adminRoutesFactory(broadcastQueue);
  app.use('/admin', adminRoutes);
} catch (err) {
  console.error('Failed to mount adminRoutes with broadcast support:', err);
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
    function broadcastQueue(queue) {
      const payload = `data: ${JSON.stringify(queue)}\n\n`;
      for (const res of Array.from(sseClients)) {
        try {
          res.write(payload);
        } catch (err) {
          // client might be gone — remove from set
          sseClients.delete(res);
          try { res.end(); } catch (e) { /* noop */ }
        }
      }
    }

    // Mount admin routes and pass broadcastQueue so admin actions broadcast updates
    try {
      const adminRoutesFactory = require('./adminRoutes');
      const adminRoutes = adminRoutesFactory(broadcastQueue);
      app.use('/admin', adminRoutes);
    } catch (err) {
      console.error('Failed to mount adminRoutes with broadcast support:', err);
    }

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  const adminRoutesFactory = require('./adminRoutes');
