const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// other routes...

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'technicianQueue.json');
// adminRoutes will be required after broadcastQueue is defined so we can pass the broadcast function
const { readQueue, writeQueue, removeTechnician } = require('./queueUtils');

app.use(cors());
app.use(express.json());

// Reset queue at 4 AM daily
cron.schedule('0 4 * * *', () => {
  const emptyQueue = [];
  fs.writeFileSync(DATA_PATH, JSON.stringify(emptyQueue, null, 2));
  console.log('Technician queue reset at 4 AM');
});

function addTechnician(queue, technicianName) {
  return {
    name: technicianName,
    completed_work_orders: 0,
    status: 'Available',
    status_timestamp: new Date().toISOString(),
    timestamp_joined: new Date().toISOString()
  };
}

app.post('/startWorkOrder', (req, res) => {
  const { technician } = req.body;
  let queue = readQueue();

  let tech = queue.find(t => t.name === technician);
  if (!tech) {
    tech = addTechnician(queue, technician);
    queue.push(tech);
  } else {
    tech.completed_work_orders += 1;
    tech.status = 'Work in Progress';
    tech.status_timestamp = new Date().toISOString();
  }

  writeQueue(queue);
  // notify SSE clients about the updated queue
  broadcastQueue(queue);
  res.json({ message: `Work order started for ${technician}` });
});

app.post('/setStatus', (req, res) => {
  const { technician, status } = req.body;
  let queue = readQueue();

  const tech = queue.find(t => t.name === technician);
  if (!tech) return res.status(404).json({ error: 'Technician not found' });

  tech.status = status;
  if (status === 'Available') {
    tech.status_timestamp = new Date().toISOString();
  }

  writeQueue(queue);
  // notify SSE clients about the updated queue
  broadcastQueue(queue);
  res.json({ message: `Status updated to "${status}" for ${technician}` });
});

app.get('/getQueue', (req, res) => {
  let queue = readQueue();

const weightFactor = 10; // Each completed work order reduces priority by 10 minutes

  queue.sort((a, b) => {
    const now = Date.now();

    const aWait = (now - new Date(a.status_timestamp || a.timestamp_joined)) / 60000;
    const bWait = (now - new Date(b.status_timestamp || b.timestamp_joined)) / 60000;

    const aScore = a.status === 'Available' ? aWait - (a.completed_work_orders * weightFactor) : -Infinity;
    const bScore = b.status === 'Available' ? bWait - (b.completed_work_orders * weightFactor) : -Infinity;

    return bScore - aScore; // Higher score = higher priority
  });
  res.json(queue);
});

app.get('/admin/viewQueue', (req, res) => {
  const queue = readQueue();
  res.json(queue);
});

const sseClients = new Set();

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// helper to broadcast
function broadcastQueue(queue) {
  const payload = `data: ${JSON.stringify(queue)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
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
