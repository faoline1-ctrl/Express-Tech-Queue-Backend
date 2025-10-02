const fs = require('fs');
const path = require('path');
const DATA_PATH = path.join(__dirname, 'technicianQueue.json');

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

function removeTechnician(queue, technicianName) {
  return queue.filter(t => t.name !== technicianName);
}

module.exports = { readQueue, writeQueue, removeTechnician };