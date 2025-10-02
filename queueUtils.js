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

module.exports = { readQueue, writeQueue, removeTechnician };