import React, { useMemo } from 'react';
import { X, Info, HelpCircle, ShieldAlert, Award, Compass, Droplet } from 'lucide-react';
import { isPointInPolygon, getDistanceToCreek } from './FieldImageryOverlay';

// Decision Matrix definitions
export const CROPS_MATRIX = [
  {
    name: 'Swamp Rice (Upland/Lowland)',
    terrain: 'Low-lying depressions, valleys, floodplains (Low elevation, poorly drained)',
    moisture: 'High saturation (>0.40 m³/m³)',
    viability: "Very High. Rice is Liberia’s primary staple. Bomi's inland valleys are prime for lowland swamp rice.",
    color: '#1b5e20',
    bgColor: '#e8f5e9',
    borderColor: '#c8e6c9'
  },
  {
    name: 'Cassava',
    terrain: 'Well-drained rolling hills (Slightly higher relative elevation)',
    moisture: 'Moderate to low moisture (0.15 - 0.30 m³/m³). Cannot handle waterlogging',
    viability: 'High. Second most important crop; highly drought-tolerant during the dry season.',
    color: '#e65100',
    bgColor: '#fff3e0',
    borderColor: '#ffe0b2'
  },
  {
    name: 'Oil Palm',
    terrain: 'Flat to gently rolling plains',
    moisture: 'Consistently high moisture but requires well-drained soil',
    viability: "High. Major local cash crop and staple ingredient; thrives in Bomi's humid climate.",
    color: '#311b92',
    bgColor: '#f3e5f5',
    borderColor: '#e1bee7'
  },
  {
    name: 'Vegetables (Eddoe, Sweet Potato, Peppers)',
    terrain: 'Flat plains with managed irrigation/drainage',
    moisture: 'Moderate, consistent moisture (0.20 - 0.35 m³/m³)',
    viability: 'Medium-High. Great for local markets and short-term economic turnover.',
    color: '#006064',
    bgColor: '#e0f7fa',
    borderColor: '#b2ebf2'
  }
];

// Helper to sanitize coordinates
function getSanitizedPolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return [];
  if (Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
    return polygon[0];
  }
  return polygon;
}

// Spatial extraction function
export function extractSpatialStats(polygonCoords) {
  const sanitized = getSanitizedPolygon(polygonCoords);
  if (sanitized.length < 3) {
    return { elevation: 120, soilMoisture: 0.28 }; // Default fallbacks
  }

  // 1. Compute Bounding Box
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

  const latCenter = (minLat + maxLat) / 2;
  const lngCenter = (minLng + maxLng) / 2;

  // 2. Sample points on a grid inside the polygon
  const gridSize = 15; // 15x15 grid is efficient and covers the area well
  const elevValues = [];
  const moistureValues = [];

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = minLat + (i / gridSize) * (maxLat - minLat);
      const lng = minLng + (j / gridSize) * (maxLng - minLng);

      // Check if point is inside the polygon
      if (isPointInPolygon([lat, lng], sanitized)) {
        // Use the global NMK Property bounding box to match the consistent imagery overlays
        const globalMinLat = 6.7290;
        const globalMaxLat = 6.7366;
        const globalMinLng = -10.8759;
        const globalMaxLng = -10.8622;
        const globalLatCenter = (globalMinLat + globalMaxLat) / 2;
        const globalLngCenter = (globalMinLng + globalMaxLng) / 2;

        const dx = (lat - globalLatCenter) / (globalMaxLat - globalMinLat || 0.0001);
        const dy = (lng - globalLngCenter) / (globalMaxLng - globalMinLng || 0.0001);

        // Deterministic noise matching visual simulation
        const sinSeed = Math.sin(lat * 12345 + lng * 67890);
        const noise = (sinSeed - Math.floor(sinSeed)) * 0.08 - 0.04;

        // Calculate creek influence at [lat, lng]
        const distToCreek = getDistanceToCreek([lat, lng]);
        const maxInfluenceDist = 0.0012; // ~130 meters
        const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

        // Elevation calculation
        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
        let baseElev = 1.0 - distanceToCenter;
        baseElev = baseElev * 0.7 + (dx + dy + 1.0) * 0.15;
        // Apply creek depression (lower elevation)
        baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
        let elevVal = baseElev + noise * 0.5;
        elevVal = Math.max(0.01, Math.min(0.99, elevVal));
        const elevMeters = 50 + elevVal * 200; // mapped to 50m - 250m
        elevValues.push(elevMeters);

        // Soil Moisture calculation
        let baseVeg = 0.6 + 0.3 * Math.cos(dx * 4) * Math.sin(dy * 4) + 0.15 * Math.sin(dx * 12 + dy * 8) + noise;
        baseVeg = Math.max(0.05, Math.min(0.95, baseVeg));
        const dryness = 0.3 * (1.0 - baseVeg) + 0.7 * baseVeg;
        let moistureVal = 1.0 - dryness;
        // Apply creek high moisture modifier
        moistureVal = moistureVal + (1.0 - moistureVal) * 0.8 * creekInfluence;
        moistureVal = Math.max(0.01, Math.min(0.99, moistureVal));
        const moistureVWC = 0.10 + moistureVal * 0.40; // mapped to 0.10 - 0.50
        moistureValues.push(moistureVWC);
      }
    }
  }

  // Fallback to center if no grid points fell inside the polygon
  if (elevValues.length === 0) {
    const lat = latCenter;
    const lng = lngCenter;
    const sinSeed = Math.sin(lat * 12345 + lng * 67890);
    const noise = (sinSeed - Math.floor(sinSeed)) * 0.08 - 0.04;
    
    const distToCreek = getDistanceToCreek([lat, lng]);
    const maxInfluenceDist = 0.0012;
    const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

    let baseElev = 0.5; // center default
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

  // Calculate Median Elevation
  elevValues.sort((a, b) => a - b);
  const mid = Math.floor(elevValues.length / 2);
  const medianElev = elevValues.length % 2 !== 0 ? elevValues[mid] : (elevValues[mid - 1] + elevValues[mid]) / 2;

  // Calculate Average Soil Moisture
  const avgMoisture = moistureValues.reduce((sum, val) => sum + val, 0) / moistureValues.length;

  return {
    elevation: Math.round(medianElev),
    soilMoisture: parseFloat(avgMoisture.toFixed(2))
  };
}

// Crop Recommendation Decision Matrix
export function getCropRecommendation(elevation, soilMoisture) {
  // Rice: Low elevation (< 110m) and High soil moisture (> 0.40 m³/m³)
  if (elevation < 110 && soilMoisture > 0.40) {
    return CROPS_MATRIX[0];
  }
  
  // Cassava: Elevated (> 160m) and Moderate/Low soil moisture (0.15 - 0.30 m³/m³)
  if (elevation > 160 && soilMoisture >= 0.15 && soilMoisture <= 0.30) {
    return CROPS_MATRIX[1];
  }

  // Oil Palm: Flat/Rolling (110m - 160m) and Consistently High moisture (> 0.35 m³/m³)
  if (elevation >= 110 && elevation <= 160 && soilMoisture > 0.35) {
    return CROPS_MATRIX[2];
  }

  // Vegetables: Flat/Rolling (110m - 160m) and Moderate moisture (0.20 - 0.35 m³/m³)
  if (elevation >= 110 && elevation <= 160 && soilMoisture >= 0.20 && soilMoisture <= 0.35) {
    return CROPS_MATRIX[3];
  }

  // Fallback
  return null;
}

export default function CropRecommendationPanel({ field, onClose }) {
  const stats = useMemo(() => {
    if (!field || !field.polygon) return { elevation: 0, soilMoisture: 0 };
    return extractSpatialStats(field.polygon);
  }, [field]);

  const recommendedCrop = useMemo(() => {
    return getCropRecommendation(stats.elevation, stats.soilMoisture);
  }, [stats]);

  if (!field) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        width: '320px',
        maxHeight: 'calc(100% - 24px)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--color-border, #ccc)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className="crop-recommendation-panel"
    >
      {/* Slide-in animation style */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary-dark, #1b5e20)', fontSize: '1rem', fontWeight: 700 }}>
          <Compass size={18} /> Crop Advisor
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', padding: '4px', display: 'flex', alignItems: 'center' }}
          title="Close Advisor"
        >
          <X size={18} />
        </button>
      </div>

      {/* Field Details */}
      <div style={{ background: '#f5f7fa', padding: '10px', borderRadius: '6px', border: '1px solid #eef2f6' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Field Name</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#333', marginBottom: '8px' }}>{field.name || 'Unnamed Field'}</div>
        <div style={{ fontSize: '0.72rem', color: '#666' }}>ID: {field.id}</div>
        <div style={{ fontSize: '0.72rem', color: '#666' }}>Area: {field.area} ac</div>
      </div>

      {/* Extracted Spatial Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eef2f6', alignItems: 'center', textAlign: 'center' }}>
          <Compass size={18} color="#2563eb" style={{ marginBottom: '4px' }} />
          <span style={{ fontSize: '0.62rem', color: '#757575', fontWeight: 600, textTransform: 'uppercase' }}>Median Elev</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{stats.elevation} m</span>
          <span style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '1px' }}>
            {stats.elevation < 110 ? 'Low Valley' : stats.elevation > 160 ? 'Sloped Hills' : 'Rolling Plains'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #eef2f6', alignItems: 'center', textAlign: 'center' }}>
          <Droplet size={18} color="#00acc1" style={{ marginBottom: '4px' }} />
          <span style={{ fontSize: '0.62rem', color: '#757575', fontWeight: 600, textTransform: 'uppercase' }}>Avg Moisture</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{stats.soilMoisture} m³/m³</span>
          <span style={{ fontSize: '0.55rem', color: '#64748b', marginTop: '1px' }}>
            {stats.soilMoisture < 0.20 ? 'Low' : stats.soilMoisture > 0.35 ? 'High' : 'Moderate'}
          </span>
        </div>
      </div>

      {/* Recommendations Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Award size={14} color="#1b5e20" /> Bomi Crop Recommendation
        </div>

        {recommendedCrop ? (
          <div
            style={{
              background: recommendedCrop.bgColor,
              border: `1px solid ${recommendedCrop.borderColor}`,
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: recommendedCrop.color }}>
              {recommendedCrop.name}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: '#374151' }}>
              <div><strong>Ideal Terrain:</strong> {recommendedCrop.terrain}</div>
              <div><strong>Moisture Range:</strong> {recommendedCrop.moisture}</div>
            </div>

            <div
              style={{
                fontSize: '0.7rem',
                lineHeight: '1.3',
                color: recommendedCrop.color,
                background: 'rgba(255, 255, 255, 0.6)',
                padding: '6px 8px',
                borderRadius: '4px',
                borderLeft: `3px solid ${recommendedCrop.color}`,
                fontWeight: 500
              }}
            >
              <strong>Bomi County Viability:</strong> {recommendedCrop.viability}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#991b1b'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={16} /> Requires Soil Amendment or Drainage Management
            </div>
            <p style={{ fontSize: '0.68rem', margin: 0, lineHeight: 1.3, color: '#7f1d1d' }}>
              The extracted spatial profile (Elevation: {stats.elevation}m, Moisture: {stats.soilMoisture} m³/m³) does not fall within optimal ranges for lowland swamp rice, cassava, oil palm, or consistent vegetables in Bomi County. Consider terracing, drainage trenches, or organic amendments to adjust moisture retention.
            </p>
          </div>
        )}
      </div>

      <div style={{ fontSize: '0.6rem', color: '#9ca3af', borderTop: '1px solid #eee', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '3px' }}>
        <Info size={10} /> Localized for Bomi County agro-ecological thresholds.
      </div>
    </div>
  );
}
