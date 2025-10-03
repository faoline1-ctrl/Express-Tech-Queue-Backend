const fs = require('fs');
const path = require('path');
const DATA_PATH = path.join(__dirname, 'technicianQueue.json');

function readQueue() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // return empty array if file is missing, corrupted, or unreadable
    return [];
  }
}

function writeQueue(queue) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(queue, null, 2));
  } catch (err) {
    // bubble up the error for callers to handle
    throw err;
  }
}

function removeTechnician(queue, technicianName) {
  return queue.filter(t => t.name !== technicianName);
}

function sortQueue(queue, weightFactor = 10) {
  if (!Array.isArray(queue)) return [];
  const now = Date.now();
  const copy = queue.slice();
  copy.sort((a, b) => {
    const aDate = new Date(a.status_timestamp || a.timestamp_joined);
    const bDate = new Date(b.status_timestamp || b.timestamp_joined);
    const aWait = Number.isFinite(aDate.getTime()) ? (now - aDate) / 60000 : 0;
    const bWait = Number.isFinite(bDate.getTime()) ? (now - bDate) / 60000 : 0;
    const aCompleted = Number(a.completed_work_orders || 0);
    const bCompleted = Number(b.completed_work_orders || 0);
    const aScore = a.status === 'Available' ? aWait - aCompleted * weightFactor : -Infinity;
    const bScore = b.status === 'Available' ? bWait - bCompleted * weightFactor : -Infinity;
    return bScore - aScore;
  });
  return copy;
}

module.exports = { readQueue, writeQueue, removeTechnician, sortQueue };