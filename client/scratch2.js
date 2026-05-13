import * as turf from '@turf/turf';

// 1. Existing Polygons (simulating fields/nurseries)
const existingPolygons = [
  turf.polygon([[[0, 0], [0, 100], [100, 100], [100, 0], [0, 0]]]), // Big square 100x100
  turf.polygon([[[110, 0], [110, 50], [160, 50], [160, 0], [110, 0]]]) // Other square
];

let drawnVertices = [[10, 10], [10, 90], [90, 90], [110, 10]];

let containerPolygon = null;

// Find container
existingPolygons.forEach(p => {
  let insideCount = 0;
  drawnVertices.forEach(v => {
    if (turf.booleanPointInPolygon(turf.point(v), p)) insideCount++;
  });
  if (insideCount / drawnVertices.length >= 0.5) {
    containerPolygon = p;
  }
});

const snappedVertices = drawnVertices.map(v => {
  const pt = turf.point(v);
  
  if (containerPolygon && !turf.booleanPointInPolygon(pt, containerPolygon)) {
    const line = turf.polygonToLine(containerPolygon);
    const nearest = turf.nearestPointOnLine(line, pt);
    return nearest.geometry.coordinates;
  }
  
  let minDistance = Infinity;
  let closestVertex = v;
  
  existingPolygons.forEach(p => {
    const line = turf.polygonToLine(p);
    const nearest = turf.nearestPointOnLine(line, pt);
    // distance between [0,0] degrees is huge in meters, let's just use degrees for this scratch
    const dist = turf.distance(pt, nearest, {units: 'degrees'});
    
    if (dist < 3 && dist < minDistance) {
      minDistance = dist;
      closestVertex = nearest.geometry.coordinates;
    }
  });
  
  return closestVertex;
});

console.log("Original:", drawnVertices);
console.log("Snapped:", snappedVertices);

