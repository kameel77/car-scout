const fs = require('fs');
const data = JSON.parse(fs.readFileSync('stats.json', 'utf8'));

// The format of visualizer raw-data is:
// data.nodeParts is an object where keys are IDs.
// data.nodes is an array of nodes (files) where id maps to the file name
const nodes = data.nodes || [];
const nodeParts = data.nodeParts || {};

const items = nodes.map(node => {
  const size = nodeParts[node.id] ? nodeParts[node.id].renderedLength : 0;
  return { id: node.id, name: node.id, size: size / 1024 };
}).filter(i => i.size > 10).sort((a,b) => b.size - a.size);

console.log(items.slice(0, 20).map(i => `${i.size.toFixed(2)} KB - ${i.name}`).join('\n'));
