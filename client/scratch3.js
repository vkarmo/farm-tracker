import * as turf from '@turf/turf';

const polyStringOrArr = "[[34.0522,-118.2437,162000000],[34.0523,-118.2437,162000001],[34.0523,-118.2436,162000002]]";
let arr = [];
try { arr = typeof polyStringOrArr === 'string' ? JSON.parse(polyStringOrArr) : polyStringOrArr; } catch (e) {}

const existingPolygons = [];

if (Array.isArray(arr) && arr.length >= 3) {
  const turfCoords = arr.map(pt => {
    if (Array.isArray(pt)) return [Number(pt[1]), Number(pt[0])];
    if (pt && typeof pt === 'object' && pt.lat !== undefined) return [Number(pt.lng || pt.lon || pt.longitude), Number(pt.lat)];
    return null;
  }).filter(Boolean);
  
  if (turfCoords.length >= 3) {
    if (turfCoords[0][0] !== turfCoords[turfCoords.length-1][0] || turfCoords[0][1] !== turfCoords[turfCoords.length-1][1]) {
      turfCoords.push([...turfCoords[0]]);
    }
    try {
      existingPolygons.push(turf.polygon([turfCoords]));
      console.log("Success:", turf.polygon([turfCoords]));
    } catch(e) { console.warn("Failed to create turf polygon:", e, turfCoords); }
  }
}

