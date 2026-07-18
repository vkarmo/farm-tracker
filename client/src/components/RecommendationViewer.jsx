import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft, ExternalLink, Link as LinkIcon, Plus, Unlink, Sparkles, AlertCircle, Calendar, ClipboardList, Info, HelpCircle, Layers, CheckCircle, ChevronDown, ChevronUp, Trash2, Droplet, Sprout, Mountain, RefreshCw, DollarSign, FileText } from 'lucide-react';
import { addRecommendation, deleteRecommendation } from '../store/recommendationsSlice';
import { updateField } from '../store/fieldsSlice';
import { queueAction } from '../store/syncSlice';
import { extractSpatialStats } from './CropRecommendationPanel';
import { fetchGeoLocationInfo } from './PoiTab';
import { setAiProvider, saveSettings } from '../store/settingsSlice';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import { MapResizer } from './ResizableMapWrapper';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'leaflet/dist/leaflet.css';

const FitSelectedFieldsBounds = ({ selectedFields }) => {
  const map = useMap();
  useEffect(() => {
    if (!selectedFields || selectedFields.length === 0) return;
    const bounds = [];
    selectedFields.forEach(field => {
      if (field.polygon) {
        try {
          const poly = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
          let flat = poly;
          if (Array.isArray(poly) && poly.length > 0 && Array.isArray(poly[0]) && Array.isArray(poly[0][0])) {
            flat = poly[0];
          }
          if (Array.isArray(flat)) {
            flat.forEach(pt => {
              if (pt && pt.length >= 2) bounds.push([pt[0], pt[1]]);
            });
          }
        } catch (e) {}
      }
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, selectedFields]);
  return null;
};

const AGRI_TIPS = [
  "Analyzing regional topography and elevation variations...",
  "Consulting the Bomi County soil classification catalog...",
  "Determining drainage coefficients and water saturation zones...",
  "Matching crop thresholds against volumetric soil moisture averages...",
  "Structuring operational timelines for the dry/rainy season cycle...",
  "Formulating soil amendment strategies and organic pH corrections...",
  "Evaluating traditional crop rotation sequences for West Africa...",
  "Assessing typical local pests, weeds, and mitigation practices..."
];

const parseBoldAndItalic = (text) => {
  if (!text) return '';
  const boldParts = text.split('**');
  return boldParts.map((bPart, bIdx) => {
    if (bIdx % 2 === 1) {
      return <strong key={`b_${bIdx}`}>{bPart}</strong>;
    }
    const italicParts = bPart.split('*');
    return italicParts.map((iPart, iIdx) => {
      if (iIdx % 2 === 1) {
        return <em key={`i_${iIdx}`}>{iPart}</em>;
      }
      return iPart;
    });
  });
};

const parseMarkdownToReact = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let currentTableRows = [];
  let currentListItems = [];

  const flushTable = (key) => {
    if (currentTableRows.length > 0) {
      elements.push(
        <div key={`table_${key}`} className="premium-table-container">
          <table className="premium-table">
            <tbody>
              {currentTableRows}
            </tbody>
          </table>
        </div>
      );
      currentTableRows = [];
    }
  };

  const flushList = (key) => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`list_${key}`} style={{ margin: '10px 0 15px 20px', padding: 0, listStyleType: 'disc', color: '#334155' }}>
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (trimmed.startsWith('###')) {
      flushTable(idx);
      flushList(idx);
      elements.push(
        <h4 key={`h3_${idx}`} style={{ fontSize: '1.05rem', color: '#1e293b', margin: '20px 0 8px 0', fontWeight: 700 }}>
          {parseBoldAndItalic(trimmed.slice(3).trim())}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith('##')) {
      flushTable(idx);
      flushList(idx);
      elements.push(
        <h3 key={`h2_${idx}`} style={{ fontSize: '1.2rem', color: '#0f172a', margin: '24px 0 12px 0', fontWeight: 800, borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
          {parseBoldAndItalic(trimmed.slice(2).trim())}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('#')) {
      flushTable(idx);
      flushList(idx);
      elements.push(
        <h2 key={`h1_${idx}`} style={{ fontSize: '1.4rem', color: '#1b5e20', margin: '28px 0 16px 0', fontWeight: 800 }}>
          {parseBoldAndItalic(trimmed.slice(1).trim())}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('|')) {
      flushList(idx);
      if (trimmed.includes('---') || trimmed.includes('-|-')) {
        continue;
      }
      const cells = trimmed.split('|').map(c => c.trim()).filter((_, cIdx, arr) => cIdx > 0 && cIdx < arr.length - 1);
      const isHeaderRow = lines[idx + 1] && (lines[idx + 1].includes('---') || lines[idx + 1].includes('-|-'));
      
      currentTableRows.push(
        <tr key={`tr_${idx}`}>
          {cells.map((cell, cIdx) => {
            if (isHeaderRow) {
              return (
                <th key={`th_${cIdx}`}>
                  {parseBoldAndItalic(cell)}
                </th>
              );
            } else {
              return (
                <td key={`td_${cIdx}`}>
                  {parseBoldAndItalic(cell)}
                </td>
              );
            }
          })}
        </tr>
      );
      continue;
    }

    if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
      flushTable(idx);
      const content = trimmed.slice(1).trim();
      currentListItems.push(
        <li key={`li_${idx}`} style={{ marginBottom: '6px', lineHeight: '1.5' }}>
          {parseBoldAndItalic(content)}
        </li>
      );
      continue;
    }

    if (trimmed) {
      flushTable(idx);
      flushList(idx);
      elements.push(
        <p key={`p_${idx}`} style={{ margin: '0 0 12px 0', color: '#334155', lineHeight: '1.6', fontSize: '0.92rem' }}>
          {parseBoldAndItalic(trimmed)}
        </p>
      );
    } else {
      flushTable(idx);
      flushList(idx);
    }
  }

  flushTable('end');
  flushList('end');
  return elements;
};

const splitMarkdownToTabs = (markdown) => {
  if (!markdown) return [];
  const sections = [];
  const headerRegex = /^##\s+(.+)$/gm;
  
  let match;
  const matches = [];
  headerRegex.lastIndex = 0;
  while ((match = headerRegex.exec(markdown)) !== null) {
    matches.push({
      title: match[1].trim(),
      index: match.index,
      headerLength: match[0].length
    });
  }
  
  if (matches.length === 0) {
    return [{ id: 'overview', title: 'Advisor Report', content: markdown }];
  }
  
  if (matches[0].index > 0) {
    const initialText = markdown.slice(0, matches[0].index).trim();
    if (initialText) {
      sections.push({
        id: 'overview',
        title: 'Overview',
        content: initialText
      });
    }
  }
  
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].headerLength;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const tabTitle = matches[i].title;
    const tabId = tabTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    sections.push({
      id: tabId || `tab_${i}`,
      title: tabTitle,
      content: markdown.slice(start, end).trim()
    });
  }
  
  return sections;
};

export const sanitizePolygon = (polygon) => {
  if (typeof polygon === 'string') {
    try { polygon = JSON.parse(polygon); } catch (e) {}
  }
  let sanitizedPolygon = [];
  if (Array.isArray(polygon)) {
    if (Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      sanitizedPolygon = polygon[0];
    } else {
      sanitizedPolygon = polygon;
    }
  }
  return sanitizedPolygon;
};

export const getCentroid = (poly) => {
  let latSum = 0;
  let lngSum = 0;
  let count = 0;
  poly.forEach(pt => {
    if (pt && pt.length >= 2) {
      latSum += pt[0];
      lngSum += pt[1];
      count++;
    }
  });
  if (count === 0) return { lat: 0, lng: 0 };
  return { lat: latSum / count, lng: lngSum / count };
};

export const getPolygonMinDistance = (polyA, polyB) => {
  let minDist = Infinity;
  for (const ptA of polyA) {
    for (const ptB of polyB) {
      const d = Math.hypot(ptA[0] - ptB[0], ptA[1] - ptB[1]);
      if (d < minDist) {
        minDist = d;
      }
    }
  }
  return minDist;
};

export const getPlanarBearing = (lat1, lng1, lat2, lng2) => {
  const dy = lat2 - lat1;
  const dx = lng2 - lng1;
  let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (angle + 360) % 360;
};

export const getAngleDifference = (a, b) => {
  let diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
};

export const getMoistureColor = (val) => {
  const pct = (val - 0.10) / 0.40; // 0.10 to 0.50 VWC range mapped to 0 to 1
  if (pct < 0.25) return '#bcaaa4'; // Dry: Earthy light brown/sand
  if (pct < 0.50) return '#90caf9'; // Moist: Soft light blue
  if (pct < 0.75) return '#42a5f5'; // Very moist: Bright blue
  return '#1565c0'; // Saturation: Wet deep blue
};

export const getSoilType = (rIdx) => {
  if (rIdx < 3) return 'Gravelly Loam';
  if (rIdx < 5) return 'Sandy Clay Loam';
  if (rIdx < 7) return 'Clay Loam';
  if (rIdx < 9) return 'Silty Clay';
  return 'Hydric Clay';
};

export const getSoilColor = (rIdx) => {
  if (rIdx < 3) return '#bcaaa4'; // Gravelly Loam
  if (rIdx < 5) return '#a1887f'; // Sandy Clay Loam
  if (rIdx < 7) return '#ffe0b2'; // Clay Loam
  if (rIdx < 9) return '#80cbc4'; // Silty Clay
  return '#00796b'; // Hydric Clay
};

export const getElevationColor = (val) => {
  if (val < 110) return '#006837'; // Dark green valley
  if (val < 150) return '#78c679'; // Green mid-slope
  if (val < 190) return '#fee08b'; // Soft yellow hill
  if (val < 220) return '#fdae61'; // Light orange ridge
  return '#d73027'; // Red peak
};

export const getFieldRotationAngle = (field) => {
  if (!field) return 0;
  if (field.layoutRotation !== undefined && field.layoutRotation !== null && field.layoutRotation !== '') {
    return parseInt(field.layoutRotation);
  }
  
  const sanitizedPolygon = sanitizePolygon(field.polygon);
  if (sanitizedPolygon.length < 3) return 0;
  
  const centroid = getCentroid(sanitizedPolygon);
  const projected = sanitizedPolygon.map(pt => {
    const dx = pt[1] - centroid.lng;
    const dy = pt[0] - centroid.lat;
    const x_geo = dx * Math.cos(centroid.lat * Math.PI / 180);
    const y_geo = dy;
    return { x_geo, y_geo };
  });

  let maxDist = -1;
  let bestPair = null;
  for (let i = 0; i < projected.length; i++) {
    for (let j = i + 1; j < projected.length; j++) {
      const dist = Math.hypot(projected[i].x_geo - projected[j].x_geo, projected[i].y_geo - projected[j].y_geo);
      if (dist > maxDist) {
        maxDist = dist;
        bestPair = [projected[i], projected[j]];
      }
    }
  }

  if (bestPair) {
    const dx = bestPair[1].x_geo - bestPair[0].x_geo;
    const dy = bestPair[1].y_geo - bestPair[0].y_geo;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 180;
    return Math.round(angle);
  }
  return 0;
};

export const getDirectionLabel = (angle) => {
  const normalized = ((angle % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
};

const PREMIUM_DARK_COLORS = ['#1b5e20', '#4e342e', '#1565c0', '#b71c1c', '#4a148c', '#006064', '#e65100'];

export const parseStructuredData = (text, area, selectedCrops, elevation, pois = [], field = null) => {
  let data = null;
  if (text) {
    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        data = JSON.parse(jsonMatch[1]);
      } catch (e) {
        // partial JSON or parse error, fallback
      }
    }
  }

  // Determine if swamp rice is allowed:
  // Allowed if:
  // 1. There is a wetland or water source POI on the farm, OR
  // 2. The field name, description, or notes contains "swamp" (case-insensitive)
  const fieldNameHasSwamp = field && (
    (field.name && field.name.toLowerCase().includes('swamp')) ||
    (field.description && field.description.toLowerCase().includes('swamp')) ||
    (field.notes && field.notes.toLowerCase().includes('swamp'))
  );
  
  const hasWaterSource = Array.isArray(pois) && pois.some(p => 
    p.type === 'Water Source' || 
    p.type === 'Wetland' || 
    (p.name && p.name.toLowerCase().includes('swamp')) ||
    (p.description && p.description.toLowerCase().includes('swamp'))
  );

  const isHighElevation = elevation !== undefined && elevation !== null && Number(elevation) >= 120;
  const isSwampRiceAllowed = (hasWaterSource || fieldNameHasSwamp) && !isHighElevation;

  if (data && data.monthlyProjections && data.annualRevenue && data.fieldLayout) {
    // Exclude Cassava from parsed JSON if elevation is too low (< 110m) or if field is Block C
    const isBlockC = field && field.name && field.name.toLowerCase().includes('block c');
    const tooLowElevation = elevation !== undefined && elevation !== null && Number(elevation) < 110;
    if (tooLowElevation || isBlockC) {
      if (Array.isArray(data.annualRevenue)) {
        data.annualRevenue = data.annualRevenue.filter(r => r && typeof r.crop === 'string' && !r.crop.toLowerCase().includes('cassava'));
      }
      if (Array.isArray(data.monthlyProjections)) {
        data.monthlyProjections = data.monthlyProjections.map(proj => {
          if (!proj) return proj;
          const newProj = { ...proj };
          Object.keys(newProj).forEach(key => {
            if (key.toLowerCase().includes('cassava')) {
              delete newProj[key];
            }
          });
          let newTotal = 0;
          Object.keys(newProj).forEach(key => {
            if (key !== 'month' && key !== 'total' && typeof newProj[key] === 'number') {
              newTotal += newProj[key];
            }
          });
          newProj.total = newTotal;
          return newProj;
        });
      }
    }

    // Exclude/Replace Swamp Rice if not allowed
    if (!isSwampRiceAllowed) {
      if (Array.isArray(data.annualRevenue)) {
        data.annualRevenue = data.annualRevenue.map(r => {
          if (r && typeof r.crop === 'string' && r.crop.toLowerCase().trim() === 'swamp rice') {
            return { ...r, crop: 'Upland Rice' };
          }
          return r;
        });
      }
      if (Array.isArray(data.monthlyProjections)) {
        data.monthlyProjections = data.monthlyProjections.map(proj => {
          if (!proj) return proj;
          const newProj = { ...proj };
          Object.keys(newProj).forEach(key => {
            if (key.toLowerCase().trim() === 'swamp rice') {
              newProj['Upland Rice'] = (newProj['Upland Rice'] || 0) + (newProj[key] || 0);
              delete newProj[key];
            }
          });
          return newProj;
        });
      }
      if (data.fieldLayout && Array.isArray(data.fieldLayout.cropAssignments)) {
        data.fieldLayout.cropAssignments = data.fieldLayout.cropAssignments.map((ass, idx) => {
          let updatedCrop = ass.crop;
          if (ass && typeof ass.crop === 'string' && ass.crop.toLowerCase().trim() === 'swamp rice') {
            updatedCrop = 'Upland Rice';
          }
          return {
            ...ass,
            crop: updatedCrop,
            color: PREMIUM_DARK_COLORS[idx % PREMIUM_DARK_COLORS.length]
          };
        });
      }
    }

    // Sort recommended crops from best to worst (descending order of revenue)
    if (Array.isArray(data.annualRevenue)) {
      data.annualRevenue.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    }

    // Crucial rule: Only include recommended crops in the field layout assignments
    const recommendedCropNames = new Set(
      Array.isArray(data.annualRevenue)
        ? data.annualRevenue.map(r => r && typeof r.crop === 'string' ? r.crop.toLowerCase().trim() : '')
        : []
    );
    
    if (data.fieldLayout && Array.isArray(data.fieldLayout.cropAssignments)) {
      data.fieldLayout.cropAssignments = data.fieldLayout.cropAssignments.filter(
        ass => ass && typeof ass.crop === 'string' && recommendedCropNames.has(ass.crop.toLowerCase().trim())
      );
    }
    
    return data;
  }
  
  // Fallback data generator if JSON is missing or incomplete
  let cropsList = [];
  if (selectedCrops && typeof selectedCrops === 'string') {
    cropsList = selectedCrops.split(',').map(c => c.trim()).filter(Boolean);
  } else if (Array.isArray(selectedCrops)) {
    cropsList = selectedCrops.map(c => String(c).trim()).filter(Boolean);
  } else {
    cropsList = ['Fever Leaf', 'Cassava', 'Swamp Rice'];
  }

  // Replace Swamp Rice with Upland Rice if not allowed in cropsList
  if (!isSwampRiceAllowed) {
    cropsList = cropsList.map(c => c.toLowerCase().trim() === 'swamp rice' ? 'Upland Rice' : c);
  }

  const totalAcres = Number(area) || 5;
  if (cropsList.length <= 3 && totalAcres > 5) {
    const defaultLargeCrops = ['Fever Leaf', 'Cassava', isSwampRiceAllowed ? 'Swamp Rice' : 'Upland Rice', 'Peppers', 'Sweet Potato', 'Oil Palm'];
    cropsList = Array.from(new Set([...cropsList, ...defaultLargeCrops]));
  }

  if (cropsList.length === 0) {
    cropsList.push('Fever Leaf', 'Cassava', isSwampRiceAllowed ? 'Swamp Rice' : 'Upland Rice');
  }

  // Enforce Cassava exclusion in fallback generator if elevation is low (< 110m) or if field is Block C
  const isBlockC = field && field.name && field.name.toLowerCase().includes('block c');
  const tooLowElevation = elevation !== undefined && elevation !== null && Number(elevation) < 110;
  if (tooLowElevation || isBlockC) {
    cropsList = cropsList.filter(c => !c.toLowerCase().includes('cassava'));
    if (cropsList.length === 0) cropsList.push('Fever Leaf', isSwampRiceAllowed ? 'Swamp Rice' : 'Upland Rice');
  }
  
  // Generate realistic annual revenues
  const revenueRates = {
    'fever leaf': 1800,
    'cassava': 900,
    'rice': 1100,
    'swamp rice': 1200,
    'upland rice': 1100,
    'cocoa': 2200,
    'oil palm': 2500,
    'rubber': 2000,
    'vegetables': 1500
  };
  
  const annualRevenue = cropsList.map((crop, idx) => {
    const key = crop.toLowerCase();
    const rate = revenueRates[key] || (1000 + (idx * 200));
    const cropAcres = totalAcres / cropsList.length;
    const revenue = Math.round(cropAcres * rate);
    return { crop, revenue };
  });

  // Sort from best to worst (descending order of revenue)
  annualRevenue.sort((a, b) => b.revenue - a.revenue);

  // Generate sorted crop list matching order from best to worst
  const sortedCropsList = annualRevenue.map(r => r.crop);

  // Group and sort companion crops in adjacent zones matching field conditions:
  // Root crops (Cassava, Yam) / Trees (Oil Palm, Cocoa, Rubber) -> Upland (top rows 0-3)
  // Vegetables / Leafy Greens (Fever Leaf) / Pest-repellers (Peppers, Basil) -> Mid-elevation (middle rows 4-7)
  // Water-tolerant crops (Swamp Rice, Eddoe) -> Lowland/Wet (bottom rows 8-9)
  const getCropPlacementScore = (cropName) => {
    const name = cropName.toLowerCase();
    if (name.includes('rice') || name.includes('eddoe')) return 3; // Lowland/Wet (Bottom)
    if (name.includes('fever') || name.includes('pepper') || name.includes('vegetable') || name.includes('sweet potato') || name.includes('basil')) {
      if (name.includes('pepper') || name.includes('basil')) return 1.5; // Companion directly next to leafy greens
      return 2; // Mid-elevation (Middle)
    }
    return 1; // Upland/Dry (Top)
  };

  const layoutCrops = [...sortedCropsList].sort((a, b) => getCropPlacementScore(a) - getCropPlacementScore(b));
  
  // Generate monthly projections (12 months)
  const monthlyProjections = [];
  const cropColors = PREMIUM_DARK_COLORS;
  
  for (let m = 1; m <= 12; m++) {
    const proj = { month: `Month ${m}` };
    let monthlyTotal = 0;
    
    sortedCropsList.forEach((crop) => {
      const cropRev = annualRevenue.find(r => r.crop === crop)?.revenue || 1000;
      let seasonalFactor = 1.0;
      if (m >= 5 && m <= 10) {
        seasonalFactor = crop.toLowerCase().includes('rice') ? 1.3 : 0.8;
      } else {
        seasonalFactor = crop.toLowerCase().includes('rice') ? 0.7 : 1.2;
      }
      
      const baseMonthly = cropRev / 12;
      const amount = Math.round(baseMonthly * seasonalFactor * (0.9 + Math.random() * 0.2));
      proj[crop] = amount;
      monthlyTotal += amount;
    });
    
    proj.total = monthlyTotal;
    monthlyProjections.push(proj);
  }
  
  // Generate graphical field layout structure
  const fieldLayout = {
    rows: 10,
    bedsPerRow: 4,
    bedWidth: 1.2,
    rowSpacing: 0.6,
    cropAssignments: layoutCrops.map((crop, idx) => {
      const color = cropColors[idx % cropColors.length];
      const startRow = Math.floor((idx / layoutCrops.length) * 10);
      const endRow = Math.floor(((idx + 1) / layoutCrops.length) * 10) - 1;
      return {
        crop,
        color,
        startRow,
        endRow: endRow < startRow ? startRow : endRow
      };
    })
  };
  
  return { monthlyProjections, annualRevenue, fieldLayout };
};

const extractAndStripJson = (markdown) => {
  if (!markdown) return { cleanMarkdown: '', data: null };
  const jsonMatch = markdown.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  let data = null;
  let cleanMarkdown = markdown;
  if (jsonMatch) {
    try {
      data = JSON.parse(jsonMatch[1]);
      cleanMarkdown = markdown.replace(/```json\s*(\{[\s\S]*?\})\s*```/, '').trim();
    } catch (e) {
      // partial json, ignore
    }
  } else {
    const partialIndex = markdown.indexOf('```json');
    if (partialIndex !== -1) {
      cleanMarkdown = markdown.substring(0, partialIndex).trim();
    }
  }
  return { cleanMarkdown, data };
};

export const getReportStructuredData = (report, area, selectedCrops, pois = [], field = null) => {
  if (!report) return null;
  let data = null;
  if (report.structuredData) {
    if (typeof report.structuredData === 'string') {
      try {
        data = JSON.parse(report.structuredData);
      } catch (e) {
        // ignore and fallback
      }
    } else {
      data = JSON.parse(JSON.stringify(report.structuredData)); // Deep copy to prevent mutating store values directly
    }
  }
  
  const elevation = report.promptInputs?.elevation;
  
  const fieldNameHasSwamp = field && (
    (field.name && field.name.toLowerCase().includes('swamp')) ||
    (field.description && field.description.toLowerCase().includes('swamp')) ||
    (field.notes && field.notes.toLowerCase().includes('swamp'))
  );
  const hasWaterSource = Array.isArray(pois) && pois.some(p => 
    p.type === 'Water Source' || 
    p.type === 'Wetland' || 
    (p.name && p.name.toLowerCase().includes('swamp')) ||
    (p.description && p.description.toLowerCase().includes('swamp'))
  );
  const isHighElevation = elevation !== undefined && elevation !== null && Number(elevation) >= 120;
  const isSwampRiceAllowed = (hasWaterSource || fieldNameHasSwamp) && !isHighElevation;

  if (!data) {
    let fullText = '';
    if (report.responseTabs) {
      fullText = report.responseTabs.map(t => `## ${t.title}\n${t.content}`).join('\n');
    }
    data = parseStructuredData(fullText, area, selectedCrops, elevation, pois, field);
  } else {
    // Sanitize loaded structure dynamically for exclusions
    const isBlockC = field && field.name && field.name.toLowerCase().includes('block c');
    const tooLowElevation = elevation !== undefined && elevation !== null && Number(elevation) < 110;
    if (tooLowElevation || isBlockC) {
      if (Array.isArray(data.annualRevenue)) {
        data.annualRevenue = data.annualRevenue.filter(r => r && typeof r.crop === 'string' && !r.crop.toLowerCase().includes('cassava'));
      }
      if (Array.isArray(data.monthlyProjections)) {
        data.monthlyProjections = data.monthlyProjections.map(proj => {
          if (!proj) return proj;
          const newProj = { ...proj };
          Object.keys(newProj).forEach(key => {
            if (key.toLowerCase().includes('cassava')) {
              delete newProj[key];
            }
          });
          let newTotal = 0;
          Object.keys(newProj).forEach(key => {
            if (key !== 'month' && key !== 'total' && typeof newProj[key] === 'number') {
              newTotal += newProj[key];
            }
          });
          newProj.total = newTotal;
          return newProj;
        });
      }
    }

    if (!isSwampRiceAllowed) {
      if (Array.isArray(data.annualRevenue)) {
        data.annualRevenue = data.annualRevenue.map(r => {
          if (r && typeof r.crop === 'string' && r.crop.toLowerCase().trim() === 'swamp rice') {
            return { ...r, crop: 'Upland Rice' };
          }
          return r;
        });
      }
      if (Array.isArray(data.monthlyProjections)) {
        data.monthlyProjections = data.monthlyProjections.map(proj => {
          if (!proj) return proj;
          const newProj = { ...proj };
          Object.keys(newProj).forEach(key => {
            if (key.toLowerCase().trim() === 'swamp rice') {
              newProj['Upland Rice'] = (newProj['Upland Rice'] || 0) + (newProj[key] || 0);
              delete newProj[key];
            }
          });
          return newProj;
        });
      }
      if (data.fieldLayout && Array.isArray(data.fieldLayout.cropAssignments)) {
        data.fieldLayout.cropAssignments = data.fieldLayout.cropAssignments.map((ass, idx) => {
          let updatedCrop = ass.crop;
          if (ass && typeof ass.crop === 'string' && ass.crop.toLowerCase().trim() === 'swamp rice') {
            updatedCrop = 'Upland Rice';
          }
          return {
            ...ass,
            crop: updatedCrop,
            color: PREMIUM_DARK_COLORS[idx % PREMIUM_DARK_COLORS.length]
          };
        });
      }
    }

    // Sort recommended crops from best to worst (descending order of revenue)
    if (Array.isArray(data.annualRevenue)) {
      data.annualRevenue.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    }

    // Filter layout crop assignments to strictly match recommended crops
    const recommendedCropNames = new Set(
      Array.isArray(data.annualRevenue)
        ? data.annualRevenue.map(r => r && typeof r.crop === 'string' ? r.crop.toLowerCase().trim() : '')
        : []
    );
    if (data.fieldLayout && Array.isArray(data.fieldLayout.cropAssignments)) {
      data.fieldLayout.cropAssignments = data.fieldLayout.cropAssignments.filter(
        ass => ass && typeof ass.crop === 'string' && recommendedCropNames.has(ass.crop.toLowerCase().trim())
      );
    }
  }
  return data;
};

const RechartsVisualizer = ({ data }) => {
  const { monthlyProjections = [], annualRevenue = [] } = data || {};
  
  const COLORS = PREMIUM_DARK_COLORS;
  
  const cropKeys = useMemo(() => {
    if (monthlyProjections.length === 0) return [];
    return Object.keys(monthlyProjections[0]).filter(k => k !== 'month' && k !== 'total');
  }, [monthlyProjections]);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '15px 0' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Pie Chart: Revenue Distribution */}
        <div style={{ flex: '1 1 280px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#1e293b', fontWeight: 700 }}>Annual Revenue Distribution (USD)</h5>
          {annualRevenue.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.85rem' }}>No revenue data available.</div>
          ) : (
            <div style={{ flex: 1, minHeight: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={annualRevenue}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="revenue"
                    nameKey="crop"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {annualRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value != null ? `$${Number(value).toLocaleString()}` : '', 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        
        {/* Bar Chart: 12-Month Progression */}
        <div style={{ flex: '2 1 420px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '320px' }}>
          <h5 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#1e293b', fontWeight: 700 }}>12-Month Projected Gross Revenue (USD)</h5>
          {monthlyProjections.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.85rem' }}>No projection data available.</div>
          ) : (
            <div style={{ flex: 1, minHeight: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProjections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip formatter={(value) => [value != null ? `$${Number(value).toLocaleString()}` : '', 'Revenue']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {cropKeys.map((key, idx) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[idx % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};

const isPointInPolygon = (x, y, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi || 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const rotatePoint = (x, y, angle, cx, cy) => {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos
  ];
};

const getRenderedLabels = (
  cropAssignments,
  rotatedPolygonPoints,
  gridRotationAngle,
  gridCenterX,
  gridCenterY,
  topPadding,
  bedHeight,
  verticalSpacing,
  w_grid,
  getZoneLabelCoords,
  activeOverlay,
  selectedMonth
) => {
  const rad = (-gridRotationAngle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const labels = cropAssignments.map((a, idx) => {
    let trimmedCrop = (a.crop || '').trim();
    if (activeOverlay === 'rotation') {
      trimmedCrop = getRotationState(a.crop, selectedMonth).label;
    }
    const labelWidth = Math.max(50, Math.ceil(trimmedCrop.length * 7.5 + 16));
    const halfW = labelWidth / 2;

    const y_start = topPadding + a.startRow * (bedHeight + verticalSpacing) - verticalSpacing / 2;
    const y_end = topPadding + (a.endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;
    const coords = getZoneLabelCoords(a.startRow, a.endRow);
    const labelX = coords.x;
    const labelY = coords.y;
    const availableWidth = coords.width;
    const visibleHeight = coords.height;

    const localCorners = [
      [-halfW, -15],
      [halfW, -15],
      [-halfW, 15],
      [halfW, 15]
    ];

    let fits = true;
    if (rotatedPolygonPoints.length === 0) {
      fits = false;
    } else {
      for (const [dx, dy] of localCorners) {
        const cx = labelX + dx * cos - dy * sin;
        const cy = labelY + dx * sin + dy * cos;

        if (cy < y_start || cy > y_end) {
          fits = false;
          break;
        }

        if (!isPointInPolygon(cx, cy, rotatedPolygonPoints)) {
          fits = false;
          break;
        }
      }
    }

    let drawX = labelX;
    let drawY = labelY;
    const side = fits ? 'inside' : (labelX < gridCenterX ? 'left' : 'right');

    return {
      idx,
      crop: trimmedCrop,
      color: a.color,
      startRow: a.startRow,
      endRow: a.endRow,
      labelX,
      labelY,
      drawX,
      drawY,
      labelWidth,
      halfW,
      fits,
      side,
      cos,
      sin
    };
  });

  // Group outside labels by side
  const leftLabels = labels.filter(l => l.side === 'left').sort((a, b) => a.labelY - b.labelY);
  const rightLabels = labels.filter(l => l.side === 'right').sort((a, b) => a.labelY - b.labelY);

  const resolveOverlaps = (list) => {
    if (list.length <= 1) return;
    const minSpacing = 70; // 30px label height + 40px gap

    // Forward sweep
    for (let i = 1; i < list.length; i++) {
      if (list[i].drawY < list[i - 1].drawY + minSpacing) {
        list[i].drawY = list[i - 1].drawY + minSpacing;
      }
    }

    // Backward sweep
    for (let i = list.length - 2; i >= 0; i--) {
      if (list[i].drawY > list[i + 1].drawY - minSpacing) {
        list[i].drawY = list[i + 1].drawY - minSpacing;
      }
    }
  };

  resolveOverlaps(leftLabels);
  resolveOverlaps(rightLabels);

  // Reconstruct label positions and calculate callout lines
  return labels.map(l => {
    if (l.fits) {
      return { ...l, calloutLine: null };
    }

    // Find boundaries at labelY, labelY - 15, and labelY + 15
    let minX = w_grid;
    let maxX = 0;
    const testYs = [l.labelY - 15, l.labelY, l.labelY + 15];

    testYs.forEach(Y => {
      const intersections = [];
      for (let j = 0; j < rotatedPolygonPoints.length; j++) {
        const pt1 = rotatedPolygonPoints[j];
        const pt2 = rotatedPolygonPoints[(j + 1) % rotatedPolygonPoints.length];
        const y1 = pt1[1];
        const y2 = pt2[1];
        if ((y1 >= Y && y2 <= Y) || (y2 >= Y && y1 <= Y)) {
          if (Math.abs(y2 - y1) > 0.0001) {
            const X = pt1[0] + ((Y - y1) * (pt2[0] - pt1[0])) / (y2 - y1);
            intersections.push(X);
          }
        }
      }
      if (intersections.length >= 2) {
        minX = Math.min(minX, ...intersections);
        maxX = Math.max(maxX, ...intersections);
      }
    });

    let drawX = l.labelX;
    let calloutLine = null;

    if (minX <= maxX) {
      if (l.side === 'left') {
        drawX = minX - (l.halfW + 20);
      } else {
        drawX = maxX + (l.halfW + 20);
      }
      calloutLine = { x1: drawX, x2: l.labelX, y1: l.drawY, y2: l.labelY };
    }

    return {
      ...l,
      drawX,
      calloutLine
    };
  });
};

const getRotationState = (cropName, month) => {
  const nameUpper = (cropName || '').toUpperCase();
  
  if (nameUpper.includes('SWEET POTATO')) {
    if (month >= 1 && month <= 4) {
      return { label: 'SWEET POTATO (MATURING)', color: '#4e342e' };
    } else if (month >= 5 && month <= 6) {
      return { label: 'COWPEA (SOIL HEALTH ROTATION)', color: '#2e7d32' };
    } else if (month >= 7 && month <= 10) {
      return { label: 'SWEET POTATO (CYCLE 2)', color: '#5d4037' };
    } else {
      return { label: 'GROUNDNUT (ROTATION / COVER)', color: '#558b2f' };
    }
  }
  
  if (nameUpper.includes('FEVER LEAF')) {
    if (month === 1) {
      return { label: 'FEVER LEAF (ESTABLISHING)', color: '#1b5e20' };
    } else {
      return { label: 'FEVER LEAF (RECURRING HARVEST)', color: '#2e7d32' };
    }
  }
  
  if (nameUpper.includes('CASSAVA')) {
    if (month >= 1 && month <= 9) {
      return { label: 'CASSAVA (MATURING)', color: '#8d6e63' };
    } else if (month === 10) {
      return { label: 'CASSAVA (HARVESTED / BARE)', color: '#3e2723' };
    } else {
      return { label: 'COWPEA (COVER CROP ROTATION)', color: '#2e7d32' };
    }
  }
  
  if (nameUpper.includes('RICE')) {
    if (month >= 1 && month <= 4) {
      return { label: `${cropName} (MATURING)`, color: '#fbc02d' };
    } else if (month === 5) {
      return { label: `${cropName} (HARVESTING)`, color: '#f57f17' };
    } else if (month >= 6 && month <= 7) {
      return { label: 'COWPEA (NITROGEN-FIXING ROTATION)', color: '#2e7d32' };
    } else if (month >= 8 && month <= 11) {
      return { label: `${cropName} (CYCLE 2)`, color: '#fbc02d' };
    } else {
      return { label: 'FALLOW / COVER CROP', color: '#78909c' };
    }
  }
  
  if (nameUpper.includes('PEPPER')) {
    if (month >= 1 && month <= 2) {
      return { label: 'PEPPER (ESTABLISHING)', color: '#ff8f00' };
    } else if (month >= 3 && month <= 6) {
      return { label: 'PEPPER (HARVESTING)', color: '#c62828' };
    } else if (month >= 7 && month <= 8) {
      return { label: 'COWPEA (SOIL HEALTH ROTATION)', color: '#2e7d32' };
    } else {
      return { label: 'PEPPER (CYCLE 2)', color: '#c62828' };
    }
  }
  
  if (nameUpper.includes('PALM') || nameUpper.includes('COCOA') || nameUpper.includes('COFFEE')) {
    return { label: `${cropName} (PERENNIAL)`, color: '#1b5e20' };
  }
  
  if (month >= 5 && month <= 6) {
    return { label: 'COWPEA (ROTATION / SOIL HEALTH)', color: '#2e7d32' };
  } else if (month >= 11 && month <= 12) {
    return { label: 'FALLOW / COVER CROP', color: '#78909c' };
  } else {
    return { label: `${cropName} (ACTIVE)`, color: '#e65100' };
  }
};

const CROP_METRICS = {
  CORN: { pricePerUnit: 6.00, unit: 'bushel', maturityDays: 90, spacingMeters: 0.3, yieldPerPlant: 0.015 },
  PEPPER: { pricePerUnit: 1.20, unit: 'kg', maturityDays: 80, spacingMeters: 0.45, yieldPerPlant: 0.4 },
  OKRA: { pricePerUnit: 0.80, unit: 'kg', maturityDays: 60, spacingMeters: 0.4, yieldPerPlant: 0.3 },
  CASSAVA: { pricePerUnit: 0.15, unit: 'kg', maturityDays: 270, spacingMeters: 0.9, yieldPerPlant: 2.5 },
  BEANS: { pricePerUnit: 1.10, unit: 'kg', maturityDays: 60, spacingMeters: 0.15, yieldPerPlant: 0.05 },
  CABBAGE: { pricePerUnit: 0.60, unit: 'head', maturityDays: 85, spacingMeters: 0.4, yieldPerPlant: 0.8 },
  TOMATO: { pricePerUnit: 0.90, unit: 'kg', maturityDays: 75, spacingMeters: 0.5, yieldPerPlant: 2.0 },
  COCOA: { pricePerUnit: 2.20, unit: 'kg', maturityDays: 1000, spacingMeters: 3.0, yieldPerPlant: 0.8 },
  COFFEE: { pricePerUnit: 1.80, unit: 'kg', maturityDays: 1000, spacingMeters: 2.5, yieldPerPlant: 0.6 },
  PALM: { pricePerUnit: 12.00, unit: 'bunch', maturityDays: 1200, spacingMeters: 9.0, yieldPerPlant: 6.0 },
  FEVER_LEAF: { pricePerUnit: 0.60, unit: 'kg', maturityDays: 90, spacingMeters: 0.5, yieldPerPlant: 0.3 },
  DEFAULT: { pricePerUnit: 0.80, unit: 'kg', maturityDays: 90, spacingMeters: 0.4, yieldPerPlant: 0.2 }
};

const getCropRevenueMetrics = (cropName) => {
  const nameUpper = (cropName || '').toUpperCase();
  if (nameUpper.includes('CORN') || nameUpper.includes('MAIZE')) return CROP_METRICS.CORN;
  if (nameUpper.includes('PEPPER')) return CROP_METRICS.PEPPER;
  if (nameUpper.includes('OKRA')) return CROP_METRICS.OKRA;
  if (nameUpper.includes('CASSAVA')) return CROP_METRICS.CASSAVA;
  if (nameUpper.includes('BEAN')) return CROP_METRICS.BEANS;
  if (nameUpper.includes('CABBAGE')) return CROP_METRICS.CABBAGE;
  if (nameUpper.includes('TOMATO')) return CROP_METRICS.TOMATO;
  if (nameUpper.includes('COCOA')) return CROP_METRICS.COCOA;
  if (nameUpper.includes('COFFEE')) return CROP_METRICS.COFFEE;
  if (nameUpper.includes('PALM')) return CROP_METRICS.PALM;
  if (nameUpper.includes('FEVER') || nameUpper.includes('LEAF')) return CROP_METRICS.FEVER_LEAF;
  return CROP_METRICS.DEFAULT;
};

const GraphicalFieldLayout = ({ layout, area, field }) => {
  const { rows = 10, bedsPerRow = 4, bedWidth = 1.2, rowSpacing = 0.6, cropAssignments = [] } = layout || {};
  
  const fields = useSelector(state => state.fields?.data) || [];
  
  const stats = useMemo(() => {
    if (!field || !field.polygon) return { elevation: 120 };
    try {
      return extractSpatialStats(field.polygon);
    } catch (e) {
      return { elevation: 120 };
    }
  }, [field]);

  const elevationVal = stats?.elevation || 120;

  const [activeOverlay, setActiveOverlay] = useState('none');
  const [zoomScale, setZoomScale] = useState(1.0);
  const [cropLegendsExpanded, setCropLegendsExpanded] = useState(true);
  const [moistureLegendExpanded, setMoistureLegendExpanded] = useState(false);
  const [soilLegendExpanded, setSoilLegendExpanded] = useState(false);
  const [elevationLegendExpanded, setElevationLegendExpanded] = useState(false);
  const [rotationLegendExpanded, setRotationLegendExpanded] = useState(false);
  const [revenueLegendExpanded, setRevenueLegendExpanded] = useState(true);
  const [spacingSpecsExpanded, setSpacingSpecsExpanded] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(1);

  const handleOverlayChange = (overlayId) => {
    setActiveOverlay(overlayId);
    setCropLegendsExpanded(overlayId === 'none');
    setMoistureLegendExpanded(overlayId === 'moisture');
    setSoilLegendExpanded(overlayId === 'soil');
    setElevationLegendExpanded(overlayId === 'elevation');
    setRotationLegendExpanded(overlayId === 'rotation');
    setRevenueLegendExpanded(overlayId === 'revenue');
  };
  
  const bedHeight = 30;
  const bedWidthPx = 80;
  const horizontalSpacing = 15;
  const verticalSpacing = 10;
  
  const topPadding = 50;
  const bottomPadding = 50;
  const leftPadding = 125;
  const rightPadding = 125;
  
  const width = bedsPerRow * (bedWidthPx + horizontalSpacing) - horizontalSpacing + leftPadding + rightPadding;
  const height = rows * (bedHeight + verticalSpacing) - verticalSpacing + topPadding + bottomPadding;
  
  const w_grid = bedsPerRow * (bedWidthPx + horizontalSpacing) - horizontalSpacing;
  const h_grid = rows * (bedHeight + verticalSpacing) - verticalSpacing;
  const isGridVertical = h_grid > w_grid;

  const rotationAngle = getFieldRotationAngle(field);
  const targetAngle = 0; // Reset targetAngle to 0 so the polygon is oriented true North is Up
  const gridRotationAngle = isGridVertical ? (rotationAngle - 90) : rotationAngle;

  const compassAngle = 0;
  const labelAngle = 0;

  const topDir = getDirectionLabel(labelAngle);
  const bottomDir = getDirectionLabel(180 + labelAngle);
  const leftDir = getDirectionLabel(270 + labelAngle);
  const rightDir = getDirectionLabel(90 + labelAngle);

  const gridCenterX = leftPadding + w_grid / 2;
  const gridRightX = leftPadding + w_grid;
  const gridBottomY = topPadding + h_grid;
  const gridCenterY = topPadding + h_grid / 2;

  // Compass Rose center in the empty bottom-right corner space
  const cx = width - 45;
  const cy = height - 45;
  const northAngleRad = (compassAngle * Math.PI) / 180;
  const nx = cx + 11 * Math.sin(northAngleRad);
  const ny = cy - 11 * Math.cos(northAngleRad);
  const sx = cx - 11 * Math.sin(northAngleRad);
  const sy = cy + 11 * Math.cos(northAngleRad);
  const tx = cx + 22 * Math.sin(northAngleRad);
  const ty = cy - 22 * Math.cos(northAngleRad) + 3;

  // Calculate adjacent fields by side
  const adjacentFieldsBySide = useMemo(() => {
    const sides = { top: [], right: [], bottom: [], left: [] };
    if (!field) return sides;
    
    const polyA = sanitizePolygon(field.polygon);
    if (polyA.length < 3) return sides;
    
    const cA = getCentroid(polyA);
    
    fields.forEach(otherField => {
      if (otherField.id === field.id) return;
      const polyB = sanitizePolygon(otherField.polygon);
      if (polyB.length < 3) return;
      
      const dist = getPolygonMinDistance(polyA, polyB);
      if (dist <= 0.0008) {
        const cB = getCentroid(polyB);

        // Exclude fields within fields (nested fields)
        const isNested = isPointInPolygon(cA.lat, cA.lng, polyB) || isPointInPolygon(cB.lat, cB.lng, polyA);
        if (isNested) return;

        const bearing = getPlanarBearing(cA.lat, cA.lng, cB.lat, cB.lng);
        
        const diffTop = getAngleDifference(bearing, targetAngle);
        const diffRight = getAngleDifference(bearing, 90 + targetAngle);
        const diffBottom = getAngleDifference(bearing, 180 + targetAngle);
        const diffLeft = getAngleDifference(bearing, 270 + targetAngle);
        
        const minDiff = Math.min(diffTop, diffRight, diffBottom, diffLeft);
        if (minDiff === diffTop) {
          sides.top.push(otherField.name);
        } else if (minDiff === diffRight) {
          sides.right.push(otherField.name);
        } else if (minDiff === diffBottom) {
          sides.bottom.push(otherField.name);
        } else {
          sides.left.push(otherField.name);
        }
      }
    });
    
    return sides;
  }, [field, fields, targetAngle]);

  // Calculate scaled & oriented field polygon vertices for SVG overlay
  const fieldPolygonPoints = useMemo(() => {
    if (!field) return [];
    const poly = sanitizePolygon(field.polygon);
    if (poly.length < 3) return [];
    
    // Centroid of physical polygon
    const centroid = getCentroid(poly);
    
    // Project vertices to a flat local space preserving aspect ratio (isometric)
    const projected = poly.map(pt => {
      const dx = pt[1] - centroid.lng;
      const dy = pt[0] - centroid.lat;
      const x_geo = dx * Math.cos(centroid.lat * Math.PI / 180);
      const y_geo = dy;
      
      const rad = (targetAngle * Math.PI) / 180;
      const rx = x_geo * Math.cos(rad) - y_geo * Math.sin(rad);
      const ry = x_geo * Math.sin(rad) + y_geo * Math.cos(rad);
      return { rx, ry };
    });
    
    // Bounds of rotated projected points
    let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
    projected.forEach(pt => {
      if (pt.rx < minRx) minRx = pt.rx;
      if (pt.rx > maxRx) maxRx = pt.rx;
      if (pt.ry < minRy) minRy = pt.ry;
      if (pt.ry > maxRy) maxRy = pt.ry;
    });
    
    const w_poly = maxRx - minRx || 0.00001;
    const h_poly = maxRy - minRy || 0.00001;
    
    const rxCenter = (minRx + maxRx) / 2;
    const ryCenter = (minRy + maxRy) / 2;

    const scale = Math.min(w_grid / w_poly, h_grid / h_poly);
    
    // Translate relative to grid center
    return projected.map(pt => {
      const x_svg = gridCenterX + (pt.rx - rxCenter) * scale;
      const y_svg = gridCenterY - (pt.ry - ryCenter) * scale;
      return [x_svg, y_svg];
    });
  }, [field, targetAngle, w_grid, h_grid, gridCenterX, gridCenterY]);

  const polyPointsStr = useMemo(() => {
    return fieldPolygonPoints.map(pt => `${pt[0]},${pt[1]}`).join(' ');
  }, [fieldPolygonPoints]);

  const rotatedPolygonPoints = useMemo(() => {
    if (fieldPolygonPoints.length === 0) return [];
    const rad = (-gridRotationAngle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return fieldPolygonPoints.map(pt => {
      const dx = pt[0] - gridCenterX;
      const dy = pt[1] - gridCenterY;
      const rx = gridCenterX + dx * cos - dy * sin;
      const ry = gridCenterY + dx * sin + dy * cos;
      return [rx, ry];
    });
  }, [fieldPolygonPoints, gridRotationAngle, gridCenterX, gridCenterY]);

  const zoneAreaRatios = useMemo(() => {
    if (rotatedPolygonPoints.length === 0) {
      return cropAssignments.map(a => (a.endRow - a.startRow + 1) / rows);
    }

    const polyMinY = Math.min(...rotatedPolygonPoints.map(pt => pt[1]));
    const polyMaxY = Math.max(...rotatedPolygonPoints.map(pt => pt[1]));

    const getWidthAtY = (Y) => {
      const intersections = [];
      for (let j = 0; j < rotatedPolygonPoints.length; j++) {
        const pt1 = rotatedPolygonPoints[j];
        const pt2 = rotatedPolygonPoints[(j + 1) % rotatedPolygonPoints.length];
        const y1 = pt1[1];
        const y2 = pt2[1];
        if ((y1 >= Y && y2 <= Y) || (y2 >= Y && y1 <= Y)) {
          if (Math.abs(y2 - y1) > 0.0001) {
            const X = pt1[0] + ((Y - y1) * (pt2[0] - pt1[0])) / (y2 - y1);
            intersections.push(X);
          }
        }
      }
      if (intersections.length < 2) return 0;
      return Math.max(...intersections) - Math.min(...intersections);
    };

    // Calculate total polygon area representation
    let totalSampleWidth = 0;
    const samplesTotal = 100;
    const stepTotal = (polyMaxY - polyMinY) / samplesTotal;
    for (let i = 0; i <= samplesTotal; i++) {
      totalSampleWidth += getWidthAtY(polyMinY + i * stepTotal);
    }

    const rawFractions = cropAssignments.map(a => {
      const y_start = topPadding + a.startRow * (bedHeight + verticalSpacing) - verticalSpacing / 2;
      const y_end = topPadding + (a.endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;

      // Integrate strip width
      const minVisibleY = Math.max(y_start, polyMinY);
      const maxVisibleY = Math.min(y_end, polyMaxY);
      if (minVisibleY >= maxVisibleY) return 0;

      let stripSampleWidth = 0;
      const samplesStrip = 20;
      const stepStrip = (maxVisibleY - minVisibleY) / samplesStrip;
      for (let i = 0; i <= samplesStrip; i++) {
        stripSampleWidth += getWidthAtY(minVisibleY + i * stepStrip);
      }

      // Proportional strip area relative to total samples
      return (stripSampleWidth * stepStrip) / (totalSampleWidth * stepTotal || 1);
    });

    const sumFractions = rawFractions.reduce((sum, f) => sum + f, 0);
    if (sumFractions <= 0) {
      return cropAssignments.map(a => (a.endRow - a.startRow + 1) / rows);
    }

    return rawFractions.map(f => f / sumFractions);
  }, [cropAssignments, rotatedPolygonPoints, rows, bedHeight, verticalSpacing, topPadding]);

  const getZoneLabelCoords = (startRow, endRow) => {
    const y_start = topPadding + startRow * (bedHeight + verticalSpacing) - verticalSpacing / 2;
    const y_end = topPadding + (endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;
    const zoneHeight = y_end - y_start;
    const midY = y_start + zoneHeight / 2;
    
    if (rotatedPolygonPoints.length === 0) {
      return { x: gridCenterX, y: midY, width: w_grid, height: zoneHeight };
    }

    const polyMinY = Math.min(...rotatedPolygonPoints.map(pt => pt[1]));
    const polyMaxY = Math.max(...rotatedPolygonPoints.map(pt => pt[1]));
    const minVisibleY = Math.max(y_start, polyMinY);
    const maxVisibleY = Math.min(y_end, polyMaxY);

    if (minVisibleY >= maxVisibleY) {
      return { x: gridCenterX, y: midY, width: w_grid, height: 0 };
    }

    const bestY = (minVisibleY + maxVisibleY) / 2;
    const visibleHeight = maxVisibleY - minVisibleY;

    // Calculate exact intersections at bestY to find centerX
    const intersections = [];
    const Y = bestY;
    for (let j = 0; j < rotatedPolygonPoints.length; j++) {
      const pt1 = rotatedPolygonPoints[j];
      const pt2 = rotatedPolygonPoints[(j + 1) % rotatedPolygonPoints.length];
      const y1 = pt1[1];
      const y2 = pt2[1];
      if ((y1 >= Y && y2 <= Y) || (y2 >= Y && y1 <= Y)) {
        if (Math.abs(y2 - y1) > 0.0001) {
          const X = pt1[0] + ((Y - y1) * (pt2[0] - pt1[0])) / (y2 - y1);
          intersections.push(X);
        }
      }
    }

    let centerX = gridCenterX;
    let widthAtBestY = w_grid;

    if (intersections.length >= 2) {
      const minX = Math.min(...intersections);
      const maxX = Math.max(...intersections);
      widthAtBestY = maxX - minX;
      centerX = (minX + maxX) / 2;
    }

    // Check available width across the top, center, and bottom of the label box height (30px total height, so offsets -15, 0, 15)
    let minWidthOverLabel = widthAtBestY;
    const yOffsets = [-15, 0, 15];
    for (const offset of yOffsets) {
      const testY = bestY + offset;
      const testIntersections = [];
      for (let j = 0; j < rotatedPolygonPoints.length; j++) {
        const pt1 = rotatedPolygonPoints[j];
        const pt2 = rotatedPolygonPoints[(j + 1) % rotatedPolygonPoints.length];
        const y1 = pt1[1];
        const y2 = pt2[1];
        if ((y1 >= testY && y2 <= testY) || (y2 >= testY && y1 <= testY)) {
          if (Math.abs(y2 - y1) > 0.0001) {
            const X = pt1[0] + ((testY - y1) * (pt2[0] - pt1[0])) / (y2 - y1);
            testIntersections.push(X);
          }
        }
      }
      if (testIntersections.length >= 2) {
        const w = Math.max(...testIntersections) - Math.min(...testIntersections);
        if (w < minWidthOverLabel) {
          minWidthOverLabel = w;
        }
      } else {
        // If the label box overlaps outside the visible polygon range
        minWidthOverLabel = 0;
      }
    }
    
    return { x: centerX, y: bestY, width: minWidthOverLabel, height: visibleHeight };
  };

  const renderedLabels = useMemo(() => {
    return getRenderedLabels(
      cropAssignments,
      rotatedPolygonPoints,
      gridRotationAngle,
      gridCenterX,
      gridCenterY,
      topPadding,
      bedHeight,
      verticalSpacing,
      w_grid,
      getZoneLabelCoords,
      activeOverlay,
      selectedMonth
    );
  }, [
    cropAssignments,
    rotatedPolygonPoints,
    gridRotationAngle,
    gridCenterX,
    gridCenterY,
    topPadding,
    bedHeight,
    verticalSpacing,
    w_grid,
    activeOverlay,
    selectedMonth
  ]);

  const getCropColor = (rowIdx) => {
    const match = cropAssignments.find(a => rowIdx >= a.startRow && rowIdx <= a.endRow);
    return match ? match.color : '#e2e8f0';
  };

  const getCropName = (rowIdx) => {
    const match = cropAssignments.find(a => rowIdx >= a.startRow && rowIdx <= a.endRow);
    return match ? match.crop : 'Walkway / Fallow';
  };
  
  return (
    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0', margin: '15px 0' }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={18} color="#2e7d32" /> Graphical Field Layout ({area || 'Unknown'} Acres)
      </h4>

      {/* Overlay & Zoom Controls */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginRight: '4px' }}>Visual Overlays:</span>
          {[
            { id: 'none', label: 'Default Layout', color: '#1e293b', icon: <Layers size={16} /> },
            { id: 'moisture', label: 'Moisture Profile', color: '#3b82f6', icon: <Droplet size={16} /> },
            { id: 'soil', label: 'Soil Type Map', color: '#14b8a6', icon: <Sprout size={16} /> },
            { id: 'elevation', label: 'Elevation Contours', color: '#ef4444', icon: <Mountain size={16} /> },
            { id: 'rotation', label: 'Crop Rotation Timeline', color: '#8b5cf6', icon: <RefreshCw size={16} /> },
            { id: 'revenue', label: 'Potential Revenue Estimator', color: '#16a34a', icon: <DollarSign size={16} /> }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => handleOverlayChange(btn.id)}
              title={btn.label}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: activeOverlay === btn.id ? `2px solid ${btn.color}` : '1px solid #cbd5e1',
                background: activeOverlay === btn.id ? btn.color : 'white',
                color: activeOverlay === btn.id ? 'white' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>
        
        {/* Zoom Controls */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#f1f5f9', padding: '3px 6px', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#475569', marginRight: '6px', marginLeft: '4px' }}>Zoom:</span>
          <button
            onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.15))}
            style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            title="Zoom Out"
          >
            -
          </button>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', padding: '0 6px', minWidth: '38px', textAlign: 'center' }}>
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            onClick={() => setZoomScale(prev => Math.min(2.5, prev + 0.15))}
            style={{ width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569', fontSize: '0.9rem', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            title="Zoom In"
          >
            +
          </button>
          {zoomScale !== 1.0 && (
            <button
              onClick={() => setZoomScale(1.0)}
              style={{ padding: '0 10px', height: '26px', borderRadius: '13px', border: 'none', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: '600', color: '#64748b', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginLeft: '4px' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {activeOverlay === 'rotation' && (
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: '"Inter", sans-serif' }}>
              <Calendar size={16} color="#8b5cf6" /> CROP ROTATION TIMELINE
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ffe000', backgroundColor: '#7f1d1d', padding: '2px 8px', borderRadius: '4px', fontFamily: '"Inter", sans-serif' }}>
              MONTH {selectedMonth} (Weeks {((selectedMonth - 1) * 4) + 1} - {selectedMonth * 4})
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="12"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#8b5cf6',
              cursor: 'pointer',
              height: '6px',
              borderRadius: '3px',
              background: '#334155',
              outline: 'none',
              margin: '8px 0'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600', fontFamily: '"Inter", sans-serif' }}>
            <span>Month 1 (Planting)</span>
            <span>Month 3</span>
            <span>Month 6 (Mid-Season)</span>
            <span>Month 9</span>
            <span>Month 12 (Harvest/Fallow)</span>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ flex: '1 1 300px', width: '100%', maxWidth: `${width}px`, overflowX: 'auto', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '0 auto', width: `${zoomScale * 100}%`, height: 'auto', transition: 'width 0.15s ease-in-out' }}>
            <defs>
              <clipPath id="field-polygon-clip">
                <polygon points={polyPointsStr} />
              </clipPath>
            </defs>

            <rect width={width} height={height} rx={6} fill="#000000" />
            
            {/* Border Direction Indicators & Adjacent Field Names */}
            {/* Top Side */}
            <foreignObject
              x={gridCenterX - 40}
              y={6}
              width={80}
              height={22}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                backgroundColor: '#7f1d1d',
                color: '#ffe000',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #991b1b',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                fontFamily: '"Inter", "system-ui", -apple-system, sans-serif'
              }}>
                {topDir}
              </div>
            </foreignObject>
            {adjacentFieldsBySide.top.length > 0 && (
              <text x={gridCenterX} y={42} fontSize="9" fontWeight="600" fill="#4ade80" textAnchor="middle">
                Adjacent: {adjacentFieldsBySide.top.join(', ')}
              </text>
            )}

            {/* Bottom Side */}
            <foreignObject
              x={gridCenterX - 40}
              y={height - 34}
              width={80}
              height={22}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                backgroundColor: '#7f1d1d',
                color: '#ffe000',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #991b1b',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                fontFamily: '"Inter", "system-ui", -apple-system, sans-serif'
              }}>
                {bottomDir}
              </div>
            </foreignObject>
            {adjacentFieldsBySide.bottom.length > 0 && (
              <text x={gridCenterX} y={height - 6} fontSize="9" fontWeight="600" fill="#4ade80" textAnchor="middle">
                Adjacent: {adjacentFieldsBySide.bottom.join(', ')}
              </text>
            )}

            {/* Left Side */}
            <foreignObject
              x={6}
              y={gridCenterY - 11}
              width={70}
              height={22}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                backgroundColor: '#7f1d1d',
                color: '#ffe000',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #991b1b',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                fontFamily: '"Inter", "system-ui", -apple-system, sans-serif'
              }}>
                {leftDir}
              </div>
            </foreignObject>
            {adjacentFieldsBySide.left.length > 0 && (
              <text x={6} y={gridCenterY + 23} fontSize="9" fontWeight="600" fill="#4ade80" textAnchor="start">
                Adjacent: {adjacentFieldsBySide.left.join(', ')}
              </text>
            )}

            {/* Right Side */}
            <foreignObject
              x={width - 76}
              y={gridCenterY - 11}
              width={70}
              height={22}
              style={{ pointerEvents: 'none' }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                backgroundColor: '#7f1d1d',
                color: '#ffe000',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #991b1b',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                fontFamily: '"Inter", "system-ui", -apple-system, sans-serif'
              }}>
                {rightDir}
              </div>
            </foreignObject>
            {adjacentFieldsBySide.right.length > 0 && (
              <text x={width - 6} y={gridCenterY + 23} fontSize="9" fontWeight="600" fill="#4ade80" textAnchor="end">
                Adjacent: {adjacentFieldsBySide.right.join(', ')}
              </text>
            )}

            {/* Compass Rose */}
            <g>
              <circle cx={cx} cy={cy} r={16} fill="#ffffff" stroke="#94a3b8" strokeWidth={1} />
              <circle cx={cx} cy={cy} r={2} fill="#475569" />
              {/* North Arrow (Red) */}
              <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
              {/* South Arrow (Blue) */}
              <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
              {/* N Text */}
              <text x={tx} y={ty} fontSize="8" fontWeight="800" fill="#ef4444" textAnchor="middle">N</text>
            </g>

            {/* Clipped Group (unrotated, so clipPath is unrotated) */}
            <g clipPath="url(#field-polygon-clip)">
              {/* Rotated Group for layout rectangles */}
              <g transform={`rotate(${gridRotationAngle}, ${gridCenterX}, ${gridCenterY})`}>
                {activeOverlay === 'none' || activeOverlay === 'rotation' || activeOverlay === 'revenue' ? (
                  /* Render contiguous crop zones */
                  <>
                    {cropAssignments.map((a, idx) => {
                      const y_start = topPadding + a.startRow * (bedHeight + verticalSpacing) - verticalSpacing / 2;
                      const y_end = topPadding + (a.endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;
                      const zoneHeight = y_end - y_start;
                      const zoneY = y_start;
                      const zoneX = leftPadding - 300;
                      const zoneWidth = w_grid + 600;
                      
                      const rotState = getRotationState(a.crop, selectedMonth);
                      
                      // Calculate potential revenue metrics for this zone
                      const metrics = getCropRevenueMetrics(a.crop);
                      const zoneAcres = zoneAreaRatios[idx] * (area || 5);
                      const zoneSqMeters = zoneAcres * 4046.86;
                      const plantCount = Math.floor((zoneSqMeters * 0.70) / (metrics.spacingMeters * metrics.spacingMeters));
                      const totalYield = plantCount * metrics.yieldPerPlant;
                      const potentialRevenue = totalYield * metrics.pricePerUnit;

                      let fillColor = a.color;
                      if (activeOverlay === 'rotation') {
                        fillColor = rotState.color;
                      } else if (activeOverlay === 'revenue') {
                        const revPerAcre = potentialRevenue / (zoneAcres || 1);
                        if (revPerAcre > 15000) fillColor = '#047857';      // High density (deep emerald)
                        else if (revPerAcre > 8000) fillColor = '#059669';   // Medium density (medium emerald)
                        else if (revPerAcre > 4000) fillColor = '#10b981';   // Low-medium (emerald)
                        else fillColor = '#34d399';                          // Low density (mint green)
                      }

                      const tooltipText = activeOverlay === 'rotation'
                        ? `${rotState.label} (Month ${selectedMonth})\nArea: ${zoneAcres.toFixed(2)} Acres`
                        : activeOverlay === 'revenue'
                        ? `${a.crop} Zone\nEst. Revenue: $${potentialRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})} USD\nPlant Count: ${plantCount.toLocaleString()}\nArea: ${zoneAcres.toFixed(2)} Acres`
                        : `${a.crop} Zone\nArea: ${zoneAcres.toFixed(2)} Acres`;
                      
                      return (
                        <rect
                          key={`crop_zone_${idx}`}
                          x={zoneX}
                          y={zoneY}
                          width={zoneWidth}
                          height={zoneHeight}
                          fill={fillColor}
                          stroke="#1b5e20"
                          strokeWidth={1}
                          opacity={0.85}
                          style={{ cursor: 'pointer' }}
                        >
                          <title>{tooltipText}</title>
                        </rect>
                      );
                    })}

                    {/* Dividing lines between zones */}
                    {cropAssignments.map((a, idx) => {
                      if (idx === cropAssignments.length - 1) return null;
                      const y_line = topPadding + (a.endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;
                      const zoneX = leftPadding - 300;
                      const zoneWidth = w_grid + 600;
                      return (
                        <line
                          key={`div_line_${idx}`}
                          x1={zoneX}
                          y1={y_line}
                          x2={zoneX + zoneWidth}
                          y2={y_line}
                          stroke="#1b5e20"
                          strokeWidth={1.5}
                          strokeDasharray="4,4"
                        />
                      );
                    })}

                    {/* Render text labels on top of the zones when activeOverlay === 'revenue' */}
                    {activeOverlay === 'revenue' && cropAssignments.map((a, idx) => {
                      const y_start = topPadding + a.startRow * (bedHeight + verticalSpacing) - verticalSpacing / 2;
                      const y_end = topPadding + (a.endRow + 1) * (bedHeight + verticalSpacing) - verticalSpacing / 2;
                      const midY = y_start + (y_end - y_start) / 2;
                      
                      const metrics = getCropRevenueMetrics(a.crop);
                      const zoneAcres = zoneAreaRatios[idx] * (area || 5);
                      const zoneSqMeters = zoneAcres * 4046.86;
                      const plantCount = Math.floor((zoneSqMeters * 0.70) / (metrics.spacingMeters * metrics.spacingMeters));
                      const totalYield = plantCount * metrics.yieldPerPlant;
                      const potentialRevenue = totalYield * metrics.pricePerUnit;

                      return (
                        <g key={`revenue_lbl_${idx}`} style={{ pointerEvents: 'none' }}>
                          <text 
                            x={gridCenterX} 
                            y={midY - 5} 
                            fontSize="11" 
                            fontWeight="800" 
                            fill="#ffffff" 
                            textAnchor="middle" 
                            style={{ 
                              paintOrder: 'stroke', 
                              stroke: '#0f172a', 
                              strokeWidth: '3px', 
                              strokeLinecap: 'round', 
                              strokeLinejoin: 'round',
                              fontFamily: '"Inter", "system-ui", sans-serif'
                            }}
                          >
                            {a.crop.toUpperCase()}
                          </text>
                          <text 
                            x={gridCenterX} 
                            y={midY + 9} 
                            fontSize="10" 
                            fontWeight="700" 
                            fill="#ffe000" 
                            textAnchor="middle" 
                            style={{ 
                              paintOrder: 'stroke', 
                              stroke: '#0f172a', 
                              strokeWidth: '3px', 
                              strokeLinecap: 'round', 
                              strokeLinejoin: 'round',
                              fontFamily: '"Inter", "system-ui", sans-serif'
                            }}
                          >
                            Est. Rev: ${potentialRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})} ({plantCount.toLocaleString()} plants)
                          </text>
                        </g>
                      );
                    })}
                  </>
                ) : (
                  /* Render heatmaps / cells for active overlays */
                  <>
                    {Array.from({ length: rows }).map((_, rIdx) => {
                      const y = topPadding + rIdx * (bedHeight + verticalSpacing);
                      const t = rIdx / 9;
                      
                      return (
                        <g key={`overlay_row_${rIdx}`}>
                          {Array.from({ length: bedsPerRow }).map((_, bIdx) => {
                            const x_slot_start = leftPadding + bIdx * (bedWidthPx + horizontalSpacing);
                            const cellX = x_slot_start - horizontalSpacing / 2;
                            const cellWidth = bedWidthPx + horizontalSpacing;
                            const cellY = y - verticalSpacing / 2;
                            const cellHeight = bedHeight + verticalSpacing;

                            const bedSeed = Math.sin(rIdx * 7 + bIdx * 3);
                            const elevNoise = Math.round(bedSeed * 5);
                            const moistureNoise = parseFloat((bedSeed * 0.02).toFixed(2));
                            
                            const elevVal = Math.max(50, Math.min(250, Math.round(230 - t * 160 + elevNoise)));
                            const moistureVal = Math.max(0.10, Math.min(0.50, parseFloat((0.16 + t * 0.32 + moistureNoise).toFixed(2))));
                            const soilVal = getSoilType(rIdx);
                            
                            let overlayColor = 'transparent';
                            if (activeOverlay === 'moisture') {
                              overlayColor = getMoistureColor(moistureVal);
                            } else if (activeOverlay === 'soil') {
                              overlayColor = getSoilColor(rIdx);
                            } else if (activeOverlay === 'elevation') {
                              overlayColor = getElevationColor(elevVal);
                            }
                            
                            const tooltipText = `Zone Cell ${bIdx + 1}\nElevation: ${elevVal}m\nSoil Moisture: ${(moistureVal * 100).toFixed(0)}% VWC\nSoil Type: ${soilVal}`;
                            
                            return (
                              <rect 
                                key={`overlay_cell_${bIdx}`}
                                x={cellX} 
                                y={cellY} 
                                width={cellWidth} 
                                height={cellHeight} 
                                fill={overlayColor} 
                                stroke={overlayColor}
                                strokeWidth={0.5}
                                style={{ cursor: 'pointer' }}
                              >
                                <title>{tooltipText}</title>
                              </rect>
                            );
                          })}
                        </g>
                      );
                    })}
                  </>
                )}
              </g>
            </g>

            {/* Rotated Labels Group (unclipped but rotated to align with the beds) */}
            <g transform={`rotate(${gridRotationAngle}, ${gridCenterX}, ${gridCenterY})`}>
              {activeOverlay === 'revenue' ? null : activeOverlay === 'none' ? (
                <>
                  {renderedLabels.map((lbl, idx) => (
                    <g key={`crop_zone_label_${idx}`}>
                      {lbl.calloutLine && (
                        <>
                          <line 
                            x1={lbl.calloutLine.x1} 
                            y1={lbl.calloutLine.y1} 
                            x2={lbl.calloutLine.x2} 
                            y2={lbl.calloutLine.y2} 
                            stroke="#ff6d00" 
                            strokeWidth={1.5} 
                            strokeDasharray="3,3"
                            opacity={0.9}
                          />
                          <circle 
                            cx={lbl.calloutLine.x2} 
                            cy={lbl.calloutLine.y2} 
                            r={3} 
                            fill="#ff6d00" 
                            opacity={0.95}
                          />
                        </>
                      )}
                      <foreignObject
                        x={lbl.drawX - lbl.halfW}
                        y={lbl.drawY - 15}
                        width={lbl.labelWidth}
                        height={30}
                        transform={`rotate(${-gridRotationAngle}, ${lbl.drawX}, ${lbl.drawY})`}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          textAlign: 'center',
                          color: '#ffffff',
                          fontFamily: '"Inter", "system-ui", -apple-system, sans-serif',
                          lineHeight: '1.25',
                          textShadow: '0px 1.5px 3px rgba(0,0,0,0.9), 0px 0px 2px rgba(0,0,0,0.9)'
                        }}>
                          <div style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em' }}>{lbl.crop}</div>
                        </div>
                      </foreignObject>
                    </g>
                  ))}
                </>
              ) : (
                <>
                  {renderedLabels.map((lbl, idx) => (
                    <g key={`overlay_lbl_${idx}`}>
                      {lbl.calloutLine && (
                        <>
                          <line 
                            x1={lbl.calloutLine.x1} 
                            y1={lbl.calloutLine.y1} 
                            x2={lbl.calloutLine.x2} 
                            y2={lbl.calloutLine.y2} 
                            stroke="#ff6d00" 
                            strokeWidth={1.5} 
                            strokeDasharray="3,3"
                            opacity={0.9}
                          />
                          <circle 
                            cx={lbl.calloutLine.x2} 
                            cy={lbl.calloutLine.y2} 
                            r={3} 
                            fill="#ff6d00" 
                            opacity={0.95}
                          />
                        </>
                      )}
                      <foreignObject
                        x={lbl.drawX - lbl.halfW}
                        y={lbl.drawY - 15}
                        width={lbl.labelWidth}
                        height={30}
                        transform={`rotate(${-gridRotationAngle}, ${lbl.drawX}, ${lbl.drawY})`}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          height: '100%',
                          textAlign: 'center',
                          color: '#ffffff',
                          fontFamily: '"Inter", "system-ui", -apple-system, sans-serif',
                          fontSize: '10px',
                          fontWeight: '800',
                          letterSpacing: '0.04em',
                          lineHeight: '1.25',
                          textShadow: '0px 1.5px 3px rgba(0,0,0,0.9), 0px 0px 2px rgba(0,0,0,0.9)',
                          textTransform: 'uppercase'
                        }}>
                          {lbl.crop}
                        </div>
                      </foreignObject>
                    </g>
                  ))}
                </>
              )}
            </g>

            {/* Field Boundary Overlay (unrotated, matching the map) */}
            {polyPointsStr && (
              <g style={{ pointerEvents: 'none' }}>
                {/* Outer thick yellow path (8px) */}
                <polygon 
                  points={polyPointsStr} 
                  fill="none" 
                  stroke="#facc15" 
                  strokeWidth={8} 
                  strokeLinejoin="round" 
                  opacity={0.9} 
                />
                {/* Inner dark dashed contrast line */}
                <polygon 
                  points={polyPointsStr} 
                  fill="none" 
                  stroke="#1e293b" 
                  strokeWidth={1.5} 
                  strokeDasharray="4,4" 
                  strokeLinejoin="round" 
                />
              </g>
            )}
          </svg>
        </div>
        
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Crop Assignments Legend */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h5 
              onClick={() => setCropLegendsExpanded(!cropLegendsExpanded)}
              style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span>Crop Legends</span>
              {cropLegendsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </h5>
            {cropLegendsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {cropAssignments.map((a, idx) => {
                  const zoneAcres = (zoneAreaRatios[idx] * (area || 5)).toFixed(1);
                  const midRow = (a.startRow + a.endRow) / 2;
                  const t = midRow / (rows - 1 || 9);
                  const zoneElevation = Math.round(Number(elevationVal) + 15 - t * 30);
                  
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: a.color, border: '1px solid #1b5e20' }} />
                      <span style={{ color: '#334155' }}>
                        <span style={{ fontWeight: 600 }}>{a.crop}</span> ({zoneAcres} AC, {zoneElevation}M)
                      </span>
                    </div>
                  );
                })}
                {polyPointsStr && (
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                    <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '100%', height: '4px', background: '#facc15', border: '1px solid #1e293b' }} />
                    </div>
                    <span>Field Boundary (Overlay)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Overlay Legends */}
          {activeOverlay === 'moisture' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h5 
                onClick={() => setMoistureLegendExpanded(!moistureLegendExpanded)}
                style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <span>Soil Moisture Legend</span>
                {moistureLegendExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </h5>
              {moistureLegendExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {[
                    { range: '< 20% VWC (Dry Sand)', color: '#bcaaa4' },
                    { range: '20% - 30% VWC (Moist Loam)', color: '#90caf9' },
                    { range: '30% - 40% VWC (Wet Loam)', color: '#42a5f5' },
                    { range: '> 40% VWC (Saturated Clay)', color: '#1565c0' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.color, border: '1px solid #cbd5e1' }} />
                      <span>{item.range}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeOverlay === 'soil' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h5 
                onClick={() => setSoilLegendExpanded(!soilLegendExpanded)}
                style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <span>Soil Type Legend</span>
                {soilLegendExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </h5>
              {soilLegendExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {[
                    { name: 'Gravelly Loam (Upland)', color: '#bcaaa4' },
                    { name: 'Sandy Clay Loam (Upper slope)', color: '#a1887f' },
                    { name: 'Clay Loam (Lower slope)', color: '#ffe0b2' },
                    { name: 'Silty Clay (Lowland)', color: '#80cbc4' },
                    { name: 'Hydric Clay (Swamps)', color: '#00796b' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.color, border: '1px solid #cbd5e1' }} />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeOverlay === 'elevation' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h5 
                onClick={() => setElevationLegendExpanded(!elevationLegendExpanded)}
                style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <span>Elevation Legend</span>
                {elevationLegendExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </h5>
              {elevationLegendExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {[
                    { range: '< 110m (Lowland Valleys)', color: '#006837' },
                    { range: '110m - 150m (Flat Valley)', color: '#78c679' },
                    { range: '150m - 190m (Rolling Slopes)', color: '#fee08b' },
                    { range: '190m - 220m (Upper Hills)', color: '#fdae61' },
                    { range: '> 220m (Upland Ridges)', color: '#d73027' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.color, border: '1px solid #cbd5e1' }} />
                      <span>{item.range}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeOverlay === 'rotation' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h5 
                onClick={() => setRotationLegendExpanded(!rotationLegendExpanded)}
                style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <span>Rotation State Legend</span>
                {rotationLegendExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </h5>
              {rotationLegendExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {[
                    { label: 'Maturing / Growing Main Crop', color: '#ffe000', text: 'Vegetables, rice, or tubers currently maturing.' },
                    { label: 'Nitrogen-Fixing Legumes (Cowpea/Groundnut)', color: '#2e7d32', text: 'Planted as rotational crop to enrich nitrogen levels.' },
                    { label: 'Harvesting Phase', color: '#c62828', text: 'Crops ready for harvest or in recurring harvesting phase.' },
                    { label: 'Perennial Crops (Oil Palm / Cocoa)', color: '#1b5e20', text: 'Long-term crops that occupy fields continuously.' },
                    { label: 'Harvested / Fallow', color: '#78909c', text: 'Post-harvest fallow period or organic soil building.' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'start', gap: '8px', fontSize: '0.8rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: item.color, border: '1px solid #cbd5e1', flexShrink: 0, marginTop: '1px' }} />
                      <div>
                        <strong style={{ color: '#334155' }}>{item.label}</strong>
                        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '1px' }}>{item.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeOverlay === 'revenue' && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <h5 
                onClick={() => setRevenueLegendExpanded(!revenueLegendExpanded)}
                style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              >
                <span>Potential Revenue Estimator</span>
                {revenueLegendExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </h5>
              {revenueLegendExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', fontSize: '0.78rem', color: '#475569' }}>
                  <div style={{ paddingBottom: '6px', borderBottom: '1px solid #e2e8f0', color: '#334155', fontWeight: 600 }}>
                    Projected Revenue for {area || 5} Acres:
                  </div>
                  {cropAssignments.map((a, idx) => {
                    const metrics = getCropRevenueMetrics(a.crop);
                    const zoneAcres = zoneAreaRatios[idx] * (area || 5);
                    const zoneSqMeters = zoneAcres * 4046.86;
                    const plantCount = Math.floor((zoneSqMeters * 0.70) / (metrics.spacingMeters * metrics.spacingMeters));
                    const totalYield = plantCount * metrics.yieldPerPlant;
                    const potentialRevenue = totalYield * metrics.pricePerUnit;

                    return (
                      <div key={idx} style={{ padding: '6px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                          <span>{a.crop.toUpperCase()} ZONE ({(zoneAreaRatios[idx] * 100).toFixed(0)}% area)</span>
                          <span>${potentialRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})} USD</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '0.72rem', color: '#64748b' }}>
                          <div><strong>Area:</strong> {zoneAcres.toFixed(2)} Acres</div>
                          <div><strong>Plant Spacing:</strong> {metrics.spacingMeters}m</div>
                          <div><strong>Est. Plants:</strong> {plantCount.toLocaleString()}</div>
                          <div><strong>Price:</strong> ${metrics.pricePerUnit.toFixed(2)} / {metrics.unit}</div>
                          <div><strong>Yield/Plant:</strong> {metrics.yieldPerPlant} {metrics.unit}s</div>
                          <div><strong>Maturity:</strong> {metrics.maturityDays} days</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#64748b' }}>
            <h5 
              onClick={() => setSpacingSpecsExpanded(!spacingSpecsExpanded)}
              style={{ margin: 0, fontSize: '0.85rem', color: '#334155', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <span>Spacing Specifications</span>
              {spacingSpecsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </h5>
            {spacingSpecsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                <div><strong>Bed Width:</strong> {bedWidth} meters (approx. 4 feet)</div>
                <div><strong>Row Spacing:</strong> {rowSpacing} meters (approx. 2 feet)</div>
                <div><strong>Walkway:</strong> Spaced for easy manual transport</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RecommendationViewer({ fieldId, onToggleBack, selectedFieldIds = [], initialReportId = '' }) {
  const dispatch = useDispatch();
  const allRecommendations = useSelector(state => state.recommendations?.data) || [];
  const fields = useSelector(state => state.fields.data) || [];
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';
  const geminiApiKey = useSelector(state => state.settings?.geminiApiKey) || '';
  const claudeApiKey = useSelector(state => state.settings?.claudeApiKey) || '';
  const aiProvider = useSelector(state => state.settings?.aiProvider) || 'gemini';
  const currentUser = useSelector(state => state.auth?.currentUser);
  const budgets = useSelector(state => state.budgets?.list) || [];
  const pois = useSelector(state => state.poi?.list) || [];
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const currentField = fields.find(f => f.id === fieldId) || { recommendationIds: [] };
  const linkedIds = currentField.recommendationIds || [];
  
  const linkedRecommendations = allRecommendations.filter(r => linkedIds.includes(r.id));
  const unlinkedRecommendations = allRecommendations.filter(r => !linkedIds.includes(r.id) && r.active !== false);

  const [viewTab, setViewTab] = useState('ai'); // 'ai', 'links', or 'group-delete'
  const [streamingText, setStreamingText] = useState('');
  const [selectedDeleteIds, setSelectedDeleteIds] = useState([]);
  const [deleteFilterFieldId, setDeleteFilterFieldId] = useState('all');

  const sortedRecommendations = useMemo(() => {
    return [...allRecommendations].sort((a, b) => {
      const fieldsA = fields.filter(f => f.recommendationIds && f.recommendationIds.includes(a.id));
      const fieldsB = fields.filter(f => f.recommendationIds && f.recommendationIds.includes(b.id));
      
      const nameA = fieldsA.length > 0 ? fieldsA[0].name.toLowerCase() : 'zzz_unlinked';
      const nameB = fieldsB.length > 0 ? fieldsB[0].name.toLowerCase() : 'zzz_unlinked';
      
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      
      return b.createdAt - a.createdAt;
    });
  }, [allRecommendations, fields]);

  const displayRecommendations = useMemo(() => {
    let list = sortedRecommendations;
    if (deleteFilterFieldId === 'unlinked') {
      list = list.filter(r => !fields.some(f => f.recommendationIds && f.recommendationIds.includes(r.id)));
    } else if (deleteFilterFieldId !== 'all') {
      list = list.filter(r => {
        const fieldNode = fields.find(f => f.id === deleteFilterFieldId);
        return fieldNode && fieldNode.recommendationIds && fieldNode.recommendationIds.includes(r.id);
      });
    }
    return list;
  }, [sortedRecommendations, deleteFilterFieldId, fields]);
  const [leftActiveTab, setLeftActiveTab] = useState(initialReportId ? 'reports' : 'request'); // 'request' or 'reports'

  // AI Input States
  const [season, setSeason] = useState('Rainy Season');
  const [priorities, setPriorities] = useState([]);
  const [cropHistory, setCropHistory] = useState('');
  const [notes, setNotes] = useState('');
  const [targetCategory, setTargetCategory] = useState('all');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCrops, setSelectedCrops] = useState('');

  // AI Generation Loading / Tip state
  const [loading, setLoading] = useState(false);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTipTimer = useRef(null);

  // AI Active Run selections
  const [selectedReportId, setSelectedReportId] = useState(initialReportId);
  const [selectedAiSubTab, setSelectedAiSubTab] = useState('');

  useEffect(() => {
    if (initialReportId) {
      setSelectedReportId(initialReportId);
      setLeftActiveTab('reports');
    }
  }, [initialReportId]);

  // Legacy links states
  const [selectedViewerRecId, setSelectedViewerRecId] = useState(
    linkedRecommendations.filter(r => !r.isAI).length > 0 ? linkedRecommendations.filter(r => !r.isAI)[0].id : ''
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRec, setNewRec] = useState({ name: '', link: '', active: true });
  const [existingRecToAdd, setExistingRecToAdd] = useState('');

  const [customExchangeRate, setCustomExchangeRate] = useState('');

  const historicalRate = useMemo(() => {
    if (!budgets.length) return 150;
    const sorted = [...budgets].sort((a,b) => (b.id || '').localeCompare(a.id || ''));
    const recentWithRate = sorted.find(b => b.exchangeRate && String(b.exchangeRate).trim() !== '');
    return recentWithRate ? recentWithRate.exchangeRate : 150;
  }, [budgets]);

  const [liveRate, setLiveRate] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(res => res.json())
      .then(data => {
        if (mounted && data?.rates?.LRD) {
          setLiveRate(data.rates.LRD.toFixed(2));
        }
      })
      .catch(err => console.warn('Could not fetch live exchange rate (offline mode active):', err));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (liveRate || historicalRate) {
      setCustomExchangeRate(liveRate || historicalRate);
    }
  }, [liveRate, historicalRate]);

  const exchangeRate = customExchangeRate || liveRate || historicalRate;

  // Geocoding cache on mount for dynamic lookup
  const [geoLoc, setGeoLoc] = useState({ country: '', region: '', county: '', city: '' });
  const stats = useMemo(() => {
    if (!currentField || !currentField.polygon) return { elevation: 120, soilMoisture: 0.28 };
    return extractSpatialStats(currentField.polygon);
  }, [currentField]);

  useEffect(() => {
    // Inject premium-table styles if not already injected
    if (!document.getElementById('premium-table-styles')) {
      const style = document.createElement('style');
      style.id = 'premium-table-styles';
      style.innerHTML = `
        .premium-table-container {
          overflow-x: auto;
          margin: 20px 0;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          background: white;
        }
        .premium-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          text-align: left;
        }
        .premium-table th {
          background-color: #f8fafc;
          color: #1e293b;
          font-weight: 700;
          padding: 14px 16px;
          border-bottom: 2px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .premium-table th:last-child {
          border-right: none;
        }
        .premium-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          color: #334155;
          transition: background-color 0.15s ease;
        }
        .premium-table td:last-child {
          border-right: none;
        }
        .premium-table tr:last-child td {
          border-bottom: none;
        }
        .premium-table tr:hover td {
          background-color: #f1f5f9;
        }
        .premium-table tr:nth-child(even) td {
          background-color: #fcfdfd;
        }
        .premium-table tr:nth-child(even):hover td {
          background-color: #f1f5f9;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const resolveGeo = async () => {
      let pts = [];
      if (currentField.polygon) {
        try { pts = typeof currentField.polygon === 'string' ? JSON.parse(currentField.polygon) : currentField.polygon; } catch(e) {}
      }
      if (Array.isArray(pts) && pts.length > 0) {
        const [lat, lng] = pts[0];
        const res = await fetchGeoLocationInfo(lat, lng, googleMapsApiKey);
        setGeoLoc(res);
      }
    };
    resolveGeo();
  }, [currentField, googleMapsApiKey]);

  // Rotate tips
  useEffect(() => {
    if (loading) {
      loadingTipTimer.current = setInterval(() => {
        setLoadingTipIndex(prev => (prev + 1) % AGRI_TIPS.length);
      }, 2500);
    } else {
      if (loadingTipTimer.current) {
        clearInterval(loadingTipTimer.current);
        loadingTipTimer.current = null;
      }
      setLoadingTipIndex(0);
    }
    return () => {
      if (loadingTipTimer.current) clearInterval(loadingTipTimer.current);
    };
  }, [loading]);

  // AI Advisor reports filters
  const aiReports = linkedRecommendations.filter(r => r.isAI);

  const streamingReport = useMemo(() => {
    if (!streamingText) return null;
    const { cleanMarkdown, data } = extractAndStripJson(streamingText);
    return {
      id: 'streaming_temp',
      name: `AI Advisor Report - Generating...`,
      isAI: true,
      responseTabs: splitMarkdownToTabs(cleanMarkdown),
      structuredData: data,
      createdAt: Date.now(),
      createdBy: 'AI Assistant'
    };
  }, [streamingText]);

  const rawActiveReport = streamingText ? streamingReport : (aiReports.find(r => r.id === selectedReportId) || (aiReports.length > 0 ? aiReports[0] : null));

  const activeReport = useMemo(() => {
    if (!rawActiveReport) return null;
    const tabs = [...(rawActiveReport.responseTabs || [])];
    const hasLayout = tabs.some(t => t.id.toLowerCase().includes('layout') || t.title.toLowerCase().includes('layout'));
    if (tabs.length > 0 && !hasLayout) {
      tabs.push({
        id: 'field-layout',
        title: 'Field Layout',
        content: '### Recommended Field Layout\nThis layout maps the recommended crops and support structures (thatch kitchen, compost pit, ash pit) onto the field area.'
      });
    }
    if (!tabs.some(t => t.id === 'field-map')) {
      tabs.unshift({
        id: 'field-map',
        title: 'Field Map',
        content: '### Selected Fields Location Map\nInteractive map indicating field boundaries.'
      });
    }
    return { ...rawActiveReport, responseTabs: tabs };
  }, [rawActiveReport]);

  const structuredData = useMemo(() => {
    return getReportStructuredData(activeReport, currentField.area || 5, selectedCrops || (activeReport?.promptInputs?.selectedCrops) || '', pois, currentField);
  }, [activeReport, currentField.area, selectedCrops, pois, currentField]);

  useEffect(() => {
    if (activeReport && !selectedReportId && !streamingText) {
      setSelectedReportId(activeReport.id);
    }
    if (activeReport && activeReport.responseTabs && activeReport.responseTabs.length > 0) {
      if (!selectedAiSubTab || !activeReport.responseTabs.some(t => t.id === selectedAiSubTab)) {
        setSelectedAiSubTab(activeReport.responseTabs[0].id);
      }
    }
  }, [activeReport, selectedReportId, selectedAiSubTab, streamingText]);

  const handleCreateNewLink = (e) => {
    e.preventDefault();
    if (!newRec.name || !newRec.link) return alert("Name and link are required.");
    
    const newId = `rec_${Date.now()}`;
    const recObj = { ...newRec, id: newId, isAI: false, createdAt: Date.now() };
    
    dispatch(addRecommendation(recObj));
    dispatch(queueAction({ type: 'recommendations/addRecommendation', payload: recObj, meta: { id: Date.now() } }));

    handleLinkToField(newId);
    
    setNewRec({ name: '', link: '', active: true });
    setShowNewForm(false);
  };

  const handleLinkToField = (recId) => {
    if (!recId) return;
    const updatedIds = [...linkedIds, recId];
    updateFieldLinks(updatedIds);
    setExistingRecToAdd('');
    if (viewTab === 'links') {
      setSelectedViewerRecId(recId);
    }
    
    dispatch(queueAction({ 
      type: 'core/createRelationship', 
      payload: { sourceId: fieldId, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
      meta: { id: Date.now() } 
    }));
  };

  const handleUnlink = (recId) => {
    const updatedIds = linkedIds.filter(id => id !== recId);
    updateFieldLinks(updatedIds);
    if (selectedViewerRecId === recId) {
      setSelectedViewerRecId('');
    }
    if (selectedReportId === recId) {
      setSelectedReportId('');
    }
    
    dispatch(queueAction({ 
      type: 'core/deleteRelationship', 
      payload: { sourceId: fieldId, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
      meta: { id: Date.now() } 
    }));
  };

  const handleBulkUnlink = () => {
    if (selectedDeleteIds.length === 0) return;
    
    selectedDeleteIds.forEach(recId => {
      const linkedFields = fields.filter(f => f.recommendationIds && f.recommendationIds.includes(recId));
      
      linkedFields.forEach(fieldNode => {
        const updatedIds = (fieldNode.recommendationIds || []).filter(id => id !== recId);
        const updatedFieldObj = { ...fieldNode, recommendationIds: updatedIds };
        dispatch(updateField(updatedFieldObj));
        dispatch(queueAction({ 
          type: 'core/updateNode', 
          payload: { id: fieldNode.id, properties: updatedFieldObj }, 
          meta: { id: Date.now() + Math.random() } 
        }));
        
        dispatch(queueAction({ 
          type: 'core/deleteRelationship', 
          payload: { sourceId: fieldNode.id, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
          meta: { id: Date.now() + Math.random() } 
        }));
      });
    });
    
    if (selectedViewerRecId && selectedDeleteIds.includes(selectedViewerRecId)) {
      setSelectedViewerRecId('');
    }
    if (selectedReportId && selectedDeleteIds.includes(selectedReportId)) {
      setSelectedReportId('');
    }
    
    setSelectedDeleteIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedDeleteIds.length === 0) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the ${selectedDeleteIds.length} selected recommendation(s)? This will remove them from the system and unlink them from all fields.`
    );
    if (!confirmDelete) return;

    selectedDeleteIds.forEach(recId => {
      const linkedFields = fields.filter(f => f.recommendationIds && f.recommendationIds.includes(recId));
      
      linkedFields.forEach(fieldNode => {
        const updatedIds = (fieldNode.recommendationIds || []).filter(id => id !== recId);
        const updatedFieldObj = { ...fieldNode, recommendationIds: updatedIds };
        dispatch(updateField(updatedFieldObj));
        dispatch(queueAction({ 
          type: 'core/updateNode', 
          payload: { id: fieldNode.id, properties: updatedFieldObj }, 
          meta: { id: Date.now() + Math.random() } 
        }));
        
        dispatch(queueAction({ 
          type: 'core/deleteRelationship', 
          payload: { sourceId: fieldNode.id, targetId: recId, relationshipType: 'HAS_RECOMMENDATION' }, 
          meta: { id: Date.now() + Math.random() } 
        }));
      });

      dispatch(deleteRecommendation(recId));
      
      dispatch(queueAction({ 
        type: 'core/deleteNode', 
        payload: { id: recId }, 
        meta: { id: Date.now() + Math.random() } 
      }));
    });

    if (selectedViewerRecId && selectedDeleteIds.includes(selectedViewerRecId)) {
      setSelectedViewerRecId('');
    }
    if (selectedReportId && selectedDeleteIds.includes(selectedReportId)) {
      setSelectedReportId('');
    }

    setSelectedDeleteIds([]);
  };

  const updateFieldLinks = (newIds) => {
    const updatedField = { ...currentField, recommendationIds: newIds };
    dispatch(updateField(updatedField));
    dispatch(queueAction({ type: 'core/updateNode', payload: { id: fieldId, properties: updatedField }, meta: { id: Date.now() } }));
  };

  const handlePriorityToggle = (val) => {
    if (priorities.includes(val)) {
      setPriorities(priorities.filter(p => p !== val));
    } else {
      setPriorities([...priorities, val]);
    }
  };

  const handleGenerateAIRecommendations = async () => {
    const activeKey = aiProvider === 'gemini' ? geminiApiKey : claudeApiKey;
    if (!activeKey) {
      alert(`AI Configuration Error: Please configure your ${aiProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'} API key in the settings tab first.`);
      return;
    }

    setLoading(true);
    setStreamingText('');
    try {
      const locStr = `${geoLoc.city ? geoLoc.city + ', ' : ''}${geoLoc.region ? geoLoc.region + ', ' : ''}${geoLoc.country || 'Liberia'}`;
      
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId,
          fieldName: currentField.name,
          area: currentField.area,
          soilType: currentField.soil_type,
          irrigation: currentField.irrigation,
          status: currentField.status,
          elevation: stats.elevation,
          soilMoisture: stats.soilMoisture,
          location: locStr,
          season,
          priorities,
          cropHistory,
          notes,
          startDate,
          selectedCrops,
          exchangeRate,
          farmId: localStorage.getItem('activeFarmId') || 'default_farm',
          email: currentUser?.email
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server failed to generate recommendations' }));
        throw new Error(errData.error || 'Server failed to generate recommendations');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        if (accumulatedText.includes('[ERROR:')) {
          const match = accumulatedText.match(/\[ERROR:\s*([^\]]+)\]/);
          const errMsg = match ? match[1] : 'Streaming failed';
          throw new Error(errMsg);
        }
        setStreamingText(accumulatedText);
      }

      if (!accumulatedText.trim()) {
        throw new Error('Received empty response from agronomist advisor service.');
      }

      const { cleanMarkdown, data } = extractAndStripJson(accumulatedText);
      const finalTabs = splitMarkdownToTabs(cleanMarkdown);
      if (finalTabs.length === 0) {
        throw new Error('Failed to generate structured recommendation report.');
      }

      const newId = `rec_${Date.now()}`;
      const userEmail = currentUser?.email || currentUser?.name || 'Unknown User';
      const promptInputs = {
        season,
        priorities,
        cropHistory,
        targetCategory,
        notes,
        elevation: stats.elevation,
        soilMoisture: stats.soilMoisture,
        resolvedLocation: locStr,
        startDate,
        selectedCrops
      };

      const newRecObj = {
        id: newId,
        name: `AI Advisor Report - ${new Date().toLocaleDateString()}`,
        link: '',
        active: true,
        isAI: true,
        promptInputs,
        responseTabs: finalTabs,
        structuredData: data || parseStructuredData(accumulatedText, currentField.area || 5, selectedCrops, stats.elevation, pois, currentField),
        createdAt: Date.now(),
        createdBy: userEmail
      };

      dispatch(addRecommendation(newRecObj));
      dispatch(queueAction({ type: 'recommendations/addRecommendation', payload: newRecObj, meta: { id: Date.now() } }));

      handleLinkToField(newId);
      
      setSelectedReportId(newId);
      setSelectedAiSubTab(finalTabs[0].id);
      
      setCropHistory('');
      setNotes('');
      setPriorities([]);
      setSelectedCrops('');
      setStreamingText('');
    } catch (err) {
      console.error(err);
      alert(`AI Advisor failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const activeRecLink = linkedRecommendations.find(r => !r.isAI && r.id === selectedViewerRecId);

  const handleExportPDF = () => {
    const element = document.getElementById('recommendation-report-container');
    if (!element) return;
    
    const originalStyle = element.getAttribute('style') || '';
    
    // Force styling for clear export layout
    element.style.width = '800px';
    element.style.minWidth = '800px';
    element.style.maxWidth = '800px';
    
    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1024
    }).then(canvas => {
      element.setAttribute('style', originalStyle);
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const orientation = imgWidth > imgHeight ? 'l' : 'p';
      
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const ratio = imgHeight / imgWidth;
      const width = pdfWidth;
      const height = pdfWidth * ratio;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const cleanFieldName = (currentField.name || 'Field').replace(/\s+/g, '_');
      pdf.save(`Recommendations_${cleanFieldName}_${todayStr}.pdf`);
    }).catch(err => {
      element.setAttribute('style', originalStyle);
      console.error('Failed to export PDF', err);
      alert('Error generating PDF. Please try again.');
    });
  };

  return (
    <div className="card recommendation-viewer" style={{ padding: '24px', background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={24} color="#2e7d32" /> Recommendations Center
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>Managing agronomy intelligence for <strong>{currentField.name}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeReport && (
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={loading || !!streamingText}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)',
                background: 'white',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: (loading || streamingText) ? 'not-allowed' : 'pointer',
                opacity: (loading || streamingText) ? 0.5 : 1,
                transition: 'all 0.15s'
              }}
            >
              <FileText size={16} /> Export PDF
            </button>
          )}
          <button type="button" onClick={onToggleBack} className="btn" style={{ background: '#f5f5f5', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #ddd', padding: '8px 14px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft size={16} /> Back to Field
          </button>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#f5f5f5', padding: '4px', borderRadius: '8px', border: '1px solid #e0e0e0', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setViewTab('ai')}
          style={{
            flex: 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px',
            background: viewTab === 'ai' ? 'white' : 'transparent',
            color: viewTab === 'ai' ? 'var(--color-primary)' : '#555',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: viewTab === 'ai' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={14} /> AI Advisor
        </button>
        <button
          onClick={() => setViewTab('links')}
          style={{
            flex: 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px',
            background: viewTab === 'links' ? 'white' : 'transparent',
            color: viewTab === 'links' ? 'var(--color-primary)' : '#555',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: viewTab === 'links' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <LinkIcon size={14} /> Web Links
        </button>
        <button
          onClick={() => { setViewTab('group-delete'); setSelectedDeleteIds([]); }}
          style={{
            flex: 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            padding: '8px 12px',
            border: 'none',
            borderRadius: '6px',
            background: viewTab === 'group-delete' ? 'white' : 'transparent',
            color: viewTab === 'group-delete' ? 'var(--color-primary)' : '#555',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: viewTab === 'group-delete' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Trash2 size={14} /> Group Delete
        </button>
      </div>

      {/* AI ADVISOR CONTENT */}
      {viewTab === 'ai' && (
        <div className="recommendation-layout-row" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          
          {/* Left Column: Form & History (Togglable Tabs) */}
          <div className="recommendation-column-left" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Left Column Tab selector */}
            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setLeftActiveTab('request')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: leftActiveTab === 'request' ? 'white' : 'transparent',
                  color: leftActiveTab === 'request' ? '#1b5e20' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: leftActiveTab === 'request' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Sparkles size={14} color={leftActiveTab === 'request' ? '#2e7d32' : '#64748b'} /> Request Tool
              </button>
              <button
                type="button"
                onClick={() => setLeftActiveTab('reports')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: leftActiveTab === 'reports' ? 'white' : 'transparent',
                  color: leftActiveTab === 'reports' ? '#1b5e20' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: leftActiveTab === 'reports' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <ClipboardList size={14} color={leftActiveTab === 'reports' ? '#2e7d32' : '#64748b'} /> AI Reports ({aiReports.length})
              </button>
            </div>

            {/* AI Reports History Tab content */}
            {leftActiveTab === 'reports' && (
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '0.98rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ClipboardList size={18} /> Generated AI Reports
                </h3>
                {aiReports.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic' }}>
                    No AI reports generated for this field. Switch to the Request Tool to generate your first advisor report!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
                    {aiReports.map(report => (
                      <div 
                        key={report.id}
                        onClick={() => setSelectedReportId(report.id)}
                        style={{
                          padding: '10px 12px',
                          background: selectedReportId === report.id ? '#e8f5e9' : 'white',
                          border: selectedReportId === report.id ? '1px solid #2e7d32' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: selectedReportId === report.id ? '#1b5e20' : '#334155' }}>
                            {report.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Calendar size={10} /> {new Date(report.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleUnlink(report.id); }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', padding: '4px', cursor: 'pointer', borderRadius: '4px' }}
                          title="Delete Report"
                        >
                          <Unlink size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Advisor Request Tool Form Tab content */}
            {leftActiveTab === 'request' && (
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#2e7d32" /> Advisor Request Tool
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Generate localized agronomic recommendations using current spatial characteristics:
                </p>

                {/* Spatial Metadata Summary */}
                <div className="rec-metadata-grid" style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div><strong>Area:</strong> {currentField.area || 'Unknown'} acres</div>
                  <div><strong>Elevation:</strong> {stats.elevation}m</div>
                  <div><strong>Moisture:</strong> {stats.soilMoisture} m³/m³</div>
                  <div><strong>Soil:</strong> {currentField.soil_type || 'Loam'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Irrig:</strong> {currentField.irrigation || 'None'}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Preferred AI Provider selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Preferred AI Provider</label>
                    <select
                      value={aiProvider}
                      onChange={(e) => { dispatch(setAiProvider(e.target.value)); dispatch(saveSettings()); }}
                      disabled={currentUser?.role === 'Admin Viewer'}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem', background: '#fff', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                    >
                      <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                      <option value="claude">Anthropic Claude (claude-3-5-sonnet)</option>
                    </select>
                  </div>

                  {/* USD/LRD Exchange Rate Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>USD/LRD Exchange Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customExchangeRate}
                      onChange={(e) => setCustomExchangeRate(e.target.value)}
                      placeholder="e.g. 150.00"
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Season selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Season</label>
                    <select
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    >
                      <option value="Rainy Season (Wet)">Rainy Season (Wet)</option>
                      <option value="Dry Season">Dry Season</option>
                    </select>
                  </div>

                  {/* Target Crop Type selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Target Crop Type</label>
                    <select
                      value={targetCategory}
                      onChange={(e) => setTargetCategory(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    >
                      <option value="all">All Crop Types</option>
                      <option value="Cash Crops">Cash Crops (e.g. Cocoa, Oil Palm, Rubber)</option>
                      <option value="Food Crops">Food Crops (e.g. Rice, Cassava, Plantain)</option>
                      <option value="Cover Crops">Cover Crops & Soil Enhancers</option>
                      <option value="Vegetables">Vegetables & Short-Cycle Crops</option>
                    </select>
                  </div>

                  {/* Start Date selection */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Crops of Interest */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Crops of Interest</label>
                    <input
                      type="text"
                      value={selectedCrops}
                      onChange={(e) => setSelectedCrops(e.target.value)}
                      placeholder="e.g. Fever Leaf, Cassava, Rice"
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Farm Priorities */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Farm Priorities</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                      {[
                        'Maximize Yield & Profit',
                        'Soil Conservation & Health',
                        'Drought Resilience',
                        'Low Capital / Cost'
                      ].map(p => (
                        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 'normal' }}>
                          <input
                            type="checkbox"
                            checked={priorities.includes(p)}
                            onChange={() => handlePriorityToggle(p)}
                            style={{ margin: 0 }}
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Crop History Textbox */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Crop History (Rotation)</label>
                    <input
                      type="text"
                      value={cropHistory}
                      onChange={(e) => setCropHistory(e.target.value)}
                      placeholder="e.g. Fallow last year, Maize previously"
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Special Observations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#444' }}>Special Observations</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Sandy patches, high weed presence, slope drainage issues"
                      rows={3}
                      style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem', resize: 'vertical' }}
                    />
                  </div>

                  {/* Generate Button */}
                  <button
                    type="button"
                    onClick={handleGenerateAIRecommendations}
                    disabled={loading}
                    style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: '#2e7d32',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(46, 125, 50, 0.2)'
                    }}
                  >
                    <Sparkles size={16} />
                    {loading ? 'Analyzing...' : 'Generate AI Report'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right panel: Dynamic Tabs Output Viewer */}
          <div className="recommendation-column-right" style={{ flex: '2 1 450px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
            {loading && !streamingText ? (
              // Loading screen with agronomic tips
              <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: '#fafafa', textAlign: 'center' }}>
                <div className="ai-advisor-spinner" style={{
                  width: '50px',
                  height: '50px',
                  border: '4px solid #c8e6c9',
                  borderTop: '4px solid #2e7d32',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '24px'
                }} />
                
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#1b5e20', fontWeight: 700 }}>
                  Generating Recommendations...
                </h4>
                <div style={{
                  maxWidth: '380px',
                  height: '40px',
                  fontSize: '0.85rem',
                  color: '#666',
                  fontStyle: 'italic',
                  lineHeight: '1.4',
                  transition: 'opacity 0.3s ease'
                }}>
                  {AGRI_TIPS[loadingTipIndex]}
                </div>
              </div>
            ) : activeReport ? (
              // AI Report display
              <div id="recommendation-report-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white' }}>
                {/* AI report Sub-Tabs Bar */}
                <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
                  {(activeReport.responseTabs || []).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedAiSubTab(tab.id)}
                      style={{
                        padding: '12px 16px',
                        border: 'none',
                        background: selectedAiSubTab === tab.id ? 'white' : 'transparent',
                        color: selectedAiSubTab === tab.id ? '#1b5e20' : '#475569',
                        fontWeight: selectedAiSubTab === tab.id ? 700 : 500,
                        borderBottom: selectedAiSubTab === tab.id ? '3px solid #2e7d32' : 'none',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.title}
                    </button>
                  ))}
                </div>

                {/* Sub tab content pane */}
                <div className="recommendation-subtab-pane" style={{ padding: '24px', overflowY: 'auto', background: 'white', flex: 1, minHeight: '400px', maxHeight: 'calc(100vh - 320px)' }}>
                  {(() => {
                    const currentTabObj = (activeReport.responseTabs || []).find(t => t.id === selectedAiSubTab);
                    if (!currentTabObj) {
                      return <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Select a tab to view analysis.</div>;
                    }
                    
                    const markdownContent = parseMarkdownToReact(currentTabObj.content);
                    const isChartTab = selectedAiSubTab && (selectedAiSubTab.toLowerCase().includes('revenue') || selectedAiSubTab.toLowerCase().includes('projection'));
                    const isLayoutTab = selectedAiSubTab && selectedAiSubTab.toLowerCase().includes('layout');
                    
                    if (selectedAiSubTab === 'field-map') {
                      const activeSelectedFieldIds = selectedFieldIds.length > 0 ? selectedFieldIds : [fieldId];
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <h3 style={{ margin: 0, color: '#1b5e20' }}>Selected Fields Location Map</h3>
                          <div style={{ height: '400px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                            <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                              <MapResizer />
                              <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />
                              
                              {/* Render selected fields */}
                              {fields.filter(f => activeSelectedFieldIds.includes(f.id)).map(field => {
                                let positions = [];
                                if (field.polygon) {
                                  try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                                }
                                if (positions.length === 0) return null;
                                return (
                                  <Polygon
                                    key={field.id}
                                    positions={positions}
                                    pathOptions={{
                                      color: field.drawColor || '#ff9800',
                                      weight: 2,
                                      opacity: 0.9,
                                      fill: true,
                                      fillOpacity: 0.35
                                    }}
                                  >
                                    <Popup>
                                      <strong>{field.name}</strong><br />
                                      Area: {field.area} ac<br />
                                      Soil: {field.soil_type}
                                    </Popup>
                                  </Polygon>
                                );
                              })}
                              
                              {/* Render non-selected fields as faint outlines */}
                              {fields.filter(f => !activeSelectedFieldIds.includes(f.id)).map(field => {
                                let positions = [];
                                if (field.polygon) {
                                  try { positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon; } catch (e) { }
                                }
                                if (positions.length === 0) return null;
                                return (
                                  <Polygon
                                    key={field.id}
                                    positions={positions}
                                    pathOptions={{
                                      color: '#ffffff',
                                      weight: 1,
                                      opacity: 0.4,
                                      fill: true,
                                      fillOpacity: 0.05,
                                      dashArray: '5,5'
                                    }}
                                  >
                                    <Popup>
                                      <strong>{field.name}</strong> (Not Selected)
                                    </Popup>
                                  </Polygon>
                                );
                              })}

                              <FitSelectedFieldsBounds selectedFields={fields.filter(f => activeSelectedFieldIds.includes(f.id))} />
                            </MapContainer>
                          </div>
                          <div>{markdownContent}</div>
                        </div>
                      );
                    }

                    if (isChartTab) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {markdownContent}
                          {structuredData && <RechartsVisualizer data={structuredData} />}
                        </div>
                      );
                    }
                    
                    if (isLayoutTab) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {structuredData?.fieldLayout && (
                            <GraphicalFieldLayout 
                              layout={structuredData.fieldLayout} 
                              area={currentField.area} 
                              field={currentField}
                            />
                          )}
                          {markdownContent}
                        </div>
                      );
                    }
                    
                    return markdownContent;
                  })()}
                </div>
                
                {/* Meta details footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.72rem', color: '#64748b' }}>
                  <span>Generated by AI ({aiProvider === 'gemini' ? 'Gemini' : 'Claude'})</span>
                  {streamingText ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2e7d32', fontWeight: 600 }}>
                      Streaming response...
                    </span>
                  ) : (
                    <span>Created by: {activeReport.createdBy || 'System'}</span>
                  )}
                </div>
              </div>
            ) : (
              // Empty/Instructions State
              <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', background: '#fafafa', color: '#888', border: '1px dashed #e2e8f0', borderRadius: '10px', textAlign: 'center' }}>
                <Sparkles size={40} color="#ccc" style={{ marginBottom: '16px' }} />
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#555' }}>No active report loaded</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '320px', lineHeight: '1.4' }}>
                  Configure your crop specifications and click the <strong>Generate AI Report</strong> button on the left to invoke the tropical agronomist service.
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* WEB LINKS CONTENT (LEGACY FUNCTIONALITY) */}
      {viewTab === 'links' && (
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          
          {/* Left Column: Manage Links */}
          <div style={{ flex: '1 1 300px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#333' }}>Linked Recommendations</h3>
            
            {linkedRecommendations.filter(r => !r.isAI).length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>No external links recommendations connected yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0' }}>
                {linkedRecommendations.filter(r => !r.isAI).map(r => (
                  <li
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: selectedViewerRecId === r.id ? '#e3f2fd' : '#fff',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedViewerRecId(r.id)}
                  >
                    <span style={{ fontSize: '0.85rem' }}>{r.name} {r.active === false && '(Inactive)'}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleUnlink(r.id); }}
                      className="btn btn-icon"
                      style={{ padding: '4px', color: '#dc3545', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      title="Unlink"
                    >
                      <Unlink size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #ccc' }} />

            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>Link Existing Web Reference</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
              <select
                value={existingRecToAdd}
                onChange={(e) => setExistingRecToAdd(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Select recommendation...</option>
                {unlinkedRecommendations.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleLinkToField(existingRecToAdd)}
                disabled={!existingRecToAdd}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                <LinkIcon size={14} />
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#666', display: 'block', marginBottom: '10px' }}>or</span>
              <button
                type="button"
                onClick={() => setShowNewForm(!showNewForm)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', background: '#2e7d32', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={14} style={{ marginRight: 4 }} /> {showNewForm ? 'Cancel New Link' : 'Create New Link'}
              </button>
            </div>

            {showNewForm && (
              <form onSubmit={handleCreateNewLink} style={{ marginTop: '15px', background: '#fff', padding: '15px', borderRadius: '6px', border: '1px solid #ccc', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ background: '#2e7d32', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>
                    Save & Link
                  </button>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Link Name</label>
                  <input
                    type="text"
                    value={newRec.name}
                    onChange={e => setNewRec({...newRec, name: e.target.value})}
                    required
                    placeholder="e.g. FAO Cassava Guide"
                    style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Link (URL)</label>
                  <input
                    type="url"
                    value={newRec.link}
                    onChange={e => setNewRec({...newRec, link: e.target.value})}
                    required
                    placeholder="https://"
                    style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', display: 'flex' }}>
                  <input
                    type="checkbox"
                    checked={newRec.active}
                    onChange={e => setNewRec({...newRec, active: e.target.checked})}
                    id="recActive"
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="recActive" style={{ margin: 0, fontSize: '0.85rem' }}>Active Link</label>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Viewer */}
          <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column' }}>
            {activeRecLink ? (
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '30px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <ExternalLink size={48} color="#2e7d32" style={{ marginBottom: '20px' }} />
                <h3 style={{ marginBottom: '10px' }}>{activeRecLink.name}</h3>
                <p style={{ color: '#666', marginBottom: '30px', wordBreak: 'break-all', maxWidth: '100%', fontSize: '0.9rem' }}>
                  {activeRecLink.link}
                </p>
                <a
                  href={activeRecLink.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '12px 24px', fontSize: '1rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', background: '#2e7d32', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 600 }}
                >
                  Open Recommendation in New Window <ExternalLink size={18} />
                </a>
                <p style={{ marginTop: '20px', fontSize: '0.85rem', color: '#888' }}>
                  (This link will open safely in a new tab)
                </p>
              </div>
            ) : (
              <div style={{ background: '#f5f5f5', border: '1px dashed #ccc', borderRadius: '8px', padding: '30px', textAlign: 'center', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <p style={{ color: '#888' }}>Select a linked recommendation to view details.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* GROUP DELETE CONTENT */}
      {viewTab === 'group-delete' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={20} color="#2e7d32" /> Bulk Manage Recommendations
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#64748b' }}>
              Manage and bulk-delete or unlink recommendations across all fields.
            </p>

            {allRecommendations.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#888', border: '1px dashed #cbd5e1', borderRadius: '8px', background: 'white' }}>
                No recommendations found in the system.
              </div>
            ) : (
              <div>
                {/* Field Filter Dropdown */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: 0 }}>Filter by Field</label>
                    <select
                      value={deleteFilterFieldId}
                      onChange={(e) => {
                        setDeleteFilterFieldId(e.target.value);
                        setSelectedDeleteIds([]);
                      }}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      <option value="all">All Fields</option>
                      <option value="unlinked">Unlinked Recommendations</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Bulk Actions Header Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', margin: 0, fontWeight: 600, cursor: 'pointer', color: '#334155' }}>
                    <input
                      type="checkbox"
                      checked={displayRecommendations.length > 0 && selectedDeleteIds.length === displayRecommendations.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeleteIds(displayRecommendations.map(r => r.id));
                        } else {
                          setSelectedDeleteIds([]);
                        }
                      }}
                      style={{ margin: 0 }}
                    />
                    Select All ({selectedDeleteIds.length} of {displayRecommendations.length} selected)
                  </label>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      disabled={selectedDeleteIds.length === 0}
                      onClick={handleBulkUnlink}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: selectedDeleteIds.length === 0 ? '#e2e8f0' : '#f59e0b',
                        color: selectedDeleteIds.length === 0 ? '#94a3b8' : 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: selectedDeleteIds.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Unlink size={14} /> Unlink Selected
                    </button>
                    <button
                      type="button"
                      disabled={selectedDeleteIds.length === 0}
                      onClick={handleBulkDelete}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: selectedDeleteIds.length === 0 ? '#e2e8f0' : '#ef4444',
                        color: selectedDeleteIds.length === 0 ? '#94a3b8' : 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: selectedDeleteIds.length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Trash2 size={14} /> Delete Selected
                    </button>
                  </div>
                </div>

                {/* Table of Recommendations */}
                <div className="premium-table-container">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px', textAlign: 'center' }}>Select</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Linked Field(s)</th>
                        <th>Source / Info</th>
                        <th>Date Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRecommendations.map(r => {
                        const linkedFields = fields.filter(f => f.recommendationIds && f.recommendationIds.includes(r.id));
                        const linkedFieldNames = linkedFields.length > 0 
                          ? linkedFields.map(f => f.name).join(', ') 
                          : 'Unlinked';
                        return (
                          <tr key={r.id} style={{ background: selectedDeleteIds.includes(r.id) ? '#fef2f2' : undefined }}>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              <input
                                type="checkbox"
                                checked={selectedDeleteIds.includes(r.id)}
                                onChange={() => {
                                  if (selectedDeleteIds.includes(r.id)) {
                                    setSelectedDeleteIds(selectedDeleteIds.filter(id => id !== r.id));
                                  } else {
                                    setSelectedDeleteIds([...selectedDeleteIds, r.id]);
                                  }
                                }}
                                style={{ margin: 0, cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ fontWeight: 600, color: '#1e293b' }}>
                              {r.name}
                            </td>
                            <td>
                              {r.isAI ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#e8f5e9', color: '#2e7d32' }}>
                                  <Sparkles size={10} /> AI Advisor
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#e3f2fd', color: '#1976d2' }}>
                                  <LinkIcon size={10} /> Web Link
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.85rem', fontWeight: 500, color: linkedFields.length > 0 ? '#1b5e20' : '#64748b' }}>
                              {linkedFieldNames}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b', wordBreak: 'break-all' }}>
                              {r.isAI ? (
                                <span>Generated via {r.promptInputs?.season || 'AI Service'}</span>
                              ) : (
                                <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {r.link?.substring(0, 40)}{r.link?.length > 40 ? '...' : ''} <ExternalLink size={12} />
                                </a>
                              )}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                              {new Date(r.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Back to Field Button */}
      <div className="recommendation-footer-buttons" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: '20px' }}>
        <button
          type="button"
          onClick={onToggleBack}
          className="btn"
          style={{
            background: '#f5f5f5',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #ddd',
            padding: '10px 20px',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Back to Field
        </button>
      </div>

    </div>
  );
}