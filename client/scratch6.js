import * as turf from '@turf/turf';

// Rice Field (Huge polygon)
const riceFieldPoly = turf.polygon([[
  [-118.24, 34.05],
  [-118.24, 34.06],
  [-118.23, 34.06],
  [-118.23, 34.05],
  [-118.24, 34.05]
]]);

const riceFieldLine = turf.polygonToLine(riceFieldPoly);

// Jebbeh/Tony Field (inside Rice field, but close to the left edge: -118.24)
// Let's put a point at -118.2399, 34.055
const currentPt = turf.point([-118.2399, 34.055]);

// Are we inside?
console.log("Inside Rice Field?", turf.booleanPointInPolygon(currentPt, riceFieldPoly));

// Rule 1: We are inside, so no spill.
// Rule 2: Snap to nearby edges
let minDistance = 50; // 50 meters
let closestVertex = currentPt.geometry.coordinates;

const nearest = turf.nearestPointOnLine(riceFieldLine, currentPt);
const dist = turf.distance(currentPt, nearest, {units: 'meters'});

console.log("Distance to edge:", dist, "meters");

if (dist < minDistance) {
  minDistance = dist;
  closestVertex = nearest.geometry.coordinates;
  console.log("Snapped! New closest:", closestVertex);
}

