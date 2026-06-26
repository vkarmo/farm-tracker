import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MapContainer, TileLayer, Polygon, Polyline, Popup, GeoJSON, Marker, useMap, SVGOverlay } from 'react-leaflet';
import { fetchGeoLocationInfo } from './components/PoiTab';
import { parseStructuredData, getReportStructuredData } from './components/RecommendationViewer';
import FieldImageryOverlay, { getDeterministicSceneDate, getDeterministicCloudCover, isPointInPolygon, getDistanceToCreek } from './components/FieldImageryOverlay';
import CropRecommendationPanel, { extractSpatialStats } from './components/CropRecommendationPanel';
import { MapResizer } from './components/ResizableMapWrapper';
import { setMapCenter, setVisibleMapLayers, saveSettings } from './store/settingsSlice';
import { addPoi } from './store/poiSlice';
import { updateField } from './store/fieldsSlice';
import { queueAction } from './store/syncSlice';
import { kml } from '@tmcw/togeojson';
import L from 'leaflet';
import { CurrentLocationButton, MapFlyTo } from './components/MapSearchBox';
import { Tractor, Sliders, X, Sun, Cloud, CloudRain, Wind, Thermometer, Droplet, Clock, AlertTriangle, ShieldCheck, AlertCircle, Info, ChevronDown, ChevronUp, Compass } from 'lucide-react';
import Select from 'react-select';

// Create a custom orange icon for Hard Assets
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create a custom brown icon for Soil Tests
const brownIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
import 'leaflet/dist/leaflet.css';

const MapEventsHelper = ({ setMapInstance }) => {
  const map = useMap();
  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);
  return null;
};

const LAYER_OPTIONS = [
  { value: 'fields', label: 'Fields' },
  { value: 'nurseries', label: 'Nurseries' },
  { value: 'pois', label: 'Points of Interest' },
  { value: 'equipment', label: 'Hard Assets' },
  { value: 'soilTests', label: 'Soil Tests' }
];

const rotatePoint = (x, y, angle, cx = 50, cy = 50) => {
  if (!angle) return { x, y };
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = cx + (x - cx) * cos - (y - cy) * sin;
  const ry = cy + (x - cx) * sin + (y - cy) * cos;
  return { x: rx, y: ry };
};

const FieldLayoutMapOverlay = ({ field, recommendations, selectedRecId }) => {
  const dispatch = useDispatch();
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const pois = useSelector(state => state.poi?.list) || [];

  useEffect(() => {
    const handleZoomEnd = () => {
      setZoom(map.getZoom());
    };
    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);
  const sanitizedPolygon = useMemo(() => {
    if (!field || !field.polygon) return [];
    let poly = field.polygon;
    if (typeof poly === 'string') {
      try {
        poly = JSON.parse(poly);
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(poly) && poly.length > 0) {
      if (Array.isArray(poly[0]) && Array.isArray(poly[0][0])) {
        return poly[0];
      }
      return poly;
    }
    return [];
  }, [field]);

  const bounds = useMemo(() => {
    if (sanitizedPolygon.length < 3) return null;
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
    return [[minLat, minLng], [maxLat, maxLng]];
  }, [sanitizedPolygon]);

  // Extract spatial stats to check elevation profile
  const stats = useMemo(() => {
    if (sanitizedPolygon.length < 3) return { elevation: 120, soilMoisture: 0.28 };
    try {
      return extractSpatialStats(sanitizedPolygon);
    } catch (e) {
      return { elevation: 120, soilMoisture: 0.28 };
    }
  }, [sanitizedPolygon]);

  // Only use curved contour farming if elevation is steep (>= 180m)
  const curveDepth = useMemo(() => {
    return stats.elevation >= 180 ? 1.2 : 0.0;
  }, [stats.elevation]);

  // Get rotation angle: if not set in field properties, auto-calculate to align with the longest dimension of the polygon
  const rotationAngle = useMemo(() => {
    if (field.layoutRotation !== undefined && field.layoutRotation !== null && field.layoutRotation !== '') {
      return parseInt(field.layoutRotation);
    }
    
    // Auto-calculate the angle of the longest axis
    if (sanitizedPolygon.length < 3 || !bounds) return 0;
    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    const svgVertices = sanitizedPolygon.map(pt => {
      const x = ((pt[1] - minLng) / (maxLng - minLng)) * 100;
      const y = (1.0 - (pt[0] - minLat) / (maxLat - minLat)) * 100;
      return { x, y };
    });

    let maxDist = -1;
    let bestPair = null;
    for (let i = 0; i < svgVertices.length; i++) {
      for (let j = i + 1; j < svgVertices.length; j++) {
        const dist = Math.hypot(svgVertices[i].x - svgVertices[j].x, svgVertices[i].y - svgVertices[j].y);
        if (dist > maxDist) {
          maxDist = dist;
          bestPair = [svgVertices[i], svgVertices[j]];
        }
      }
    }

    if (bestPair) {
      const dx = bestPair[1].x - bestPair[0].x;
      const dy = bestPair[1].y - bestPair[0].y;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      // Bring angle to range [0, 180]
      if (angle < 0) angle += 180;
      return Math.round(angle);
    }
    return 0;
  }, [field.layoutRotation, sanitizedPolygon, bounds]);

  // Compute the bounding box of the polygon inside the rotated frame
  const rotatedBounds = useMemo(() => {
    if (sanitizedPolygon.length < 3 || !bounds) {
      return { minX: 4, maxX: 96, minY: 4, maxY: 96 };
    }
    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    
    const svgPts = sanitizedPolygon.map(pt => {
      const x = ((pt[1] - minLng) / (maxLng - minLng)) * 100;
      const y = (1.0 - (pt[0] - minLat) / (maxLat - minLat)) * 100;
      return { x, y };
    });

    const rad = (-rotationAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    svgPts.forEach(pt => {
      // Rotate around the center (50, 50)
      const rx = 50 + (pt.x - 50) * cos - (pt.y - 50) * sin;
      const ry = 50 + (pt.x - 50) * sin + (pt.y - 50) * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    });

    // Add a tiny buffer (e.g. 0.5%) so elements don't get clipped exactly at the stroke boundaries
    return {
      minX: Math.max(0.0, minX + 0.5),
      maxX: Math.min(100.0, maxX - 0.5),
      minY: Math.max(0.0, minY + 0.5),
      maxY: Math.min(100.0, maxY - 0.5)
    };
  }, [sanitizedPolygon, bounds, rotationAngle]);

  // Dynamically calculate the highest elevation point inside the polygon for the kitchen area (rotated frame aware)
  const kitchenPos = useMemo(() => {
    if (sanitizedPolygon.length < 3 || !bounds) {
      return { x: 84, y: 11, radius: 4.0 };
    }
    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    
    let maxElev = -Infinity;
    let bestX = 50;
    let bestY = 50;

    const rad = (rotationAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Sample a 15x15 grid within standard bounds, transforming each candidate to final space
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const x = (i / steps) * 100;
        const y = (j / steps) * 100;
        
        // Transformed (rotated) screen coordinate
        const rx = 50 + (x - 50) * cos - (y - 50) * sin;
        const ry = 50 + (x - 50) * sin + (y - 50) * cos;
        
        const lng = minLng + (rx / 100) * (maxLng - minLng);
        const lat = minLat + (1.0 - ry / 100) * (maxLat - minLat);
        
        if (isPointInPolygon([lat, lng], sanitizedPolygon)) {
          // Calculate simulated elevation at [lat, lng]
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

          const distToCreek = getDistanceToCreek([lat, lng]);
          const maxInfluenceDist = 0.0012;
          const creekInfluence = Math.max(0, 1.0 - distToCreek / maxInfluenceDist);

          const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
          let baseElev = 1.0 - distanceToCenter;
          baseElev = baseElev * 0.7 + (dx + dy + 1.0) * 0.15;
          baseElev = baseElev * (1.0 - 0.75 * creekInfluence);
          let elevVal = baseElev + noise * 0.5;
          elevVal = Math.max(0.01, Math.min(0.99, elevVal));
          const elevMeters = 50 + elevVal * 200;
          
          if (elevMeters > maxElev) {
            maxElev = elevMeters;
            bestX = x;
            bestY = y;
          }
        }
      }
    }
    
    // Scale kitchen area
    const fieldArea = field.area || 5.0;
    const targetAreaUnits = (0.0625 / fieldArea) * 10000;
    const computedR = Math.sqrt(targetAreaUnits / Math.PI);
    const radius = Math.max(3.5, Math.min(10.0, computedR));
    
    return { x: bestX, y: bestY, radius };
  }, [sanitizedPolygon, bounds, field.area, rotationAngle]);

  const layoutData = useMemo(() => {
    if (!field) return null;
    const linkedIds = field.recommendationIds || [];
    const linkedAiRecs = (recommendations || []).filter(r => r.isAI && linkedIds.includes(r.id));
    
    let report = null;
    if (selectedRecId) {
      report = linkedAiRecs.find(r => r.id === selectedRecId);
    }
    if (!report && linkedAiRecs.length > 0) {
      report = [...linkedAiRecs].sort((a, b) => b.createdAt - a.createdAt)[0];
    }

    if (report) {
      const structuredData = getReportStructuredData(report, field.area || 5, report.promptInputs?.selectedCrops || '', pois, field);
      return structuredData?.fieldLayout;
    }
    
    // Do not generate fallback crop layout if no recommendation was generated
    return null;
  }, [field, recommendations, selectedRecId, pois]);

  // Helper to check if a percentage SVG coordinate is inside the field polygon
  const isSvgPointInPolygon = useCallback((px, py) => {
    if (sanitizedPolygon.length < 3 || !bounds) return false;
    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    const lng = minLng + (px / 100) * (maxLng - minLng);
    const lat = minLat + (1.0 - py / 100) * (maxLat - minLat);
    return isPointInPolygon([lat, lng], sanitizedPolygon);
  }, [sanitizedPolygon, bounds]);

  if (!bounds || !layoutData) return null;

  const [[minLat, minLng], [maxLat, maxLng]] = bounds;

  // Convert polygon coordinates to SVG percentage points (0 to 100)
  const pointsStr = sanitizedPolygon.map(pt => {
    const x = ((pt[1] - minLng) / (maxLng - minLng)) * 100;
    const y = (1.0 - (pt[0] - minLat) / (maxLat - minLat)) * 100;
    return `${x},${y}`;
  }).join(' ');

  const { rows = 10, bedsPerRow = 4, cropAssignments = [] } = layoutData;

  // Crop beds grid placement limits (dynamically scaled to fit rotated bounds)
  const gridMinX = rotatedBounds.minX;
  const gridMaxX = rotatedBounds.maxX;
  const gridMinY = rotatedBounds.minY;
  const gridMaxY = rotatedBounds.maxY;

  const gridWidth = gridMaxX - gridMinX;
  const gridHeight = gridMaxY - gridMinY;

  const rowHeight = gridHeight / rows;

  // Position compost and ash pits dynamically to avoid the kitchen area
  const shiftPitsRight = kitchenPos.x < 50;
  const pitCenterX = shiftPitsRight ? 84 : 16;

  // Dynamically scale compost and ash pits so they collectively occupy exactly 1/4 of a lot (matching the kitchen area).
  const compostWidth = kitchenPos.radius * 1.77;
  const compostHeight = kitchenPos.radius * 1.18;
  const ashRadius = kitchenPos.radius * 0.577;

  const compostX = pitCenterX - compostWidth / 2;
  const ashX = pitCenterX;

  // Place compost pit above kitchen's Y-coordinate and ash pit below it on the opposite side of the field
  let compostY = kitchenPos.y - compostHeight - 2.0;
  let ashY = kitchenPos.y + kitchenPos.radius + 2.0;

  // Prevent shifting out of field bounds vertically
  if (compostY < 6) {
    const diff = 6 - compostY;
    compostY += diff;
    ashY += diff;
  }
  if (ashY > 94 - ashRadius) {
    const diff = ashY - (94 - ashRadius);
    compostY -= diff;
    ashY -= diff;
  }

  // Safe clamps to guarantee bounding box fits within [4, 96]
  compostY = Math.max(4, Math.min(96 - compostHeight, compostY));
  ashY = Math.max(ashRadius + 4, Math.min(96 - ashRadius, ashY));

  // Designate the middle row as the horizontal walkway
  const horizontalWalkwayRow = Math.floor(rows / 2);
  const horizontalWalkwayRowY = gridMinY + horizontalWalkwayRow * rowHeight + rowHeight / 2;

  // Generate curved horizontal walkway path line
  const horizontalWalkwayPoints = [];
  for (let i = 0; i <= 16; i++) {
    const pct = i / 16;
    const px = gridMinX + pct * gridWidth;
    const py = horizontalWalkwayRowY + curveDepth * Math.sin(pct * Math.PI);
    horizontalWalkwayPoints.push(`${px},${py}`);
  }
  const horizontalWalkwayD = `M ${horizontalWalkwayPoints.join(' L ')}`;

  // Vertical walkway line down the center
  const verticalWalkwayX = gridMinX + gridWidth / 2;

  // Contiguous crop zones will be rendered directly from cropAssignments

  // Generate parallel contour terrace walkway paths, cutting holes through kitchen and pit zones
  const terraceWalkways = [];
  for (let r = 0; r <= rows; r++) {
    const yBase = gridMinY + r * rowHeight;
    let pathD = '';
    const segments = 16;
    let isDrawing = false;
    for (let i = 0; i <= segments; i++) {
      const pct = i / segments;
      const px = gridMinX + pct * gridWidth;
      const py = yBase + curveDepth * Math.sin(pct * Math.PI);
      const distToKitchen = Math.hypot(px - kitchenPos.x, py - kitchenPos.y);
      const distToAsh = Math.hypot(px - ashX, py - ashY);
      
      const inKitchenZone = distToKitchen < kitchenPos.radius + 1.0;
      const inCompostZone = px >= compostX - 1.0 && px <= compostX + compostWidth + 1.0 && py >= compostY - 1.0 && py <= compostY + compostHeight + 1.0;
      const inAshZone = distToAsh < ashRadius + 1.0;

      if (inKitchenZone || inCompostZone || inAshZone) {
        isDrawing = false;
      } else {
        if (!isDrawing) {
          pathD += ` M ${px},${py}`;
          isDrawing = true;
        } else {
          pathD += ` L ${px},${py}`;
        }
      }
    }
    if (pathD.trim()) {
      terraceWalkways.push(pathD);
    }
  }

  const clipPathId = `field-clip-${field.id}`;

  const kitchenBuildingRadius = kitchenPos.radius * 0.45;
  const vegBedWidth = kitchenPos.radius * 0.7;
  const vegBedHeight = kitchenPos.radius * 0.3;
  const vegBedX = kitchenPos.x - kitchenPos.radius * 0.9;
  const vegBedY = kitchenPos.y - kitchenPos.radius * 0.55;
  
  const herbBedWidth = kitchenPos.radius * 0.7;
  const herbBedHeight = kitchenPos.radius * 0.3;
  const herbBedX = kitchenPos.x - kitchenPos.radius * 0.9;
  const herbBedY = kitchenPos.y + kitchenPos.radius * 0.25;

  const needsFlip = rotationAngle > 90 && rotationAngle < 270;

  return (
    <SVGOverlay key={`${field.id}_zoom_${zoom}_rot_${rotationAngle}`} bounds={bounds} viewBox="0 0 100 100">
      <defs>
        <clipPath id={clipPathId}>
          <polygon points={pointsStr} />
        </clipPath>
      </defs>
      
      {/* Clip everything to the irregular field polygon bounds */}
      <g clipPath={`url(#${clipPathId})`}>
        {/* Underlay representing soil / general field ground */}
        <rect x="0" y="0" width="100" height="100" fill="#5d4037" opacity="0.35" />
        
        {/* Wrap elements in rotated group to align layout grid to field */}
        <g transform={`rotate(${rotationAngle}, 50, 50)`}>
          {/* Draw terrace contour walkway lines between rows */}
          {terraceWalkways.map((wPath, idx) => (
            <path
              key={`walkway_${idx}`}
              d={wPath}
              fill="none"
              stroke="#d7ccc8"
              strokeWidth="1.2"
              opacity="0.65"
            />
          ))}
          
          {/* Main Vertical Walkway down the center */}
          <line 
            x1={verticalWalkwayX} 
            y1={gridMinY} 
            x2={verticalWalkwayX} 
            y2={gridMaxY} 
            stroke="#d7ccc8" 
            strokeWidth="1.5" 
            strokeDasharray="2 2" 
            opacity="0.75" 
          />

          {/* Main Horizontal Walkway through the center */}
          <path 
            d={horizontalWalkwayD} 
            fill="none" 
            stroke="#d7ccc8" 
            strokeWidth="1.5" 
            strokeDasharray="2 2" 
            opacity="0.75" 
          />

          {/* Walkways tracks (Stepping stones paths) */}
          {/* Main path from kitchen center to central vertical walkway */}
          <line 
            x1={kitchenPos.x} 
            y1={kitchenPos.y} 
            x2={verticalWalkwayX} 
            y2={kitchenPos.y} 
            stroke="#8d6e63" 
            strokeWidth="1.2" 
            strokeDasharray="1 1" 
          />
          {/* Main path from compost pit center to central vertical walkway */}
          <line 
            x1={compostX + compostWidth / 2} 
            y1={compostY + compostHeight / 2} 
            x2={verticalWalkwayX} 
            y2={compostY + compostHeight / 2} 
            stroke="#8d6e63" 
            strokeWidth="1.2" 
            strokeDasharray="1 1" 
          />
          
          {/* Draw Contiguous Crop Zones within field boundary */}
          {cropAssignments.map((a, idx) => {
            const zoneY = gridMinY + a.startRow * rowHeight;
            const zoneHeight = (a.endRow - a.startRow + 1) * rowHeight;
            const zoneX = gridMinX - 10;
            const zoneWidth = gridWidth + 20;
            const centerY = zoneY + zoneHeight / 2;
            const centerX = gridMinX + gridWidth / 2;

            return (
              <g key={`crop_zone_${idx}`}>
                <rect
                  x={zoneX}
                  y={zoneY}
                  width={zoneWidth}
                  height={zoneHeight}
                  fill={a.color}
                  opacity={0.85}
                  stroke="#1b5e20"
                  strokeWidth={0.2}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${a.crop} Zone\nRows ${a.startRow + 1} to ${a.endRow + 1}`}</title>
                </rect>
                <text
                  x={centerX}
                  y={centerY + 0.8}
                  fill="#ffffff"
                  fontSize="2.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  transform={needsFlip ? `rotate(180, ${centerX}, ${centerY + 0.8})` : undefined}
                  style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0.8px 0.8px 1.5px rgba(0,0,0,0.9)' }}
                >
                  {a.crop}
                </text>
              </g>
            );
          })}

          {/* Dividing lines between zones */}
          {cropAssignments.map((a, idx) => {
            if (idx === cropAssignments.length - 1) return null;
            const y_line = gridMinY + (a.endRow + 1) * rowHeight;
            const zoneX = gridMinX - 10;
            const zoneWidth = gridWidth + 20;
            return (
              <line
                key={`div_line_${idx}`}
                x1={zoneX}
                y1={y_line}
                x2={zoneX + zoneWidth}
                y2={y_line}
                stroke="#1b5e20"
                strokeWidth={0.4}
                strokeDasharray="1.5 1.5"
                opacity={0.8}
              />
            );
          })}

          {/* THATCH KITCHEN: Sized dynamically to 1/4 of a lot and placed at highest elevation */}
          <g>
            {/* Thatch roof circular base */}
            <circle cx={kitchenPos.x} cy={kitchenPos.y} r={kitchenBuildingRadius} fill="#d7ccc8" stroke="#8d6e63" strokeWidth="0.6" />
            {/* Roof thatch radial lines */}
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x} y2={kitchenPos.y - kitchenBuildingRadius} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x} y2={kitchenPos.y + kitchenBuildingRadius} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x - kitchenBuildingRadius} y2={kitchenPos.y} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x + kitchenBuildingRadius} y2={kitchenPos.y} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x - kitchenBuildingRadius * 0.7} y2={kitchenPos.y - kitchenBuildingRadius * 0.7} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x + kitchenBuildingRadius * 0.7} y2={kitchenPos.y + kitchenBuildingRadius * 0.7} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x - kitchenBuildingRadius * 0.7} y2={kitchenPos.y + kitchenBuildingRadius * 0.7} stroke="#a1887f" strokeWidth="0.3" />
            <line x1={kitchenPos.x} y1={kitchenPos.y} x2={kitchenPos.x + kitchenBuildingRadius * 0.7} y2={kitchenPos.y - kitchenBuildingRadius * 0.7} stroke="#a1887f" strokeWidth="0.3" />
            {/* Smoke outlet central chimney */}
            <circle cx={kitchenPos.x} cy={kitchenPos.y} r={kitchenBuildingRadius * 0.15} fill="#3e2723" />
            {/* Text Label */}
            <text 
              x={kitchenPos.x} 
              y={kitchenPos.y + kitchenBuildingRadius + 2.0} 
              fill="#ffffff" 
              fontSize="1.8" 
              fontWeight="bold" 
              textAnchor="middle" 
              transform={needsFlip ? `rotate(180, ${kitchenPos.x}, ${kitchenPos.y + kitchenBuildingRadius + 2.0})` : undefined}
              style={{ textShadow: '0.8px 0.8px 1.5px rgba(0,0,0,0.9)' }}
            >
              Kitchen
            </text>
          </g>

          {/* Small crop area surrounding the kitchen */}
          <g>
            {/* Small vegetable garden bed to the left of the kitchen */}
            <rect x={vegBedX} y={vegBedY} width={vegBedWidth} height={vegBedHeight} rx="0.5" fill="#4fc3f7" opacity="0.85" />
            <text 
              x={vegBedX + vegBedWidth / 2} 
              y={vegBedY + vegBedHeight / 2 + 0.6} 
              fill="#ffffff" 
              fontSize="1.4" 
              fontWeight="bold" 
              textAnchor="middle" 
              transform={needsFlip ? `rotate(180, ${vegBedX + vegBedWidth / 2}, ${vegBedY + vegBedHeight / 2 + 0.6})` : undefined}
              style={{ textShadow: '0.4px 0.4px 0.8px rgba(0,0,0,0.8)' }}
            >
              Veg
            </text>
            {/* Small herb garden bed below the kitchen */}
            <rect x={herbBedX} y={herbBedY} width={herbBedWidth} height={herbBedHeight} rx="0.5" fill="#ec407a" opacity="0.85" />
            <text 
              x={herbBedX + herbBedWidth / 2} 
              y={herbBedY + herbBedHeight / 2 + 0.6} 
              fill="#ffffff" 
              fontSize="1.4" 
              fontWeight="bold" 
              textAnchor="middle" 
              transform={needsFlip ? `rotate(180, ${herbBedX + herbBedWidth / 2}, ${herbBedY + herbBedHeight / 2 + 0.6})` : undefined}
              style={{ textShadow: '0.4px 0.4px 0.8px rgba(0,0,0,0.8)' }}
            >
              Herb
            </text>
          </g>

          {/* COMPOST PIT: Sized down slightly, adjacent to field (upper left or right area) */}
          <g>
            <rect x={compostX} y={compostY} width={compostWidth} height={compostHeight} rx="1.0" fill="#4e342e" stroke="#5d4037" strokeWidth="0.6" />
            <circle cx={compostX + compostWidth * 0.15} cy={compostY + compostHeight * 0.3} r="0.5" fill="#4caf50" opacity="0.7" />
            <circle cx={compostX + compostWidth * 0.8} cy={compostY + compostHeight * 0.7} r="0.4" fill="#81c784" opacity="0.7" />
            <circle cx={compostX + compostWidth * 0.5} cy={compostY + compostHeight * 0.45} r="0.5" fill="#2e7d32" opacity="0.6" />
            <text 
              x={compostX + compostWidth / 2} 
              y={compostY + compostHeight / 2 + 1.0} 
              fill="#ffffff" 
              fontSize="1.8" 
              fontWeight="bold" 
              textAnchor="middle" 
              transform={needsFlip ? `rotate(180, ${compostX + compostWidth / 2}, ${compostY + compostHeight / 2 + 1.0})` : undefined}
              style={{ textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.8)' }}
            >
              Compost
            </text>
          </g>

          {/* ASH PIT: Sized down, adjacent to field */}
          <g>
            <circle cx={ashX} cy={ashY} r={ashRadius} fill="#9e9e9e" stroke="#757575" strokeWidth="0.6" />
            <circle cx={ashX - ashRadius * 0.43} cy={ashY - ashRadius * 0.29} r="0.5" fill="#e0e0e0" opacity="0.8" />
            <circle cx={ashX + ashRadius * 0.43} cy={ashY + ashRadius * 0.29} r="0.4" fill="#757575" opacity="0.6" />
            <text 
              x={ashX} 
              y={ashY + ashRadius * 0.2} 
              fill="#ffffff" 
              fontSize="1.8" 
              fontWeight="bold" 
              textAnchor="middle" 
              transform={needsFlip ? `rotate(180, ${ashX}, ${ashY + ashRadius * 0.2})` : undefined}
              style={{ textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.8)' }}
            >
              Ash
            </text>
          </g>
        </g>
      </g>
      {/* Legend showing sublist of actual recommended layout crops directly on the overlay */}
      {cropAssignments && cropAssignments.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x="5" y="1" width="90" height="5" rx="1" fill="rgba(0,0,0,0.65)" />
          <g transform="translate(8, 2.5)">
            {cropAssignments.map((ass, idx) => {
              const cropName = ass.crop || 'Unassigned';
              return (
                <g key={idx} transform={`translate(${idx * (80 / cropAssignments.length)}, 1.2)`}>
                  <rect x="0" y="-1.2" width="2.2" height="2.2" rx="0.5" fill={ass.color} />
                  <text x="3.2" y="0.5" fill="#ffffff" fontSize="1.8" fontWeight="bold">
                    {cropName.length > 10 ? `${cropName.substring(0, 9)}.` : cropName}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      )}
    </SVGOverlay>
  );
};

const MapLayer = ({ fields, nurseries = [], equipment = [] }) => {
  const dispatch = useDispatch();
  const [mapInstance, setMapInstance] = useState(null);
  const [loadingWaterway, setLoadingWaterway] = useState(false);
  const kmlUrls = useSelector(state => state.settings.kmlUrls);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const pois = useSelector(state => state.poi?.list) || [];
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const themeFontImagerCapitalize = useSelector(state => state.settings?.themeFontImagerCapitalize) || false;
  const formatLabel = (txt) => themeFontImagerCapitalize ? txt.toUpperCase() : txt;
  const currentUser = useSelector(state => state.auth?.currentUser);
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';
  const recommendations = useSelector(state => state.recommendations?.data) || [];
  
  const [geoJsonLayers, setGeoJsonLayers] = useState([]);
  const [errors, setErrors] = useState([]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [fieldImagery, setFieldImagery] = useState({});
  const [fieldImageryOffsets, setFieldImageryOffsets] = useState({});
  const [geeStatus, setGeeStatus] = useState({});
  const [strokeEnabled, setStrokeEnabled] = useState(true);
  const [useCommonColor, setUseCommonColor] = useState(false);
  const [fieldWeather, setFieldWeather] = useState({});
  const [selectedFieldForRec, setSelectedFieldForRec] = useState(null);
  const weatherFetchCache = useRef(new Set());
  const [waterways, setWaterways] = useState(null);
  const [showWaterways, setShowWaterways] = useState(true);

  const anyFieldHasCropLayout = useMemo(() => {
    return Object.values(fieldImagery).some(val => val && val.startsWith('CropLayout'));
  }, [fieldImagery]);

  useEffect(() => {
    fetch('/api/lisgis/waterways')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch LISGIS waterways');
        return res.json();
      })
      .then(data => setWaterways(data))
      .catch(err => {
        console.warn('LISGIS API fetch failed, using fallback GeoJSON:', err);
        setWaterways({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                name: "Mahe Creek Branch",
                source: "LISGIS Waterways (2024)",
                county: "Bomi",
                flow_direction: "NE-to-SW"
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [-10.8695, 6.7366],
                  [-10.8695, 6.7353],
                  [-10.8695, 6.7338],
                  [-10.8704, 6.7328],
                  [-10.8704, 6.7313],
                  [-10.8709, 6.7298],
                  [-10.8713, 6.7290]
                ]
              }
            },
            {
              type: "Feature",
              properties: {
                name: "NW Tributary",
                source: "LISGIS Waterways (2024)",
                county: "Bomi",
                flow_direction: "SW-to-NE"
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [-10.8741, 6.7290],
                  [-10.8754, 6.7313],
                  [-10.8723, 6.7323],
                  [-10.8704, 6.7328]
                ]
              }
            },
            {
              type: "Feature",
              properties: {
                name: "SE Tributary",
                source: "LISGIS Waterways (2024)",
                county: "Bomi",
                flow_direction: "NW-to-SE"
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [-10.8704, 6.7313],
                  [-10.8659, 6.7293],
                  [-10.8640, 6.7295]
                ]
              }
            }
          ]
        });
      });
  }, []);

  // Floating Filter Panel state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(() => {
    return localStorage.getItem('map_filter_panel_open') === 'true';
  });

  // Granular picking states
  const [fieldsFilterMode, setFieldsFilterMode] = useState(() => localStorage.getItem('map_fields_filter_mode') || 'all');
  const [selectedFields, setSelectedFields] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('map_selected_fields')) || [];
    } catch (e) {
      return [];
    }
  });

  const [poisFilterMode, setPoisFilterMode] = useState(() => localStorage.getItem('map_pois_filter_mode') || 'all');
  const [selectedPois, setSelectedPois] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('map_selected_pois')) || [];
    } catch (e) {
      return [];
    }
  });

  const [equipmentFilterMode, setEquipmentFilterMode] = useState(() => localStorage.getItem('map_equipment_filter_mode') || 'all');
  const [selectedEquipment, setSelectedEquipment] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('map_selected_equipment')) || [];
    } catch (e) {
      return [];
    }
  });

  const [soilTestsFilterMode, setSoilTestsFilterMode] = useState(() => localStorage.getItem('map_soil_tests_filter_mode') || 'all');
  const [selectedSoilTests, setSelectedSoilTests] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('map_selected_soil_tests')) || [];
    } catch (e) {
      return [];
    }
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('map_filter_panel_open', String(isFilterPanelOpen));
  }, [isFilterPanelOpen]);

  useEffect(() => {
    localStorage.setItem('map_fields_filter_mode', fieldsFilterMode);
  }, [fieldsFilterMode]);

  useEffect(() => {
    localStorage.setItem('map_selected_fields', JSON.stringify(selectedFields));
  }, [selectedFields]);

  useEffect(() => {
    localStorage.setItem('map_pois_filter_mode', poisFilterMode);
  }, [poisFilterMode]);

  useEffect(() => {
    localStorage.setItem('map_selected_pois', JSON.stringify(selectedPois));
  }, [selectedPois]);

  useEffect(() => {
    localStorage.setItem('map_equipment_filter_mode', equipmentFilterMode);
  }, [equipmentFilterMode]);

  useEffect(() => {
    localStorage.setItem('map_selected_equipment', JSON.stringify(selectedEquipment));
  }, [selectedEquipment]);

  useEffect(() => {
    localStorage.setItem('map_soil_tests_filter_mode', soilTestsFilterMode);
  }, [soilTestsFilterMode]);

  useEffect(() => {
    localStorage.setItem('map_selected_soil_tests', JSON.stringify(selectedSoilTests));
  }, [selectedSoilTests]);

  useEffect(() => {
    const handler = (e) => {
      const { fieldId, status, error } = e.detail;
      setGeeStatus(prev => ({ ...prev, [fieldId]: { status, error } }));
    };
    window.addEventListener('gee-status-change', handler);
    return () => window.removeEventListener('gee-status-change', handler);
  }, []);  const handleFindWaterwayPOI = async () => {
    if (!mapInstance) {
      alert('Map is not fully initialized yet.');
      return;
    }
    const bounds = mapInstance.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    
    setLoadingWaterway(true);
    try {
      const res = await fetch('/api/gee/find-waterways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minLat: southWest.lat,
          maxLat: northEast.lat,
          minLng: southWest.lng,
          maxLng: northEast.lng,
          farmId: localStorage.getItem('activeFarmId') || 'default_farm',
          email: currentUser?.email
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to detect waterway');
      }
      
      const data = await res.json();
      if (!data.points || data.points.length === 0) {
        alert('No waterway detected in the current view area.');
        return;
      }
      
      let country = '';
      let region = '';
      let county = '';
      let city = '';
      if (data.points && data.points.length > 0) {
        const firstPt = data.points[0];
        try {
          const geoInfo = await fetchGeoLocationInfo(firstPt[0], firstPt[1], googleMapsApiKey);
          country = geoInfo.country || '';
          region = geoInfo.region || '';
          county = geoInfo.county || '';
          city = geoInfo.city || '';
        } catch (geoErr) {
          console.warn('Geocoding error in handleFindWaterwayPOI:', geoErr);
        }
      }

      const userEmail = currentUser?.email || currentUser?.name || 'Unknown User';
      const poiId = `poi_${Date.now()}`;
      const zoomLevel = mapInstance ? mapInstance.getZoom() : null;

      const newPoi = {
        id: poiId,
        name: `Waterway ${new Date().toLocaleDateString()}`,
        type: 'Water Source',
        description: 'Auto-detected waterway centerline from GEE elevation minima',
        points: JSON.stringify(data.points),
        drawColor: '#4fc3f7',
        area: '',
        length: '',
        isLine: true,
        country,
        region,
        county,
        city,
        zoomLevel: zoomLevel !== null ? Number(zoomLevel) : null,
        mapElevation: data.mapElevation !== undefined && data.mapElevation !== null ? Number(data.mapElevation) : null,
        createdBy: userEmail,
        lastUpdatedBy: userEmail,
        createdAt: new Date().toISOString()
      };
      
      dispatch(addPoi(newPoi));
      dispatch(queueAction({ type: 'poi/addPoi', payload: newPoi, meta: { id: Date.now() } }));
      alert(`Successfully detected waterway! Saved as Point of Interest: "${newPoi.name}"`);
    } catch (err) {
      console.error(err);
      alert(`Waterway detection failed: ${err.message}`);
    } finally {
      setLoadingWaterway(false);
    }
  };

  // Weather GEE data fetching effect
  useEffect(() => {
    if (!fields || fields.length === 0) return;

    fields.forEach(field => {
      const activeImagery = fieldImagery[field.id] || 'none';
      const isWeather = activeImagery === 'GEE_Weather';
      if (!isWeather) return;

      const dateOffset = fieldImageryOffsets[field.id] || 0;
      const key = `${field.id}_${dateOffset}`;

      if (weatherFetchCache.current.has(key)) return;
      weatherFetchCache.current.add(key);

      setFieldWeather(prev => ({
        ...prev,
        [key]: { loading: true, error: null, data: null }
      }));

      let polygonCoords = [];
      if (field.polygon) {
        try {
          polygonCoords = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
        } catch (e) {}
      }

      fetch('/api/gee/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          polygon: polygonCoords, 
          dateOffset, 
          farmId: localStorage.getItem('activeFarmId') || 'default_farm',
          email: currentUser?.email 
        })
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch weather');
          return res.json();
        })
        .then(data => {
          setFieldWeather(prev => ({
            ...prev,
            [key]: { loading: false, error: null, data }
          }));
        })
        .catch(err => {
          console.error('[Weather Fetch Error]:', err);
          // Remove from cache to allow retrying
          weatherFetchCache.current.delete(key);
          setFieldWeather(prev => ({
            ...prev,
            [key]: { loading: false, error: err.message || 'Error fetching weather data', data: null }
          }));
        });
    });
  }, [fields, fieldImagery, fieldImageryOffsets]);

  const visibleMapLayers = useSelector(state => state.settings?.visibleMapLayers) || ['fields', 'nurseries', 'pois', 'equipment', 'soilTests'];

  // Formatting options for select dropdowns
  const fieldOptions = fields.map(f => ({ value: f.id, label: f.name || 'Unnamed Field' }));
  const poiOptions = pois.map(p => ({ value: p.id, label: `${p.name || 'Unnamed POI'} (${p.type || 'N/A'})` }));
  const equipmentOptions = equipment.map(e => ({ value: e.id, label: `${e.name || 'Unnamed Asset'} (${e.type || 'N/A'})` }));
  const soilTestOptions = soilTests.map(t => {
    const relatedField = fields.find(f => f.id === t.fieldId);
    const dateStr = t.date || t.testResults?.[0]?.date || 'No Date';
    const fieldStr = relatedField ? `(${relatedField.name})` : '';
    const descStr = t.description ? `- ${t.description}` : '';
    return {
      value: t.id,
      label: `${dateStr} ${fieldStr} ${descStr}`.trim() || 'Soil Test'
    };
  });

  // Filter rendering logic based on top-level layers and picker selections
  const displayedFields = fields.filter(field => {
    if (!visibleMapLayers.includes('fields')) return false;
    if (fieldsFilterMode === 'specific') {
      return selectedFields.some(opt => opt.value === field.id);
    }
    return true;
  });

  const displayedNurseries = nurseries.filter(bed => {
    return visibleMapLayers.includes('nurseries');
  });

  const displayedPois = pois.filter(poi => {
    if (!visibleMapLayers.includes('pois')) return false;
    if (poisFilterMode === 'specific') {
      return selectedPois.some(opt => opt.value === poi.id);
    }
    return true;
  });

  const displayedEquipment = equipment.filter(item => {
    if (!visibleMapLayers.includes('equipment')) return false;
    if (equipmentFilterMode === 'specific') {
      return selectedEquipment.some(opt => opt.value === item.id);
    }
    return true;
  });

  const displayedSoilTests = soilTests.filter(test => {
    if (!visibleMapLayers.includes('soilTests')) return false;
    if (soilTestsFilterMode === 'specific') {
      return selectedSoilTests.some(opt => opt.value === test.id);
    }
    return true;
  });

  const getCommonImagery = () => {
    if (!fields || fields.length === 0) return 'none';
    const firstVal = fieldImagery[fields[0].id] || 'none';
    const allSame = fields.every(f => (fieldImagery[f.id] || 'none') === firstVal);
    return allSame ? firstVal : 'mixed';
  };
  const commonImagery = getCommonImagery();

  const handleGlobalImageryChange = (val) => {
    const newFieldImagery = {};
    fields.forEach(field => {
      newFieldImagery[field.id] = val;
    });
    setFieldImagery(newFieldImagery);
  };

  // Fetch and parse KML URLs into GeoJSON
  useEffect(() => {
    const fetchKMLs = async () => {
      if (!kmlUrls || kmlUrls.length === 0) {
        setGeoJsonLayers([]);
        return;
      }
      
      const newLayers = [];
      const newErrors = [];
      
      for (const url of kmlUrls) {
        try {
          // Route fetch through a CORS proxy to bypass browser restrictions
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status} via proxy`);
          const text = await response.text();
          
          // Parse it using the DOMParser
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          
          // Check for parsing errors
          if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
             throw new Error('Invalid XML/KML syntax in file');
          }

          // Use @tmcw/togeojson to convert
          const parsedGeoJson = kml(xmlDoc);
          
          newLayers.push({
            id: url,
            data: parsedGeoJson
          });
        } catch (err) {
          console.error(`Failed to load KML layer from ${url}:`, err);
          newErrors.push(`Could not load Map Layer: ${url} (${err.message})`);
        }
      }
      
      setGeoJsonLayers(newLayers);
      setErrors(newErrors);
    };

    fetchKMLs();
  }, [kmlUrls]);

  const renderLayerFilterItem = (layerKey, label, filterMode, setFilterMode, selectedVals, setSelectedVals, options, placeholder) => {
    const isLayerActive = visibleMapLayers.includes(layerKey);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
            <input 
              type="checkbox" 
              checked={isLayerActive}
              onChange={() => {
                const newLayers = isLayerActive 
                  ? visibleMapLayers.filter(l => l !== layerKey) 
                  : [...visibleMapLayers, layerKey];
                dispatch(setVisibleMapLayers(newLayers));
                dispatch(saveSettings());
              }}
              style={{ width: '15px', height: '15px', margin: 0 }}
            />
            {label}
          </label>

          {isLayerActive && (
            <div style={{ display: 'flex', gap: '2px', background: '#eaeaea', borderRadius: '4px', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                style={{
                  border: 'none',
                  background: filterMode === 'all' ? '#ffffff' : 'transparent',
                  color: filterMode === 'all' ? 'var(--color-primary-dark, #2e7d32)' : '#666',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('specific')}
                style={{
                  border: 'none',
                  background: filterMode === 'specific' ? '#ffffff' : 'transparent',
                  color: filterMode === 'specific' ? 'var(--color-primary-dark, #2e7d32)' : '#666',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Pick
              </button>
            </div>
          )}
        </div>

        {isLayerActive && filterMode === 'specific' && (
          <div style={{ marginTop: '4px' }}>
            <Select
              isMulti
              options={options}
              value={selectedVals}
              onChange={setSelectedVals}
              placeholder={placeholder}
              menuPortalTarget={document.body}
              styles={{ 
                control: (base) => ({ ...base, minHeight: '30px', fontSize: '0.75rem', borderColor: '#ccc' }),
                valueContainer: (base) => ({ ...base, padding: '0px 6px' }),
                dropdownIndicator: (base) => ({ ...base, padding: '2px' }),
                clearIndicator: (base) => ({ ...base, padding: '2px' }),
                multiValue: (base) => ({ ...base, margin: '1px', background: '#e3f2fd' }),
                multiValueLabel: (base) => ({ ...base, color: '#0d47a1', fontSize: '0.7rem' }),
                multiValueRemove: (base) => ({ ...base, color: '#0d47a1', ':hover': { background: '#bbdefb', color: '#0d47a1' } }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const activeWeatherField = fields.find(field => {
    const activeImagery = fieldImagery[field.id] || 'none';
    return activeImagery === 'GEE_Weather';
  });
  const activeWeatherOffset = activeWeatherField ? (fieldImageryOffsets[activeWeatherField.id] || 0) : 0;
  const activeWeatherKey = activeWeatherField ? `${activeWeatherField.id}_${activeWeatherOffset}` : '';
  const activeWeatherDataState = fieldWeather[activeWeatherKey];
  const activeWeatherData = activeWeatherDataState?.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Static Toolbar matching other maps */}
      <div className="map-toolbar-container" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingBottom: '8px', alignItems: 'center' }}>
        <CurrentLocationButton onLocationFound={(loc) => setFlyTarget(loc)} />
        <button
          type="button"
          onClick={() => {
            if (mapCenter) {
              setFlyTarget([mapCenter[0], mapCenter[1], Date.now()]);
            }
          }}
          className="btn map-toolbar-btn"
          style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="Go to Farm Base"
        >
          <Tractor size={16} />
        </button>
        <button
          type="button"
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          className={`btn map-toolbar-btn ${isFilterPanelOpen ? 'active' : ''}`}
          style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          title="Toggle Filters & Layers"
        >
          <Sliders size={16} /> {isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
        <button
          type="button"
          onClick={handleFindWaterwayPOI}
          disabled={loadingWaterway}
          className="btn map-toolbar-btn"
          style={{ 
            flexShrink: 0, 
            padding: '6px 10px', 
            fontSize: '0.85rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            cursor: 'pointer',
            background: '#e0f7fa',
            color: '#006064',
            borderColor: '#b2ebf2'
          }}
          title="Detect Waterway in Current View & Save as POI"
        >
          <Droplet size={16} style={{ color: '#006064' }} /> 
          {loadingWaterway ? 'Scanning...' : 'Find Waterway'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 0, position: 'relative' }}>
      
      {errors.length > 0 && (
        <div style={{ position: 'absolute', bottom: '15px', left: '15px', zIndex: 1000, background: 'rgba(198, 40, 40, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      {/* Crop Advisor Panel (Top-Left) */}
      {selectedFieldForRec && (
        <CropRecommendationPanel 
          field={selectedFieldForRec} 
          onClose={() => setSelectedFieldForRec(null)} 
        />
      )}

      {/* Floating Filter Panel (Top-Right, shows when open) */}
      {isFilterPanelOpen && (
        <div
          className="map-filters-panel"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '320px',
            maxHeight: 'calc(100% - 24px)',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary-dark, #1b5e20)' }}>
              <Sliders size={16} /> Filters & Layers
            </h4>
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(false)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Close Panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Global Options */}
          <div style={{ background: '#f5f7fa', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="imager-select-label" style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>Global Overlay:</label>
              <select 
                value={commonImagery} 
                onChange={(e) => handleGlobalImageryChange(e.target.value)}
                className="imager-select"
                style={{ padding: '4px 8px', borderRadius: '4px', background: 'white', fontSize: '0.8rem', border: '1px solid #ccc', width: '100%' }}
              >
                {commonImagery === 'mixed' && (
                  <option value="mixed" disabled>{formatLabel("-- Mixed Overlays --")}</option>
                )}
                <option value="none">{formatLabel("None (Standard)")}</option>
                <option value="Elevation">{formatLabel("Elevation (Topography)")}</option>
                <option value="CropLayout">{formatLabel("Crop Layout Overlay")}</option>
                <optgroup label={formatLabel("Satellite Indices")}>
                  <option value="CurrentSatellite">{formatLabel("Current Satellite View")}</option>
                  <option value="TrueColor">{formatLabel("True Color (RGB)")}</option>
                  <option value="NDVI">{formatLabel("NDVI (Vegetation Index)")}</option>
                  <option value="NDWI">{formatLabel("NDWI (Water Index)")}</option>
                  <option value="EVI">{formatLabel("EVI (Enhanced Vegetation)")}</option>
                  <option value="SoilMoisture">{formatLabel("Soil Moisture")}</option>
                  <option value="FalseColor">{formatLabel("False Color (Biomass)")}</option>
                </optgroup>
                <option value="GEE_Weather">{formatLabel("Weather Forecast (GEE GFS)")}</option>
              </select>
            </div>

            {commonImagery === 'GEE_Weather' && activeWeatherData && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(51,105,30,0.05)', borderRadius: '8px', border: '1px solid rgba(51,105,30,0.2)', color: '#1b5e20', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(51,105,30,0.15)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Farm Weather Report</span>
                  <span style={{ fontSize: '0.58rem', background: activeWeatherData.isSimulated ? '#fff3e0' : '#e8f5e9', padding: '1px 4px', borderRadius: '3px', color: activeWeatherData.isSimulated ? '#e65100' : '#2e7d32', fontWeight: 600 }}>
                    {activeWeatherData.isSimulated ? 'Simulated' : 'GEE GFS'}
                  </span>
                </div>
                
                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: '4px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <Thermometer size={14} color="#e65100" />
                    <span style={{ fontSize: '0.55rem', color: '#757575' }}>Temp</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{Math.round(activeWeatherData.temperature * 1.8 + 32)}°F <br/><span style={{ fontSize: '0.55rem', fontWeight: 'normal', color: '#666' }}>({activeWeatherData.temperature}°C)</span></span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: '4px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <CloudRain size={14} color="#1565c0" />
                    <span style={{ fontSize: '0.55rem', color: '#757575' }}>Rain</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, marginTop: '2px' }}>{activeWeatherData.precipitation} mm</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', padding: '4px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <Wind size={14} color="#0288d1" />
                    <span style={{ fontSize: '0.55rem', color: '#757575' }}>Wind</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{Math.round(activeWeatherData.windSpeed * 3.6)} km/h <br/><span style={{ fontSize: '0.55rem', fontWeight: 'normal', color: '#666' }}>({activeWeatherData.windSpeed} m/s)</span></span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', background: 'white', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Droplet size={10} color="#00acc1" />
                    <span>Hum: <strong>{activeWeatherData.humidity}%</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Cloud size={10} color="#546e7a" />
                    <span>Clouds: <strong>{activeWeatherData.clouds}%</strong></span>
                  </div>
                </div>

                <div style={{ fontSize: '0.62rem', color: '#555', lineHeight: '1.2' }}>
                  <div><strong>Forecast:</strong> {activeWeatherData.dateStr}</div>
                  <div><strong>Duration:</strong> {activeWeatherData.duration}</div>
                </div>

                {/* Agricultural Advisories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid rgba(51,105,30,0.1)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Info size={12} /> Agricultural Impact:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '80px', overflowY: 'auto' }}>
                    {(() => {
                      const alerts = [];
                      const w = activeWeatherData;

                      if (w.windSpeed > 5.0) {
                        alerts.push({ text: `High wind drift risk (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Avoid pesticide spraying.`, color: '#d84315' });
                      } else if (w.windSpeed < 1.0) {
                        alerts.push({ text: `Calm wind (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Thermal inversion risk.`, color: '#ef6c00' });
                      } else {
                        alerts.push({ text: `Optimal wind spraying window (${Math.round(w.windSpeed * 3.6)} km/h).`, color: '#2e7d32' });
                      }

                      if (w.temperature < 2.0) {
                        alerts.push({ text: `Frost Alert: Low temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Cover sensitive crops.`, color: '#c62828' });
                      } else if (w.temperature > 32.0) {
                        alerts.push({ text: `Heat Alert: High temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Elevate irrigation.`, color: '#c62828' });
                      }

                      if (w.precipitation > 0.1) {
                        alerts.push({ text: `Rain detected (${w.precipitation} mm/h). Pause scheduled irrigation.`, color: '#1565c0' });
                      } else if (w.humidity < 35.0) {
                        alerts.push({ text: `Dry Air Alert (${w.humidity}%). Monitor soil moisture profiles.`, color: '#ef6c00' });
                      }

                      if (w.humidity > 85.0 && w.temperature >= 18.0 && w.temperature <= 28.0) {
                        alerts.push({ text: `Warm & humid. Fungal infection risk.`, color: '#c62828' });
                      }

                      return alerts.map((alert, idx) => (
                        <div key={idx} style={{ fontSize: '0.62rem', color: alert.color, display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                          <span>•</span>
                          <span>{alert.text}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={strokeEnabled} 
                  onChange={(e) => setStrokeEnabled(e.target.checked)} 
                  style={{ width: '14px', height: '14px', margin: 0 }}
                />
                {formatLabel("Show Borders")}
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={useCommonColor} 
                  onChange={(e) => setUseCommonColor(e.target.checked)} 
                  style={{ width: '14px', height: '14px', margin: 0 }}
                />
                {formatLabel("Common Color")}
              </label>
            </div>
          </div>

          {/* Map Layers & Granular Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {renderLayerFilterItem(
              'fields',
              'Fields',
              fieldsFilterMode,
              setFieldsFilterMode,
              selectedFields,
              setSelectedFields,
              fieldOptions,
              'Select fields...'
            )}

            {renderLayerFilterItem(
              'pois',
              'Points of Interest',
              poisFilterMode,
              setPoisFilterMode,
              selectedPois,
              setSelectedPois,
              poiOptions,
              'Select points...'
            )}

            {renderLayerFilterItem(
              'equipment',
              'Hard Assets',
              equipmentFilterMode,
              setEquipmentFilterMode,
              selectedEquipment,
              setSelectedEquipment,
              equipmentOptions,
              'Select assets...'
            )}

            {renderLayerFilterItem(
              'soilTests',
              'Soil Tests',
              soilTestsFilterMode,
              setSoilTestsFilterMode,
              selectedSoilTests,
              setSelectedSoilTests,
              soilTestOptions,
              'Select tests...'
            )}

            {/* Nurseries Layer (simple toggle) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={visibleMapLayers.includes('nurseries')}
                  onChange={() => {
                    const newLayers = visibleMapLayers.includes('nurseries') 
                      ? visibleMapLayers.filter(l => l !== 'nurseries') 
                      : [...visibleMapLayers, 'nurseries'];
                    dispatch(setVisibleMapLayers(newLayers));
                    dispatch(saveSettings());
                  }}
                  style={{ width: '15px', height: '15px', margin: 0 }}
                />
                Nurseries
              </label>
            </div>

            {/* LISGIS Waterways Layer (simple toggle) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox" 
                  checked={showWaterways}
                  onChange={(e) => setShowWaterways(e.target.checked)}
                  style={{ width: '15px', height: '15px', margin: 0 }}
                />
                LISGIS Waterways (Creek)
              </label>
            </div>
          </div>
        </div>
      )}

      <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <MapEventsHelper setMapInstance={setMapInstance} />
        <MapResizer />
        <TileLayer
          attribution="Google Maps"
          url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
          maxZoom={24}
          maxNativeZoom={20}
        />
        
        {/* Render successfully parsed remote KML Layers */}
        {geoJsonLayers.map((layer) => (
          <GeoJSON 
            key={layer.id} 
            data={layer.data} 
            style={{ color: '#ff7800', weight: 2, opacity: 0.65 }} 
          />
        ))}

        {/* Render LISGIS Waterways */}
        {showWaterways && waterways && (
          <>
            {/* 130m Riparian Buffer Zone (Wide, transparent cyan/blue) */}
            <GeoJSON
              key={`buffer_${JSON.stringify(waterways)}`}
              data={waterways}
              style={{
                color: '#80d8ff',
                weight: 24, // wide buffer
                opacity: 0.15,
                lineCap: 'round',
                lineJoin: 'round'
              }}
              interactive={false}
            />
            {/* Creek Centerline (dashed blue line with popup) */}
            <GeoJSON
              key={`line_${JSON.stringify(waterways)}`}
              data={waterways}
              style={{
                color: '#29b6f6',
                weight: 8,
                opacity: 0.85,
                dashArray: '10, 10',
                lineCap: 'round',
                lineJoin: 'round'
              }}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`
                  <div style="font-family: var(--font-family); font-size: 0.8rem; line-height: 1.4; min-width: 180px;">
                    <strong style="color: #29b6f6; font-size: 0.9rem; display: block; margin-bottom: 4px;">🌊 ${feature.properties.name}</strong>
                    <strong>Source:</strong> ${feature.properties.source}<br/>
                    <strong>County:</strong> ${feature.properties.county}<br/>
                    <strong>Flow Direction:</strong> ${feature.properties.flow_direction || 'N/A'}<br/>
                    <div style="margin-top: 6px; padding: 6px; background: #e0f7fa; border-radius: 4px; border: 1px solid #b2ebf2; font-size: 0.72rem; color: #006064; line-height: 1.3;">
                      ℹ️ 130m Riparian Buffer Zone active: reduces local elevation and increases soil moisture.
                    </div>
                  </div>
                `);
              }}
            />
          </>
        )}

        {/* Render Equipment (Hard Assets) as Markers */}
        {displayedEquipment.map(item => {
          let pos = null;
          if (item.gpsLocation) {
            try { pos = typeof item.gpsLocation === 'string' ? JSON.parse(item.gpsLocation) : item.gpsLocation; } catch(e) {}
          }
          if (!pos || !Array.isArray(pos) || pos.length !== 2) return null;
          
          return (
            <Marker key={item.id} position={pos} icon={orangeIcon}>
              <Popup>
                <strong>{item.name}</strong> ({item.type})<br/>
                Status: {item.status}
              </Popup>
            </Marker>
          );
        })}

        {/* Render Nurseries as green Polygons */}
        {displayedNurseries.map(bed => {
          let positions = [];
          if (bed.polygon) {
            try { positions = typeof bed.polygon === 'string' ? JSON.parse(bed.polygon) : bed.polygon; } catch(e) {}
          }
          if (!Array.isArray(positions) || positions.length === 0) return null;
          return (
            <Polygon 
              key={bed.id} 
              pathOptions={{ 
                stroke: strokeEnabled,
                color: useCommonColor ? polygonColor : (bed.drawColor || polygonColor), 
                weight: 1.2, 
                opacity: 0.6, 
                fillOpacity: 0.4 
              }} 
              positions={positions}
            >
              <Popup>
                <strong>Nursery: {bed.name}</strong><br/>
                Capacity: {bed.capacity} plugs
              </Popup>
            </Polygon>
          );
        })}

        {/* Render Fields */}
        {displayedFields.map(field => {
          let positions = [];
          if (field.polygon) {
            try {
              positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
            } catch (e) {}
          }
          if (!Array.isArray(positions) || positions.length === 0) return null;
          
          const linkedIds = field.recommendationIds || [];
          const linkedAiRecs = (recommendations || []).filter(r => r.isAI && linkedIds.includes(r.id));
          const hasAiRec = linkedAiRecs.length > 0;

          const showImagery = fieldImagery[field.id] && fieldImagery[field.id] !== 'none';
          const isLoaded = geeStatus[field.id]?.status === 'success' || geeStatus[field.id]?.status === 'failed';
          
          const showCropLayoutForField = (fieldImagery[field.id] && fieldImagery[field.id].startsWith('CropLayout_')) || (fieldImagery[field.id] === 'CropLayout' && hasAiRec);
          const makeTransparent = (showImagery && isLoaded) || showCropLayoutForField;

          return (
            <React.Fragment key={field.id}>
              <Polygon 
                key={field.id}
                pathOptions={{ 
                  stroke: strokeEnabled,
                  color: useCommonColor ? polygonColor : (field.drawColor || polygonColor),
                  weight: 1.5,
                  opacity: 0.6,
                  fill: true,
                  fillOpacity: makeTransparent ? 0.0 : 0.2
                }} 
                positions={positions}
              >
                <Popup>
                  <div style={{ minWidth: '200px' }}>
                    <strong>{field.name}</strong><br/>
                    Area: {field.area}<br/>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.75rem', width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onClick={() => setSelectedFieldForRec(field)}
                    >
                      <Compass size={12} /> Crop Advisor
                    </button>
                    <div style={{ marginTop: '8px' }}>
                      <label className="imager-select-label" style={{ display: 'block', marginBottom: '4px' }}>{formatLabel("Field Imagery:")}</label>
                      <select 
                        className="imager-select"
                        value={fieldImagery[field.id] || 'none'} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setFieldImagery(prev => ({ ...prev, [field.id]: val }));
                        }}
                        style={{ padding: '4px', borderRadius: '4px', width: '100%', background: 'white' }}
                      >
                        <option value="none">{formatLabel("None (Standard)")}</option>
                        <option value="Elevation">{formatLabel("Elevation (Topography)")}</option>
                        {linkedAiRecs.map(rec => (
                          <option key={rec.id} value={`CropLayout_${rec.id}`}>
                            {formatLabel(`Layout: ${rec.name}`)}
                          </option>
                        ))}
                        {/* No default crop layout option rendered when no recommendation exists */}
                        <optgroup label={formatLabel("Satellite Indices")}>
                          <option value="CurrentSatellite">{formatLabel("Current Satellite View")}</option>
                          <option value="TrueColor">{formatLabel("True Color (RGB)")}</option>
                          <option value="NDVI">{formatLabel("NDVI (Vegetation Index)")}</option>
                          <option value="NDWI">{formatLabel("NDWI (Water Index)")}</option>
                          <option value="EVI">{formatLabel("EVI (Enhanced Vegetation)")}</option>
                          <option value="SoilMoisture">{formatLabel("Soil Moisture")}</option>
                          <option value="FalseColor">{formatLabel("False Color (Biomass)")}</option>
                        </optgroup>
                        <option value="GEE_Weather">{formatLabel("Weather Forecast (GEE GFS)")}</option>
                      </select>
                    </div>
                    {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && !fieldImagery[field.id].startsWith('CropLayout') && (
                      <div style={{ marginTop: '8px', padding: '6px', background: '#f1f8e9', borderRadius: '4px', border: '1px solid #c5e1a5', fontSize: '0.72rem', color: '#33691e' }}>
                        {fieldImagery[field.id] === 'GEE_Weather' ? (
                          (() => {
                            const dateOffset = fieldImageryOffsets[field.id] || 0;
                            const key = `${field.id}_${dateOffset}`;
                            const wState = fieldWeather[key];

                            if (!wState) {
                              return <div style={{ fontSize: '0.7rem', color: '#666', padding: '4px 0' }}>Initializing weather query...</div>;
                            }
                            if (wState.loading) {
                              return <div style={{ fontSize: '0.7rem', color: '#1565c0', padding: '4px 0' }}>Fetching GEE GFS weather data...</div>;
                            }
                            if (wState.error) {
                              return <div style={{ fontSize: '0.68rem', color: '#c62828', padding: '4px 0' }}>⚠ GEE Failed: {wState.error}. Using simulated data.</div>;
                            }

                            const weather = wState.data;
                            if (!weather) return <div style={{ fontSize: '0.7rem', color: '#666' }}>No data available</div>;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(51,105,30,0.2)', paddingBottom: '4px', marginBottom: '2px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.75rem' }}>Weather Report</span>
                                  <span style={{ fontSize: '0.58rem', background: weather.isSimulated ? '#fff3e0' : '#e8f5e9', padding: '1px 4px', borderRadius: '3px', color: weather.isSimulated ? '#e65100' : '#2e7d32', fontWeight: 600 }}>
                                    {weather.isSimulated ? 'Simulated' : 'GEE GFS'}
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '0.7rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Thermometer size={12} color="#e65100" />
                                    <span>T: <strong>{Math.round(weather.temperature * 1.8 + 32)}°F</strong> <span style={{ fontSize: '0.6rem', color: '#666' }}>({weather.temperature}°C)</span></span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Wind size={12} color="#0288d1" />
                                    <span>W: <strong>{Math.round(weather.windSpeed * 3.6)} km/h</strong> <span style={{ fontSize: '0.6rem', color: '#666' }}>({weather.windSpeed} m/s)</span></span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <CloudRain size={12} color="#1565c0" />
                                    <span>Rain: <strong>{weather.precipitation} mm/h</strong></span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Droplet size={12} color="#00acc1" />
                                    <span>H: <strong>{weather.humidity}%</strong></span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: '#555' }}>
                                  <Cloud size={12} color="#546e7a" />
                                  <span>Clouds: <strong>{weather.clouds}%</strong></span>
                                </div>
                                <div style={{ fontSize: '0.62rem', color: '#666', borderTop: '1px solid rgba(51,105,30,0.1)', paddingTop: '4px', marginTop: '2px', lineHeight: '1.2' }}>
                                  <div>Forecast: {weather.dateStr || new Date(weather.forecastTime).toLocaleString()}</div>
                                  <div>Duration: {weather.duration}</div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                              {fieldImagery[field.id] === 'CurrentSatellite' ? 'Current Satellite (High-Res)' :
                               fieldImagery[field.id] === 'Elevation' ? 'Elevation (Topography)' : 'Sentinel-2 (10m Index)'}
                            </div>
                            {geeStatus[field.id] && geeStatus[field.id].status === 'failed' && (
                              <div style={{ marginTop: '4px', color: '#c62828', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                {`⚠ GEE Failed: ${geeStatus[field.id].error}. Showing simulation.`}
                              </div>
                            )}
                            {geeStatus[field.id] && geeStatus[field.id].status === 'success' && (
                              <div style={{ marginTop: '4px', color: '#2e7d32', fontWeight: 600, fontSize: '0.65rem', lineHeight: '1.2' }}>
                                ✓ Live Earth Engine imagery loaded.
                              </div>
                            )}
                            {geeStatus[field.id] && geeStatus[field.id].status === 'loading' && (
                              <div style={{ marginTop: '4px', color: '#1565c0', fontSize: '0.65rem', lineHeight: '1.2' }}>
                                Fetching GEE tiles...
                              </div>
                            )}
                            <div>Scene Date: {getDeterministicSceneDate(field.id, fieldImageryOffsets[field.id] || 0)}</div>
                            <div>Cloud Cover: {getDeterministicCloudCover(field.id, fieldImageryOffsets[field.id] || 0)}%</div>
                          </>
                        )}
                            
                        <div style={{ display: 'flex', marginTop: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Older</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                              onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [field.id]: (prev[field.id] || 0) - 30 }))}
                            >
                              ←
                            </button>
                          </div>
                          
                          <span style={{ fontWeight: 700, fontSize: '0.68rem', margin: '0 8px', minWidth: '55px', textAlign: 'center', alignSelf: 'flex-end', marginBottom: '4px' }}>
                            {(fieldImageryOffsets[field.id] || 0) === 0 ? 'Latest' : `${Math.abs(fieldImageryOffsets[field.id] || 0)}d ago`}
                          </span>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#558b2f' }}>Newer</span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', marginTop: '2px', width: '100%', lineHeight: 1 }}
                              disabled={(fieldImageryOffsets[field.id] || 0) >= 0}
                              onClick={() => setFieldImageryOffsets(prev => ({ ...prev, [field.id]: (prev[field.id] || 0) + 30 }))}
                            >
                              →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {showCropLayoutForField && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#f5f7fa', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(() => {
                          const linkedIds = field.recommendationIds || [];
                          const linkedAiRecs = (recommendations || []).filter(r => r.isAI && linkedIds.includes(r.id));
                          
                          // Determine selected report ID from fieldImagery
                          const selectedRecVal = fieldImagery[field.id] || '';
                          const selectedRecId = selectedRecVal.startsWith('CropLayout_') ? selectedRecVal.substring(11) : null;
                          
                          let report = null;
                          if (selectedRecId) {
                            report = linkedAiRecs.find(r => r.id === selectedRecId);
                          }
                          if (!report && linkedAiRecs.length > 0) {
                            report = [...linkedAiRecs].sort((a, b) => b.createdAt - a.createdAt)[0];
                          }
                          
                          const structuredData = getReportStructuredData(report, field.area || 5, report?.promptInputs?.selectedCrops || '', pois, field);
                          const layoutData = structuredData?.fieldLayout || parseStructuredData('', field.area || 5, '', undefined, pois, field).fieldLayout;
                          
                           // Auto-calculate the angle of the longest axis
                           let autoAngle = 0;
                           if (positions.length >= 3) {
                             let minLat = Infinity, maxLat = -Infinity;
                             let minLng = Infinity, maxLng = -Infinity;
                             for (const pt of positions) {
                               if (pt[0] < minLat) minLat = pt[0];
                               if (pt[0] > maxLat) maxLat = pt[0];
                               if (pt[1] < minLng) minLng = pt[1];
                               if (pt[1] > maxLng) maxLng = pt[1];
                             }
                             const svgVertices = positions.map(pt => {
                               const x = ((pt[1] - minLng) / (maxLng - minLng || 0.0001)) * 100;
                               const y = (1.0 - (pt[0] - minLat) / (maxLat - minLat || 0.0001)) * 100;
                               return { x, y };
                             });
                             let maxDist = -1;
                             let bestPair = null;
                             for (let i = 0; i < svgVertices.length; i++) {
                               for (let j = i + 1; j < svgVertices.length; j++) {
                                 const dist = Math.hypot(svgVertices[i].x - svgVertices[j].x, svgVertices[i].y - svgVertices[j].y);
                                 if (dist > maxDist) {
                                   maxDist = dist;
                                   bestPair = [svgVertices[i], svgVertices[j]];
                                 }
                               }
                             }
                             if (bestPair) {
                               const dx = bestPair[1].x - bestPair[0].x;
                               const dy = bestPair[1].y - bestPair[0].y;
                               let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                               if (angle < 0) angle += 180;
                               autoAngle = Math.round(angle);
                             }
                           }
                           const currentAngle = (field.layoutRotation !== undefined && field.layoutRotation !== null && field.layoutRotation !== '') ? parseInt(field.layoutRotation) : autoAngle;

                           return (
                             <>
                               <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#1b5e20', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '2px' }}>
                                 {report ? `Layout: ${report.name}` : 'Default Standard Layout'}
                               </div>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                 {!layoutData || !layoutData.cropAssignments ? (
                                   <div style={{ fontSize: '0.68rem', color: '#666' }}>No crop layout active. Use Crop Advisor to generate one.</div>
                                 ) : (
                                   layoutData.cropAssignments.map((ass, idx) => (
                                     <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem' }}>
                                       <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: ass.color, flexShrink: 0 }} />
                                       <span style={{ fontWeight: 600 }}>{ass.crop || 'Unassigned'}</span>
                                       <span style={{ color: '#666', fontSize: '0.65rem' }}>(Rows {ass.startRow + 1}-{ass.endRow + 1})</span>
                                     </div>
                                   ))
                                 )}
                               </div>
                               <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                   <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#333', margin: 0 }}>
                                     Layout Rotation:
                                   </label>
                                   <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2e7d32' }}>
                                     {currentAngle}° {(field.layoutRotation === undefined || field.layoutRotation === null || field.layoutRotation === '') && '(Auto)'}
                                   </span>
                                 </div>
                                 <input
                                   type="range"
                                   min="0"
                                   max="360"
                                   value={currentAngle}
                                   onChange={(e) => {
                                     const val = parseInt(e.target.value);
                                     const updatedField = { ...field, layoutRotation: val };
                                     dispatch(updateField(updatedField));
                                     dispatch(queueAction({ type: 'core/updateNode', payload: { id: field.id, properties: updatedField }, meta: { id: Date.now() } }));
                                   }}
                                   style={{ width: '100%', cursor: 'pointer', height: '4px', background: '#ccc', borderRadius: '2px', outline: 'none' }}
                                 />
                                 {field.layoutRotation !== undefined && field.layoutRotation !== null && field.layoutRotation !== '' && (
                                   <button
                                     type="button"
                                     onClick={() => {
                                       const updatedField = { ...field, layoutRotation: '' };
                                       dispatch(updateField(updatedField));
                                       dispatch(queueAction({ type: 'core/updateNode', payload: { id: field.id, properties: updatedField }, meta: { id: Date.now() } }));
                                     }}
                                     className="btn"
                                     style={{ padding: '2px 6px', fontSize: '0.65rem', marginTop: '6px', width: '100%', background: '#f5f5f5', border: '1px solid #ddd', cursor: 'pointer' }}
                                   >
                                     Reset to Auto-Align
                                   </button>
                                 )}
                               </div>
                             </>
                           );
                        })()}
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>
              {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && fieldImagery[field.id] !== 'GEE_Weather' && !fieldImagery[field.id].startsWith('CropLayout') && (
                <FieldImageryOverlay 
                  polygon={positions} 
                  indexType={fieldImagery[field.id]} 
                  dateOffset={fieldImageryOffsets[field.id] || 0}
                  fieldId={field.id}
                />
              )}
              {showCropLayoutForField && (
                <FieldLayoutMapOverlay 
                  field={field}
                  recommendations={recommendations}
                  selectedRecId={fieldImagery[field.id] && fieldImagery[field.id].startsWith('CropLayout_') ? fieldImagery[field.id].substring(11) : null}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Render POIs */}
        {displayedPois.map(poi => {
          let positions = [];
          if (poi.points) {
            try { positions = typeof poi.points === 'string' ? JSON.parse(poi.points) : poi.points; } catch(e) {}
          }
          if (!Array.isArray(positions) || positions.length === 0) return null;
          const mappedPts = positions.map(pt => [pt[0], pt[1]]);
          const isPolyline = poi.isLine || poi.drawType === 'polyline' || mappedPts.length === 2;

          if (isPolyline && mappedPts.length > 1) {
            return (
              <Polyline
                key={poi.id}
                pathOptions={{
                  color: useCommonColor ? polygonColor : (poi.drawColor || '#4fc3f7'),
                  weight: strokeEnabled ? (poi.name.toLowerCase().includes('waterway') ? 8 : 4) : 0,
                  opacity: 0.85,
                  dashArray: poi.name.toLowerCase().includes('waterway') ? '10, 10' : undefined
                }}
                positions={mappedPts}
              >
                <Popup>
                  <strong>POI: {poi.name}</strong><br/>
                  {poi.type}
                </Popup>
              </Polyline>
            );
          } else if (mappedPts.length > 2) {
            return (
              <Polygon 
                key={poi.id} 
                pathOptions={{ 
                  stroke: strokeEnabled,
                  color: useCommonColor ? polygonColor : (poi.drawColor || polygonColor), 
                  weight: 1.2, 
                  opacity: 0.6, 
                  fillOpacity: 0.5 
                }} 
                positions={mappedPts}
              >
                <Popup>
                  <strong>POI: {poi.name}</strong><br/>
                  {poi.type}
                </Popup>
              </Polygon>
            );
          } else if (mappedPts.length === 1) {
            return (
              <Marker key={poi.id} position={mappedPts[0]}>
                <Popup>
                  <strong>POI: {poi.name}</strong><br/>
                  {poi.type}
                </Popup>
              </Marker>
            );
          }
          return null;
        })}

        {/* Render Soil Tests */}
        {displayedSoilTests.flatMap(test => 
          (test.testResults || []).filter(res => res.lat && res.lng).map((res, i) => (
            <Marker key={`${test.id}_${i}`} position={[parseFloat(res.lat), parseFloat(res.lng)]} icon={brownIcon}>
              <Popup>
                <strong>Soil Test: {test.date || res.date}</strong><br/>
                pH: {res.ph} | N: {res.nitrogen} | P: {res.phosphorus} | K: {res.potassium}
              </Popup>
            </Marker>
          ))
        )}
        <MapFlyTo center={flyTarget || mapCenter} />
      </MapContainer>
    </div>
    </div>
  );
};

export default MapLayer;
