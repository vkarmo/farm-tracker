const fs = require('fs');

const data = JSON.parse(fs.readFileSync('elevation_samples.json', 'utf8'));

// The grid has 31 latitude steps and 31 longitude steps
// We need to map lat and lng to indices
const lats = Array.from(new Set(data.map(d => d.lat))).sort((a, b) => b - a); // top to bottom
const lngs = Array.from(new Set(data.map(d => d.lng))).sort((a, b) => a - b); // left to right

const grid = [];
for (let r = 0; r < lats.length; r++) {
  grid[r] = [];
  for (let c = 0; c < lngs.length; c++) {
    const lat = lats[r];
    const lng = lngs[c];
    const pt = data.find(d => Math.abs(d.lat - lat) < 1e-7 && Math.abs(d.lng - lng) < 1e-7);
    grid[r][c] = pt ? pt.elevation : null;
  }
}

// Find min and max
let min = Infinity, max = -Infinity;
data.forEach(d => {
  if (d.elevation < min) min = d.elevation;
  if (d.elevation > max) max = d.elevation;
});

console.log(`Min elevation: ${min}, Max elevation: ${max}`);

// Print a character grid
// We map each elevation to 0-9
for (let r = 0; r < lats.length; r++) {
  let line = '';
  for (let c = 0; c < lngs.length; c++) {
    const val = grid[r][c];
    if (val === null) {
      line += ' ';
    } else {
      // Map to 0-9
      const norm = Math.round(((val - min) / (max - min)) * 9);
      line += norm.toString();
    }
  }
  // Also print latitude
  console.log(`${line}  [Lat: ${lats[r].toFixed(5)}]`);
}

// Also let's print longitudes along the bottom
let lngLine = '';
for (let c = 0; c < lngs.length; c += 5) {
  lngLine += `^(${lngs[c].toFixed(4)}) `;
}
console.log(lngLine);
