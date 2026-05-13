import * as turf from '@turf/turf';

const poly = turf.polygon([[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]);
const ptInside = turf.point([5, 5]);
const ptOutside = turf.point([15, 15]);

console.log("Inside:", turf.booleanPointInPolygon(ptInside, poly));
console.log("Outside:", turf.booleanPointInPolygon(ptOutside, poly));

// Nearest point on line
const line = turf.polygonToLine(poly);
const nearest = turf.nearestPointOnLine(line, ptOutside);
console.log("Nearest to 15,15 on poly:", nearest.geometry.coordinates);

