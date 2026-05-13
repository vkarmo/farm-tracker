import * as turf from '@turf/turf';

// Drawn Polygon (Big field)
const drawnCoords = [[0,0], [0,100], [100,100], [100,0], [0,0]];
const drawnPoly = turf.polygon([drawnCoords]);

// Existing Polygon 1: Nursery inside the field
const nurseryCoords = [[40,40], [40,60], [60,60], [60,40], [40,40]];
const nurseryPoly = turf.polygon([nurseryCoords]);

// Existing Polygon 2: Neighbor field
const neighborCoords = [[105,0], [105,100], [200,100], [200,0], [105,0]];
const neighborPoly = turf.polygon([neighborCoords]);

const filterOutContained = (existingGeom, containerPoly) => {
  let coords = [];
  if (existingGeom.geometry.type === 'Polygon') {
    coords = existingGeom.geometry.coordinates[0];
  } else if (existingGeom.geometry.type === 'LineString') {
    coords = existingGeom.geometry.coordinates;
  }
  
  let insideCount = 0;
  coords.forEach(c => {
    if (turf.booleanPointInPolygon(turf.point(c), containerPoly)) {
      insideCount++;
    }
  });
  
  // If more than 50% of vertices are inside, it's considered contained
  return (insideCount / coords.length) > 0.5;
};

console.log("Nursery contained?", filterOutContained(nurseryPoly, drawnPoly));
console.log("Neighbor contained?", filterOutContained(neighborPoly, drawnPoly));

