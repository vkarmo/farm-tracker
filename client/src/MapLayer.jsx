import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MapContainer, TileLayer, Polygon, Popup, GeoJSON, Marker } from 'react-leaflet';
import FieldImageryOverlay, { getDeterministicSceneDate, getDeterministicCloudCover } from './components/FieldImageryOverlay';
import CropRecommendationPanel from './components/CropRecommendationPanel';
import { MapResizer } from './components/ResizableMapWrapper';
import { setMapCenter, setVisibleMapLayers, saveSettings } from './store/settingsSlice';
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

const LAYER_OPTIONS = [
  { value: 'fields', label: 'Fields' },
  { value: 'nurseries', label: 'Nurseries' },
  { value: 'pois', label: 'Points of Interest' },
  { value: 'equipment', label: 'Hard Assets' },
  { value: 'soilTests', label: 'Soil Tests' }
];

const MapLayer = ({ fields, nurseries = [], equipment = [] }) => {
  const dispatch = useDispatch();
  const kmlUrls = useSelector(state => state.settings.kmlUrls);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const pois = useSelector(state => state.poi?.list) || [];
  const soilTests = useSelector(state => state.soilTests?.tests) || [];
  const themeFontImagerCapitalize = useSelector(state => state.settings?.themeFontImagerCapitalize) || false;
  const formatLabel = (txt) => themeFontImagerCapitalize ? txt.toUpperCase() : txt;
  
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
    return localStorage.getItem('map_filter_panel_open') !== 'false';
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
  }, []);

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
        body: JSON.stringify({ polygon: polygonCoords, dateOffset })
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
              <label style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>Global Overlay:</label>
              <select 
                value={commonImagery} 
                onChange={(e) => handleGlobalImageryChange(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '4px', background: 'white', fontSize: '0.8rem', border: '1px solid #ccc', width: '100%' }}
              >
                {commonImagery === 'mixed' && (
                  <option value="mixed" disabled>{formatLabel("-- Mixed Overlays --")}</option>
                )}
                <option value="none">{formatLabel("None (Standard)")}</option>
                <option value="Elevation">{formatLabel("Elevation (Topography)")}</option>
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
                color: '#29b6f6',
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
                color: '#0288d1',
                weight: 4,
                opacity: 0.85,
                dashArray: '10, 10',
                lineCap: 'round',
                lineJoin: 'round'
              }}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`
                  <div style="font-family: var(--font-family); font-size: 0.8rem; line-height: 1.4; min-width: 180px;">
                    <strong style="color: #0288d1; font-size: 0.9rem; display: block; margin-bottom: 4px;">🌊 ${feature.properties.name}</strong>
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
          
          const showImagery = fieldImagery[field.id] && fieldImagery[field.id] !== 'none';
          const isLoaded = geeStatus[field.id]?.status === 'success' || geeStatus[field.id]?.status === 'failed';
          const makeTransparent = showImagery && isLoaded;

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
                eventHandlers={{
                  click: () => {
                    setSelectedFieldForRec(field);
                  }
                }}
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
                    {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && (
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
                  </div>
                </Popup>
              </Polygon>
              {fieldImagery[field.id] && fieldImagery[field.id] !== 'none' && fieldImagery[field.id] !== 'GEE_Weather' && (
                <FieldImageryOverlay 
                  polygon={positions} 
                  indexType={fieldImagery[field.id]} 
                  dateOffset={fieldImageryOffsets[field.id] || 0}
                  fieldId={field.id}
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
          if (!Array.isArray(positions) || positions.length < 3) return null;
          const mappedPts = positions.map(pt => [pt[0], pt[1]]);
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
