import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft, ExternalLink, Link as LinkIcon, Plus, Unlink, Sparkles, AlertCircle, Calendar, ClipboardList, Info, HelpCircle, Layers, CheckCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { addRecommendation, deleteRecommendation } from '../store/recommendationsSlice';
import { updateField } from '../store/fieldsSlice';
import { queueAction } from '../store/syncSlice';
import { extractSpatialStats } from './CropRecommendationPanel';
import { fetchGeoLocationInfo } from './PoiTab';
import { setAiProvider, saveSettings } from '../store/settingsSlice';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

export const parseStructuredData = (text, area, selectedCrops) => {
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
  
  if (data && data.monthlyProjections && data.annualRevenue && data.fieldLayout) {
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
  if (cropsList.length === 0) cropsList.push('Fever Leaf', 'Cassava', 'Swamp Rice');
  
  const totalAcres = Number(area) || 5;
  
  // Generate realistic annual revenues
  const revenueRates = {
    'fever leaf': 1800,
    'cassava': 900,
    'rice': 1100,
    'swamp rice': 1200,
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
  
  // Generate monthly projections (12 months)
  const monthlyProjections = [];
  const cropColors = ['#2e7d32', '#8d6e63', '#ffb74d', '#4fc3f7', '#ec407a'];
  
  for (let m = 1; m <= 12; m++) {
    const proj = { month: `Month ${m}` };
    let monthlyTotal = 0;
    
    cropsList.forEach((crop, cIdx) => {
      const annual = annualRevenue[cIdx].revenue;
      let seasonalFactor = 1.0;
      if (m >= 5 && m <= 10) {
        seasonalFactor = crop.toLowerCase().includes('rice') ? 1.3 : 0.8;
      } else {
        seasonalFactor = crop.toLowerCase().includes('rice') ? 0.7 : 1.2;
      }
      
      const baseMonthly = annual / 12;
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
    cropAssignments: cropsList.map((crop, idx) => {
      const color = cropColors[idx % cropColors.length];
      const startRow = Math.floor((idx / cropsList.length) * 10);
      const endRow = Math.floor(((idx + 1) / cropsList.length) * 10) - 1;
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

const getReportStructuredData = (report, area, selectedCrops) => {
  if (!report) return null;
  if (report.structuredData) {
    if (typeof report.structuredData === 'string') {
      try {
        return JSON.parse(report.structuredData);
      } catch (e) {
        // ignore and fallback
      }
    } else {
      return report.structuredData;
    }
  }
  let fullText = '';
  if (report.responseTabs) {
    fullText = report.responseTabs.map(t => `## ${t.title}\n${t.content}`).join('\n');
  }
  return parseStructuredData(fullText, area, selectedCrops);
};

const RechartsVisualizer = ({ data }) => {
  const { monthlyProjections = [], annualRevenue = [] } = data || {};
  
  const COLORS = ['#2e7d32', '#8d6e63', '#ffb74d', '#4fc3f7', '#ec407a'];
  
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

const GraphicalFieldLayout = ({ layout, area }) => {
  const { rows = 10, bedsPerRow = 4, bedWidth = 1.2, rowSpacing = 0.6, cropAssignments = [] } = layout || {};
  
  const bedHeight = 30;
  const bedWidthPx = 80;
  const horizontalSpacing = 15;
  const verticalSpacing = 10;
  
  const width = bedsPerRow * (bedWidthPx + horizontalSpacing) + 120;
  const height = rows * (bedHeight + verticalSpacing) + 60;
  
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
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ overflowX: 'auto', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <svg width={width} height={height} style={{ display: 'block' }}>
            <rect width={width} height={height} rx={6} fill="#f1f8f5" />
            
            {Array.from({ length: rows }).map((_, rIdx) => {
              const y = 30 + rIdx * (bedHeight + verticalSpacing);
              const cropColor = getCropColor(rIdx);
              const cropName = getCropName(rIdx);
              
              return (
                <g key={`row_${rIdx}`}>
                  <text x={10} y={y + 18} fontSize="10" fill="#64748b">Row {rIdx + 1}</text>
                  
                  {Array.from({ length: bedsPerRow }).map((_, bIdx) => {
                    const x = 70 + bIdx * (bedWidthPx + horizontalSpacing);
                    return (
                      <g key={`bed_${bIdx}`}>
                        <rect 
                          x={x} 
                          y={y} 
                          width={bedWidthPx} 
                          height={bedHeight} 
                          rx={3} 
                          fill={cropColor} 
                          stroke="#1b5e20" 
                          strokeWidth={1}
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          title={`Row ${rIdx + 1}, Bed ${bIdx + 1}: ${cropName}`}
                        />
                        <text 
                          x={x + bedWidthPx / 2} 
                          y={y + 18} 
                          fontSize="9" 
                          fill="#fff" 
                          textAnchor="middle" 
                          fontWeight="600"
                          style={{ pointerEvents: 'none' }}
                        >
                          Bed {bIdx + 1}
                        </text>
                      </g>
                    );
                  })}
                  
                  {rIdx < rows - 1 && (
                    <line 
                      x1={70} 
                      y1={y + bedHeight + 5} 
                      x2={70 + bedsPerRow * (bedWidthPx + horizontalSpacing) - horizontalSpacing} 
                      y2={y + bedHeight + 5} 
                      stroke="#94a3b8" 
                      strokeDasharray="2,2" 
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#334155', fontWeight: 700 }}>Crop Legends</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cropAssignments.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: a.color, border: '1px solid #1b5e20' }} />
                  <span>{a.crop} (Rows {a.startRow + 1}-{a.endRow + 1})</span>
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#64748b' }}>
            <h5 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: '#334155', fontWeight: 700 }}>Spacing Specifications</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Bed Width:</strong> {bedWidth} meters (approx. 4 feet)</div>
              <div><strong>Row Spacing:</strong> {rowSpacing} meters (approx. 2 feet)</div>
              <div><strong>Walkway:</strong> Spaced for easy manual transport</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function RecommendationViewer({ fieldId, onToggleBack }) {
  const dispatch = useDispatch();
  const allRecommendations = useSelector(state => state.recommendations?.data) || [];
  const fields = useSelector(state => state.fields.data) || [];
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';
  const geminiApiKey = useSelector(state => state.settings?.geminiApiKey) || '';
  const claudeApiKey = useSelector(state => state.settings?.claudeApiKey) || '';
  const aiProvider = useSelector(state => state.settings?.aiProvider) || 'gemini';
  const currentUser = useSelector(state => state.auth?.currentUser);
  const budgets = useSelector(state => state.budgets?.list) || [];

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
  const [leftActiveTab, setLeftActiveTab] = useState('request'); // 'request' or 'reports'

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
  const [selectedReportId, setSelectedReportId] = useState('');
  const [selectedAiSubTab, setSelectedAiSubTab] = useState('');

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
    return { ...rawActiveReport, responseTabs: tabs };
  }, [rawActiveReport]);

  const structuredData = useMemo(() => {
    return getReportStructuredData(activeReport, currentField.area || 5, selectedCrops || (activeReport?.promptInputs?.selectedCrops) || '');
  }, [activeReport, currentField.area, selectedCrops]);

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
        structuredData: data || parseStructuredData(accumulatedText, currentField.area || 5, selectedCrops),
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
        <button type="button" onClick={onToggleBack} className="btn" style={{ background: '#f5f5f5', color: '#333', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #ddd', padding: '8px 14px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Back to Field
        </button>
      </div>

      {/* Main Tab Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: '#f5f5f5', padding: '4px', borderRadius: '8px', border: '1px solid #e0e0e0', maxWidth: '480px' }}>
        <button
          onClick={() => setViewTab('ai')}
          style={{
            flex: 1,
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
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          
          {/* Left Column: Form & History (Togglable Tabs) */}
          <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
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
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
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
          <div style={{ flex: '2 1 450px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <div style={{ padding: '24px', overflowY: 'auto', background: 'white', flex: 1, minHeight: '400px', maxHeight: 'calc(100vh - 320px)' }}>
                  {(() => {
                    const currentTabObj = (activeReport.responseTabs || []).find(t => t.id === selectedAiSubTab);
                    if (!currentTabObj) {
                      return <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Select a tab to view analysis.</div>;
                    }
                    
                    const markdownContent = parseMarkdownToReact(currentTabObj.content);
                    const isChartTab = selectedAiSubTab && (selectedAiSubTab.toLowerCase().includes('revenue') || selectedAiSubTab.toLowerCase().includes('projection'));
                    const isLayoutTab = selectedAiSubTab && selectedAiSubTab.toLowerCase().includes('layout');
                    
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

    </div>
  );
}