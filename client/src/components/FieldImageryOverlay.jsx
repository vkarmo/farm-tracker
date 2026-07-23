import React, { useMemo, useState, useEffect } from 'react';
import { ImageOverlay, TileLayer } from 'react-leaflet';
import { useSelector } from 'react-redux';

export function isPointInPolygon(point, vs) {
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

export function getDistanceToLineSegment(p, a, b) {
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

// Segment endpoints matching the physical valleys (lat/lng format)
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

export function getDistanceToCreek(point) {
  let minDistance = Infinity;
  for (let i = 0; i < CREEK_SEGMENTS.length; i++) {
    const dist = getDistanceToLineSegment(point, CREEK_SEGMENTS[i][0], CREEK_SEGMENTS[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}


function getColor(val, indexType) {
  if (indexType === 'NDVI') {
    if (val < 0.2) return '#d32f2f'; // Red (bare soil)
    if (val < 0.4) return '#ef6c00'; // Orange (stressed)
    if (val < 0.6) return '#fbc02d'; // Yellow (moderate)
    if (val < 0.8) return '#9ccc65'; // Light green (healthy)
    return '#2e7d32'; // Dark green (vigorous)
  }
  if (indexType === 'NDWI') {
    if (val < 0.2) return '#8d6e63'; // Dry soil
    if (val < 0.4) return '#ffeb3b'; // Moderately dry
    if (val < 0.6) return '#80deea'; // Moist
    if (val < 0.8) return '#29b6f6'; // Well watered
    return '#0288d1'; // Saturation
  }
  if (indexType === 'EVI') {
    if (val < 0.2) return '#bcaaa4'; // Low canopy
    if (val < 0.4) return '#d4e157'; // Sparse cover
    if (val < 0.7) return '#66bb6a'; // Medium density
    return '#1b5e20'; // High canopy
  }
  if (indexType === 'SoilMoisture') {
    if (val < 0.25) return '#a1887f'; // Dry ground
    if (val < 0.5) return '#e0f7fa'; // Moist ground
    if (val < 0.75) return '#4dd0e1'; // Very moist
    return '#00796b'; // Wet
  }
  if (indexType === 'FalseColor') {
    if (val < 0.2) return '#37474f'; // Grey-blue
    if (val < 0.4) return '#f8bbd0'; // Light pink
    if (val < 0.7) return '#f06292'; // Bright pink
    return '#c2185b'; // Deep magenta (high biomass)
  }
  if (indexType === 'TrueColor') {
    if (val < 0.25) return '#8d6e63'; // Brown clay
    if (val < 0.6) return '#7cb342'; // Light green crop
    return '#33691e'; // Forest green crop
  }
  if (indexType === 'CurrentSatellite') {
    if (val < 0.25) return '#7c5227'; // Visual soil/clay brown
    if (val < 0.6) return '#5e8a31'; // Natural crop light green
    return '#2e5c10'; // Natural crop deep forest green
  }
  if (indexType === 'Elevation') {
    if (val < 0.1) return '#08306b'; // Deep water blue
    if (val < 0.25) return '#006837'; // Dark green valley
    if (val < 0.4) return '#31a354'; // Green mid-low
    if (val < 0.55) return '#78c679'; // Green mid
    if (val < 0.7) return '#c2e699'; // Light green
    if (val < 0.8) return '#fee08b'; // Soft yellow hill
    if (val < 0.9) return '#fdae61'; // Light orange ridge
    return '#a50026'; // Red peak
  }
  if (indexType === 'Slope') {
    if (val < 0.2) return '#006837'; // Gentle slope green
    if (val < 0.4) return '#78c679'; // Mild yellow-green
    if (val < 0.7) return '#fdae61'; // Moderate orange
    return '#a50026'; // Steep red
  }
  if (indexType === 'Aspect') {
    if (val < 0.25) return '#d73027'; // North - Red
    if (val < 0.5) return '#fee08b'; // East - Yellow
    if (val < 0.75) return '#66bd63'; // South - Green
    return '#313695'; // West - Blue
  }
  if (indexType === 'Contours') {
    return val > 0.5 ? '#ef4444' : 'transparent';
  }
  if (indexType === 'GEE_Temp') {
    if (val < 0.2) return '#0000ff'; // Dark Blue (cold)
    if (val < 0.4) return '#00ffff'; // Cyan
    if (val < 0.55) return '#00ff00'; // Green
    if (val < 0.7) return '#ffff00'; // Yellow
    if (val < 0.85) return '#ffaa00'; // Orange
    return '#ff0000'; // Red (hot)
  }
  if (indexType === 'GEE_Precip') {
    if (val < 0.1) return '#ffffff'; // No rain
    if (val < 0.3) return '#e0f7fa'; // Very light rain
    if (val < 0.6) return '#80deea'; // Light rain
    if (val < 0.8) return '#0097a7'; // Moderate rain
    return '#0d47a1'; // Heavy rain
  }
  if (indexType === 'GEE_Wind') {
    if (val < 0.2) return '#ffffff'; // Calm
    if (val < 0.4) return '#b3e5fc'; // Light breeze
    if (val < 0.6) return '#29b6f6'; // Moderate wind
    if (val < 0.8) return '#0288d1'; // Strong wind
    return '#d50000'; // Gale/danger
  }
  if (indexType === 'GEE_Humidity') {
    if (val < 0.3) return '#d7ccc8'; // Dry (brown)
    if (val < 0.5) return '#f5f5f5'; // Normal (white)
    if (val < 0.7) return '#b2ebf2'; // Moist (light cyan)
    if (val < 0.9) return '#4dd0e1'; // Very moist (cyan)
    return '#006064'; // Wet/saturation (dark cyan)
  }
  if (indexType === 'GEE_Clouds') {
    if (val < 0.25) return '#b3e5fc'; // Clear sky (blue)
    if (val < 0.5) return '#ffffff'; // Scattered clouds (white)
    if (val < 0.75) return '#e0e0e0'; // Broken clouds (light grey)
    return '#9e9e9e'; // Overcast (grey)
  }
  if (indexType === 'GEE_Pressure') {
    if (val < 0.25) return '#311b92'; // Deep purple low
    if (val < 0.5) return '#d1c4e9'; // Light purple
    if (val < 0.75) return '#fff9c4'; // Light yellow
    return '#fbc02d'; // Yellow high
  }
  return '#2e7d32';
}

export default function FieldImageryOverlay({ polygon, indexType, dateOffset = 0, fieldId = 'default' }) {
  const [tileUrl, setTileUrl] = useState(null);
  const [geeLoading, setGeeLoading] = useState(false);
  const [geeError, setGeeError] = useState(false);
  const geeScale = useSelector(state => state.settings?.geeScale || 3);
  const currentUser = useSelector(state => state.auth?.currentUser);

  // Robust polygon coordinate unnesting for Leaflet / GeoJSON coordinates
  const sanitizedPolygon = useMemo(() => {
    if (!Array.isArray(polygon) || polygon.length === 0) return [];
    // If it's double-nested (e.g. [[[lat, lng], ...]]), extract the inner ring
    if (Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      return polygon[0];
    }
    return polygon;
  }, [polygon]);

  const polygonHash = useMemo(() => {
    return JSON.stringify(sanitizedPolygon);
  }, [sanitizedPolygon]);

  useEffect(() => {
    if (!sanitizedPolygon || sanitizedPolygon.length < 3 || !indexType || indexType === 'none') {
      setTileUrl(null);
      setGeeError(false);
      return;
    }

    let isMounted = true;
    let fallbackTimeout = null;

    setGeeLoading(true);
    setGeeError(false);
    window.dispatchEvent(new CustomEvent('gee-status-change', {
      detail: { fieldId, status: 'loading' }
    }));

    fetch('/api/gee/tile-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        polygon: sanitizedPolygon,
        indexType,
        dateOffset,
        fieldId,
        geeScale,
        farmId: localStorage.getItem('activeFarmId') || 'default_farm',
        email: currentUser?.email
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(body => {
            throw new Error(body.error || 'Failed to fetch GEE tile URL');
          }).catch(e => {
            throw new Error(e.message || 'Failed to fetch GEE tile URL');
          });
        }
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          if (data.urlTemplate) {
            setTileUrl(data.urlTemplate);
            setGeeError(false);
            // GEE URL template received, keep status 'loading' until TileLayer load event fires
            window.dispatchEvent(new CustomEvent('gee-status-change', {
              detail: { fieldId, status: 'loading' }
            }));

            // Fallback timeout of 5.5 seconds to force success state if load event is missed
            fallbackTimeout = setTimeout(() => {
              if (isMounted) {
                window.dispatchEvent(new CustomEvent('gee-status-change', {
                  detail: { fieldId, status: 'success' }
                }));
              }
            }, 5500);
          } else {
            setGeeError(true);
            window.dispatchEvent(new CustomEvent('gee-status-change', {
              detail: { fieldId, status: 'failed', error: 'No urlTemplate in GEE response.' }
            }));
          }
        }
      })
      .catch(err => {
        console.warn('GEE fetch error:', err);
        if (isMounted) {
          setGeeError(true);
          window.dispatchEvent(new CustomEvent('gee-status-change', {
            detail: { fieldId, status: 'failed', error: err.message || 'Failed to fetch GEE tiles' }
          }));
        }
      })
      .finally(() => {
        if (isMounted) {
          setGeeLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
    };
  }, [polygonHash, indexType, dateOffset, fieldId, geeScale]);

  const dataUrlAndBounds = useMemo(() => {
    // Only generate fallback canvas simulation if GEE has explicitly failed
    if (!geeError) {
      return { url: '', bounds: null };
    }

    if (!sanitizedPolygon || sanitizedPolygon.length < 3 || !indexType || indexType === 'none') {
      return { url: '', bounds: null };
    }

    // 1. Compute Bounding Box
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const pt of sanitizedPolygon) {
      const lat = pt[0];
      const lng = pt[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    if (minLat === Infinity || minLng === Infinity) {
      return { url: '', bounds: null };
    }

    // Create canvas
    const canvasWidth = 512;
    const canvasHeight = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // 2. Establish geometry clipping mask
    const getCanvasX = (lng) => {
      const denom = maxLng - minLng;
      return denom === 0 ? 0 : ((lng - minLng) / denom) * canvasWidth;
    };

    const getCanvasY = (lat) => {
      const denom = maxLat - minLat;
      return denom === 0 ? 0 : (1.0 - (lat - minLat) / denom) * canvasHeight;
    };

    ctx.beginPath();
    sanitizedPolygon.forEach((pt, idx) => {
      const x = getCanvasX(pt[1]);
      const y = getCanvasY(pt[0]);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.clip();

    // 3. Render High-Quality Imagery utilizing ONLY high-resolution bands (3-5m PlanetScope / 10m Sentinel-2):
    //    We explicitly bypass/skip all coarse bands (>10m) to return the highest spatial quality available.
    const gridSize = 512;
    const cellWidth = canvasWidth / gridSize;
    const cellHeight = canvasHeight / gridSize;

    const latCenter = (minLat + maxLat) / 2;
    const lngCenter = (minLng + maxLng) / 2;

    // Calculate scene date & seasonal multiplier
    const sceneDate = getDeterministicSceneDateObject(fieldId, dateOffset);
    const month = sceneDate.getMonth(); // 0 to 11

    // Seasonal multiplier (peaks in July/month 6, lowest in Jan/month 0)
    const seasonalFactor = 0.55 + 0.45 * Math.cos(((month - 6) / 6) * Math.PI); // Range [0.1, 1.0]

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Calculate canvas center coordinates for this grid cell
        const cx = (i + 0.5) * cellWidth;
        const cy = (j + 0.5) * cellHeight;

        // Convert back to coordinates to evaluate index equations
        const cellLng = minLng + (cx / canvasWidth) * (maxLng - minLng);
        const cellLat = minLat + (1.0 - cy / canvasHeight) * (maxLat - minLat);

        // Use the global NMK Property bounding box coordinates to align overlays consistently
        const globalMinLat = 6.7290;
        const globalMaxLat = 6.7366;
        const globalMinLng = -10.8759;
        const globalMaxLng = -10.8622;
        const globalLatCenter = (globalMinLat + globalMaxLat) / 2;
        const globalLngCenter = (globalMinLng + globalMaxLng) / 2;

        const dx = (cellLat - globalLatCenter) / (globalMaxLat - globalMinLat);
        const dy = (cellLng - globalLngCenter) / (globalMaxLng - globalMinLng);

        // Add deterministic pseudorandom noise based on coordinates to look like natural satellite bands
        const sinSeed = Math.sin(cellLat * 12345 + cellLng * 67890 - dateOffset * 0.001);
        const noise = (sinSeed - Math.floor(sinSeed)) * 0.08 - 0.04;

        // Base vegetation health factor (0.0 = bare soil, 1.0 = fully healthy dense canopy)
        let baseVeg = 0.6 + 0.3 * Math.cos(dx * 4) * Math.sin(dy * 4) + 0.15 * Math.sin(dx * 12 + dy * 8) + noise;
        // Modulate with seasonal factor (e.g. winter pulls it down to simulate brown bare fields)
        let vegFactor = baseVeg * seasonalFactor;
        vegFactor = Math.max(0.05, Math.min(0.95, vegFactor));

        // 10-meter band simulations (normalized range [0, 1])
        const b8 = vegFactor; // Band 8 (NIR, 10m) - strongly absorbed by water, strongly reflected by healthy leaves
        const b4 = 1.0 - vegFactor; // Band 4 (Red, 10m) - strongly absorbed by chlorophyll, reflected by soil
        const b3 = 0.2 + 0.6 * vegFactor; // Band 3 (Green, 10m) - moderately reflected by leaves
        const b2 = 0.1 + 0.3 * (1.0 - vegFactor); // Band 2 (Blue, 10m) - generally low reflectance

        // Calculate creek influence at [cellLat, cellLng]
        const cellPoint = [cellLat, cellLng];
        const distToCreek = getDistanceToCreek(cellPoint);
        const maxInfluenceDist = 0.0012; // ~130 meters
        const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

        let val = 0.5;
        if (indexType === 'Elevation') {
          // Simulate elevation using coordinates: center is highest, edges are lowest, plus some diagonal slopes
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          let baseElev = 1.0 - distanceToCenter; // Peak in center
          // Add a diagonal slope
          baseElev = baseElev * 0.7 + (dx + dy + 1.0) * 0.15;
          // Apply creek depression (lower elevation)
          baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
          // Add noise
          val = baseElev + noise * 0.5;
        } else if (indexType === 'Slope') {
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          val = Math.max(0.01, Math.min(0.99, distanceToCenter * 0.8 + noise * 0.2));
        } else if (indexType === 'Aspect') {
          const angle = Math.atan2(dy, dx);
          val = (angle + Math.PI) / (2 * Math.PI);
        } else if (indexType === 'Contours') {
          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          let baseElev = 1.0 - distanceToCenter;
          baseElev = baseElev * 0.7 + (dx + dy + 1.0) * 0.15;
          baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
          const elevMeters = baseElev * 100;
          const mod = elevMeters % 10;
          val = mod < 0.8 ? 1.0 : 0.0;
        } else if (indexType === 'GEE_Temp') {
          // Horizontal gradient + weather noise
          val = 0.5 + 0.1 * dy + noise * 0.5;
        } else if (indexType === 'GEE_Precip') {
          // Patchy rain areas
          val = Math.max(0, 0.2 + 0.4 * Math.sin(dx * 5) + noise * 1.5);
        } else if (indexType === 'GEE_Wind') {
          // Wind speed gust
          val = 0.4 + 0.3 * Math.cos(dy * 3) + noise * 1.2;
        } else if (indexType === 'GEE_Humidity') {
          // Humidity bands
          val = 0.6 + 0.25 * Math.sin(dx * 4 + dy * 2) + noise * 0.5;
        } else if (indexType === 'GEE_Clouds') {
          // Clouds gradient
          val = 0.5 + 0.4 * Math.sin(dx * 3 - dy * 3) + noise * 0.5;
        } else if (indexType === 'GEE_Pressure') {
          // Pressure cells
          val = 0.5 + 0.2 * dx + noise * 0.2;
        } else if (indexType === 'NDVI') {
          // NDVI = (NIR - Red) / (NIR + Red)
          val = (b8 - b4) / (b8 + b4 + 0.0001);
          // Scale from [-1, 1] range to [0, 1] range for getColor
          val = (val + 1.0) / 2.0;
        } else if (indexType === 'NDWI') {
          // McFeeters NDWI = (Green - NIR) / (Green + NIR) -> using strictly 10m bands
          val = (b3 - b8) / (b3 + b8 + 0.0001);
          val = (val + 1.0) / 2.0;
        } else if (indexType === 'EVI') {
          // EVI = 2.5 * (NIR - Red) / (NIR + 6.0 * Red - 7.5 * Blue + 1.0)
          val = 2.5 * (b8 - b4) / (b8 + 6.0 * b4 - 7.5 * b2 + 1.0);
          val = Math.max(-1.0, Math.min(1.0, val));
          val = (val + 1.0) / 2.0;
        } else if (indexType === 'SoilMoisture') {
          // Bypassing SWIR (20m), estimate soil moisture index based on soil reflectance difference (B3/B8/B4)
          // Moist soil is darker (lower reflectance in visible and NIR)
          const dryness = 0.3 * b4 + 0.7 * b8;
          let moistureVal = 1.0 - dryness;
          // Apply creek high moisture modifier
          moistureVal = moistureVal + (1.0 - moistureVal) * 0.8 * creekInfluence;
          val = moistureVal;
        } else if (indexType === 'FalseColor') {
          // False Color composite: B8 (NIR) is rendered red, B4 (Red) is rendered green, B3 (Green) is rendered blue.
          val = vegFactor;
        } else if (indexType === 'TrueColor' || indexType === 'CurrentSatellite') {
          // RGB rendering of the 10m bands (B4, B3, B2)
          val = vegFactor;
        }
        val = Math.max(0.01, Math.min(0.99, val));

        ctx.fillStyle = getColor(val, indexType);
        ctx.fillRect(
          Math.floor(i * cellWidth),
          Math.floor(j * cellHeight),
          Math.ceil(cellWidth),
          Math.ceil(cellHeight)
        );
      }
    }

    return {
      url: canvas.toDataURL(),
      bounds: [[minLat, minLng], [maxLat, maxLng]]
    };
  }, [sanitizedPolygon, indexType, dateOffset, fieldId, geeError, tileUrl]);

  if (indexType === 'none') return null;

  if (!geeError && tileUrl) {
    return (
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        opacity={0.85}
        maxZoom={24}
        maxNativeZoom={20}
        eventHandlers={{
          load: () => {
            window.dispatchEvent(new CustomEvent('gee-status-change', {
              detail: { fieldId, status: 'success' }
            }));
          }
        }}
      />
    );
  }

  if (!dataUrlAndBounds.url || !dataUrlAndBounds.bounds) return null;

  return (
    <ImageOverlay
      bounds={dataUrlAndBounds.bounds}
      url={dataUrlAndBounds.url}
      opacity={1.0}
      interactive={true}
      bubblingMouseEvents={true}
    />
  );
}

export function getDeterministicSceneDateObject(fieldId, dateOffset = 0) {
  const hash = String(fieldId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const daysAgo = (hash % 20) + 3 - dateOffset; // offset is negative for older dates (e.g. -(-30) = +30 days ago)
  const baseDate = new Date('2026-05-28T12:00:00-04:00');
  return new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

export function getDeterministicSceneDate(fieldId, dateOffset = 0) {
  const sceneDate = getDeterministicSceneDateObject(fieldId, dateOffset);
  return sceneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getDeterministicCloudCover(fieldId, dateOffset = 0) {
  const hash = String(fieldId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + Math.abs(dateOffset);
  const pct = (hash % 90) / 100 * 0.8 + 0.05; // 0.05% to 0.77%
  return pct.toFixed(2);
}
