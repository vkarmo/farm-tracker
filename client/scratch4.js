import * as turf from '@turf/turf';

const line = turf.lineString([[-118.2437, 34.0522], [-118.2437, 34.0523]]);
const pt = turf.point([-118.2440, 34.05225]);

const nearest = turf.nearestPointOnLine(line, pt);
const dist = turf.distance(pt, nearest, {units: 'meters'});

console.log("Nearest:", nearest.geometry.coordinates);
console.log("Distance:", dist, "meters");

