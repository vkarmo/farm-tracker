const neo4j = require('neo4j-driver');
require('dotenv').config();

let uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
if (uri.startsWith('bolt+s://')) {
  uri = uri.replace('bolt+s://', 'neo4j+s://');
}
const driver = neo4j.driver(
  uri,
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password')
);

// Helper functions matching client-side implementation
function isPointInPolygon(point, vs) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getDistanceToLineSegment(p, a, b) {
  const x = p[1]; // longitude
  const y = p[0]; // latitude
  const x1 = a[1];
  const y1 = a[0];
  const x2 = b[1];
  const y2 = b[0];

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

const CREEK_SEGMENTS = [
  // Main Creek (6 segments tracing the actual lowest elevation valley)
  [[6.7366, -10.8695], [6.7353, -10.8695]],
  [[6.7353, -10.8695], [6.7338, -10.8695]],
  [[6.7338, -10.8695], [6.7328, -10.8704]],
  [[6.7328, -10.8704], [6.7313, -10.8704]],
  [[6.7313, -10.8704], [6.7298, -10.8709]],
  [[6.7298, -10.8709], [6.7290, -10.8713]],
  
  // NW Tributary (3 segments tracing the SW saddle and SW valley minima)
  [[6.7290, -10.8741], [6.7313, -10.8754]],
  [[6.7313, -10.8754], [6.7323, -10.8723]],
  [[6.7323, -10.8723], [6.7328, -10.8704]],
  
  // SE Tributary (2 segments tracing the SE valley minima)
  [[6.7313, -10.8704], [6.7293, -10.8659]],
  [[6.7293, -10.8659], [6.7295, -10.8640]]
];

function getDistanceToCreek(point) {
  let minDistance = Infinity;
  for (let i = 0; i < CREEK_SEGMENTS.length; i++) {
    const dist = getDistanceToLineSegment(point, CREEK_SEGMENTS[i][0], CREEK_SEGMENTS[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

function extractSpatialStats(polygonCoords) {
  let sanitized = polygonCoords;
  if (Array.isArray(polygonCoords) && polygonCoords.length > 0 && Array.isArray(polygonCoords[0]) && Array.isArray(polygonCoords[0][0])) {
    sanitized = polygonCoords[0];
  }
  if (!Array.isArray(sanitized) || sanitized.length < 3) {
    return { elevation: 120, soilMoisture: 0.28 };
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const pt of sanitized) {
    const lat = pt[0];
    const lng = pt[1];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  const gridSize = 15;
  const elevValues = [];
  const moistureValues = [];

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = minLat + (i / gridSize) * (maxLat - minLat);
      const lng = minLng + (j / gridSize) * (maxLng - minLng);

      if (isPointInPolygon([lat, lng], sanitized)) {
        // Use the global NMK Property bounding box coordinates to align overlays consistently
        const globalMinLat = 6.7290;
        const globalMaxLat = 6.7366;
        const globalMinLng = -10.8759;
        const globalMaxLng = -10.8622;
        const globalLatCenter = (globalMinLat + globalMaxLat) / 2;
        const globalLngCenter = (globalMinLng + globalMaxLng) / 2;

        const dx = (lat - globalLatCenter) / (globalMaxLat - globalMinLat || 0.0001);
        const dy = (lng - globalLngCenter) / (globalMaxLng - globalMinLng || 0.0001);

        const sinSeed = Math.sin(lat * 12345 + lng * 67890);
        const noise = (sinSeed - Math.floor(sinSeed)) * 0.08 - 0.04;

        // Creek influence calculation
        const distToCreek = getDistanceToCreek([lat, lng]);
        const maxInfluenceDist = 0.0012; // ~130 meters
        const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

        // Elevation calculation
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
        let baseElev = 1.0 - distanceToCenter;
        baseElev = baseElev * 0.7 + (dx + dy + 1.0) * 0.15;
        baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
        let elevVal = baseElev + noise * 0.5;
        elevVal = Math.max(0.01, Math.min(0.99, elevVal));
        const elevMeters = 50 + elevVal * 200;
        elevValues.push(elevMeters);

        // Soil Moisture calculation
        let baseVeg = 0.6 + 0.3 * Math.cos(dx * 4) * Math.sin(dy * 4) + 0.15 * Math.sin(dx * 12 + dy * 8) + noise;
        baseVeg = Math.max(0.05, Math.min(0.95, baseVeg));
        const dryness = 0.3 * (1.0 - baseVeg) + 0.7 * baseVeg;
        let moistureVal = 1.0 - dryness;
        moistureVal = moistureVal + (1.0 - moistureVal) * 0.8 * creekInfluence;
        moistureVal = Math.max(0.01, Math.min(0.99, moistureVal));
        const moistureVWC = 0.10 + moistureVal * 0.40;
        moistureValues.push(moistureVWC);
      }
    }
  }

  if (elevValues.length === 0) {
    const lat = (minLat + maxLat) / 2;
    const lng = (minLng + maxLng) / 2;
    const sinSeed = Math.sin(lat * 12345 + lng * 67890);
    const noise = (sinSeed - Math.floor(sinSeed)) * 0.08 - 0.04;

    const distToCreek = getDistanceToCreek([lat, lng]);
    const maxInfluenceDist = 0.0012;
    const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

    let baseElev = 0.5;
    baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
    const elevVal = Math.max(0.01, Math.min(0.99, baseElev + noise * 0.5));
    const elevMeters = 50 + elevVal * 200;

    let baseVeg = 0.6 + noise;
    baseVeg = Math.max(0.05, Math.min(0.95, baseVeg));
    const dryness = 0.3 * (1.0 - baseVeg) + 0.7 * baseVeg;
    let moistureVal = 1.0 - dryness;
    moistureVal = moistureVal + (1.0 - moistureVal) * 0.8 * creekInfluence;
    moistureVal = Math.max(0.01, Math.min(0.99, moistureVal));
    const moistureVWC = 0.10 + moistureVal * 0.40;

    return { elevation: Math.round(elevMeters), soilMoisture: parseFloat(moistureVWC.toFixed(2)) };
  }

  elevValues.sort((a, b) => a - b);
  const mid = Math.floor(elevValues.length / 2);
  const medianElev = elevValues.length % 2 !== 0 ? elevValues[mid] : (elevValues[mid - 1] + elevValues[mid]) / 2;
  const avgMoisture = moistureValues.reduce((sum, val) => sum + val, 0) / moistureValues.length;

  return {
    elevation: Math.round(medianElev),
    soilMoisture: parseFloat(avgMoisture.toFixed(2))
  };
}

function getCropRecommendation(elevation, soilMoisture) {
  if (elevation < 110 && soilMoisture > 0.40) return 'Swamp Rice (Upland/Lowland)';
  if (elevation > 160 && soilMoisture >= 0.15 && soilMoisture <= 0.30) return 'Cassava';
  if (elevation >= 110 && elevation <= 160 && soilMoisture > 0.35) return 'Oil Palm';
  if (elevation >= 110 && elevation <= 160 && soilMoisture >= 0.20 && soilMoisture <= 0.35) return 'Vegetables';
  return 'Requires Soil Amendment or Drainage Management';
}

async function run() {
  const session = driver.session();
  try {
    const res = await session.run('MATCH (f:Field) RETURN f');
    console.log("=== Field Spatial Recommendation Test ===");
    res.records.forEach(r => {
      const p = r.get('f').properties;
      let poly = [];
      if (p.polygon) {
        try { poly = JSON.parse(p.polygon); } catch(e) { poly = p.polygon; }
      }
      const stats = extractSpatialStats(poly);
      const rec = getCropRecommendation(stats.elevation, stats.soilMoisture);
      console.log(`Field Name: ${p.name}`);
      console.log(`- Area: ${p.area} acres`);
      console.log(`- Stats: Elevation = ${stats.elevation}m, Soil Moisture = ${stats.soilMoisture} m³/m³`);
      console.log(`- Recommended Crop: ${rec}`);
      console.log("---------------------------------------");
    });
  } catch(e) {
    console.error('Database run error:', e);
  } finally {
    await session.close();
    await driver.close();
  }
}
run();
