const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const { readQueue, writeQueue, sortQueue } = require('./queueUtils');

app.use(cors());
app.use(express.json());

// Reset queue at 4 AM daily
cron.schedule('0 4 * * *', () => {
  try { writeQueue([]); console.log('Technician queue reset at 4 AM'); } catch (err) { console.error('Failed to reset technician queue at 4 AM:', err); }
});

function addTechnician(name) {
  return {
    name,
    completed_work_orders: 0,
    status: 'Available',
    status_timestamp: new Date().toISOString(),
    timestamp_joined: new Date().toISOString()
  };
}

app.post('/startWorkOrder', (req, res) => {
  const { technician } = req.body || {};
  if (!technician || typeof technician !== 'string') return res.status(400).json({ error: 'Invalid technician' });
  const queue = Array.isArray(readQueue()) ? readQueue() : [];
  let tech = queue.find(t => t.name === technician);
  const wasAdded = !tech;
  if (!tech) {
    tech = addTechnician(technician);
    queue.push(tech);
  } else {
    tech.completed_work_orders = (tech.completed_work_orders || 0) + 1;
    tech.status = 'Work in Progress';
    tech.status_timestamp = new Date().toISOString();
  }
  try { writeQueue(queue); } catch (err) { console.error(err); return res.status(500).json({ error: 'Persist failed' }); }
  broadcastQueue(queue);
  return res.json({ message: wasAdded ? `Technician ${technician} added to the Queue` : `Work order started for ${technician}` });
});

app.post('/setStatus', (req, res) => {
  const { technician, status } = req.body || {};
  if (!technician || !status) return res.status(400).json({ error: 'Invalid payload' });
  const queue = Array.isArray(readQueue()) ? readQueue() : [];
  const tech = queue.find(t => t.name === technician);
  if (!tech) return res.status(404).json({ error: 'Technician not found' });
  tech.status = status; if (status === 'Available') tech.status_timestamp = new Date().toISOString();
  try { writeQueue(queue); } catch (err) { console.error(err); return res.status(500).json({ error: 'Persist failed' }); }
  broadcastQueue(queue);
  return res.json({ message: 'Status updated' });
});

// Get Queue data and sort by availability and wait time
app.get('/getQueue', (req, res) => {
  const raw = Array.isArray(readQueue()) ? readQueue() : [];
  const sorted = sortQueue(raw);
  res.json(sorted);
});

const sseClients = new Set();
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': connected\n\n');
  try { const initial = Array.isArray(readQueue()) ? readQueue() : []; const sortedInitial = sortQueue(initial); res.write(`data: ${JSON.stringify(sortedInitial)}\n\n`); } catch (e) {}
  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); try { res.end(); } catch (e) {} });
});

function broadcastQueue(queue) {
  const sorted = sortQueue(queue);
  const payload = `data: ${JSON.stringify(sorted)}\n\n`;
  for (const r of Array.from(sseClients)) { try { r.write(payload); } catch (e) { sseClients.delete(r); try { r.end(); } catch (e) {} } }
}

try { const adminRoutesFactory = require('./adminRoutes'); const adminRoutes = adminRoutesFactory(broadcastQueue); app.use('/admin', adminRoutes); } catch (err) { console.error('Failed to mount adminRoutes:', err); }

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
