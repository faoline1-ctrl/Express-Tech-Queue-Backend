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
const adminRoutes = require('./adminRoutes'); // adjust path if needed
const { readQueue, writeQueue, removeTechnician } = require('./queueUtils');

app.use(cors());
app.use(express.json());
app.use('/admin', adminRoutes);

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

app.get('/admin/viewQueue', (req, res) => {
  const queue = readQueue();
  res.json(queue);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
