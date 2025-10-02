const fs = require('fs');
const path = require('path');
const DATA_PATH = path.join(__dirname, 'technicianQueue.json');

function readQueue() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    console.log('[DEBUG] Raw file content:', raw);
    return JSON.parse(raw);
  } catch (err) {
    console.error('[ERROR] Failed to read queue:', err);
    return [];
  }
}

function writeQueue(queue) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(queue, null, 2));
}

function removeTechnician(queue, technicianName) {
  return queue.filter(t => t.name !== technicianName);
}

module.exports = { readQueue, writeQueue, removeTechnician };
