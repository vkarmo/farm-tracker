const fs = require('fs');

const data = JSON.parse(fs.readFileSync('elevation_samples.json', 'utf8'));

// Get sorted rows (Lats) and columns (Lngs)
const lats = Array.from(new Set(data.map(d => d.lat))).sort((a, b) => b - a);
const lngs = Array.from(new Set(data.map(d => d.lng))).sort((a, b) => a - b);

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

console.log('--- LOCAL MINIMA PER LATITUDE ROW ---');
for (let r = 0; r < lats.length; r++) {
  const row = grid[r];
  const minima = [];
  for (let c = 0; c < row.length; c++) {
    const val = row[c];
    if (val === null) continue;
    
    // Check if it's a local minimum in the row
    const leftVal = c > 0 ? row[c - 1] : Infinity;
    const rightVal = c < row.length - 1 ? row[c + 1] : Infinity;
    
    if (val <= leftVal && val <= rightVal) {
      // It's a local minimum in this row
      minima.push({ col: c, lng: lngs[c], elevation: val });
    }
  }
  
  // Format output for this row
  const formattedMinima = minima.map(m => `Col ${m.col} (${m.lng.toFixed(5)}): ${m.elevation}m`).join(' | ');
  console.log(`Lat ${lats[r].toFixed(5)}: ${formattedMinima}`);
}
