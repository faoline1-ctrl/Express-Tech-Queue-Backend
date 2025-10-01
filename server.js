// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'technicianQueue.json');

app.use(cors());
app.use(express.json());

function readQueue() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeQueue(queue) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(queue, null, 2));
}

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
  res.json({ message: `Status updated to "${status}" for ${technician}` });
});

app.get('/getQueue', (req, res) => {
  let queue = readQueue();

  queue.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
    if (a.completed_work_orders !== b.completed_work_orders) {
      return a.completed_work_orders - b.completed_work_orders;
    }

    const aTime = new Date(a.status_timestamp || a.timestamp_joined);
    const bTime = new Date(b.status_timestamp || b.timestamp_joined);
    return aTime - bTime;
  });

  res.json(queue);
});

// ✅ Move this outside of the route definition
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});