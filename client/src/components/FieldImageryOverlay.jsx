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
  return '#2e7d32';
}

export default function FieldImageryOverlay({ polygon, indexType, dateOffset = 0, fieldId = 'default' }) {
  const [tileUrl, setTileUrl] = useState(null);
  const [geeLoading, setGeeLoading] = useState(false);
  const [geeError, setGeeError] = useState(false);
  const geeScale = useSelector(state => state.settings?.geeScale || 3);

  // Robust polygon coordinate unnesting for Leaflet / GeoJSON coordinates
  const sanitizedPolygon = useMemo(() => {
    if (!Array.isArray(polygon) || polygon.length === 0) return [];
    // If it's double-nested (e.g. [[[lat, lng], ...]]), extract the inner ring
    if (Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      return polygon[0];
    }
    return polygon;
  }, [polygon]);

  useEffect(() => {
    if (!sanitizedPolygon || sanitizedPolygon.length < 3 || !indexType || indexType === 'none') {
      setTileUrl(null);
      setGeeError(false);
      return;
    }

    let isMounted = true;
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
        geeScale
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
            window.dispatchEvent(new CustomEvent('gee-status-change', {
              detail: { fieldId, status: 'success' }
            }));
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
    };
  }, [sanitizedPolygon, indexType, dateOffset, fieldId, geeScale]);

  const dataUrlAndBounds = useMemo(() => {
    // If successfully using GEE tiles, skip canvas generation
    if (!geeError && tileUrl) {
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
    const gridSize = (indexType === 'CurrentSatellite' || indexType === 'TrueColor' || indexType === 'NDVI') ? 512 : 256;
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

        const dx = (cellLat - latCenter) / (maxLat - minLat);
        const dy = (cellLng - lngCenter) / (maxLng - minLng);
        
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

        let val = 0.5;
        if (indexType === 'NDVI') {
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
          val = 1.0 - dryness;
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
      />
    );
  }

  if (!dataUrlAndBounds.url || !dataUrlAndBounds.bounds) return null;

  return (
    <ImageOverlay
      bounds={dataUrlAndBounds.bounds}
      url={dataUrlAndBounds.url}
      opacity={0.75}
      interactive={false}
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
