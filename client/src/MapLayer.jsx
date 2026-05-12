import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MapContainer, TileLayer, Polygon, Popup, GeoJSON, Marker } from 'react-leaflet';
import { setMapCenter, setVisibleMapLayers, saveSettings } from './store/settingsSlice';
import { kml } from '@tmcw/togeojson';
import L from 'leaflet';
import { CurrentLocationButton, MapFlyTo } from './components/MapSearchBox';
import { Tractor, Layers } from 'lucide-react';
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
  
  const [geoJsonLayers, setGeoJsonLayers] = useState([]);
  const [errors, setErrors] = useState([]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const visibleMapLayers = useSelector(state => state.settings?.visibleMapLayers) || ['fields', 'nurseries', 'pois', 'equipment', 'soilTests'];
  const selectedLayers = LAYER_OPTIONS.filter(opt => visibleMapLayers.includes(opt.value));
  
  const handleLayersChange = (selected) => {
    const vals = selected ? selected.map(s => s.value) : [];
    dispatch(setVisibleMapLayers(vals));
    dispatch(saveSettings());
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '10px', gap: '8px' }}>
        {showLayers && (
          <div style={{ zIndex: 1001, width: '100%' }}>
            <Select
              isMulti
              options={LAYER_OPTIONS}
              value={selectedLayers}
              onChange={handleLayersChange}
              placeholder="Select layers to display..."
              styles={{ 
                control: (base) => ({ ...base, minHeight: '36px', fontSize: '0.85rem' }),
                valueContainer: (base) => ({ ...base, padding: '2px 8px' }),
                dropdownIndicator: (base) => ({ ...base, padding: '4px' }),
                clearIndicator: (base) => ({ ...base, padding: '4px' }),
                multiValue: (base) => ({ ...base, margin: '2px' })
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowLayers(!showLayers)}
            className={`btn map-toolbar-btn ${showLayers ? 'active' : ''}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Toggle Map Layers"
          >
            <Layers size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (mapCenter) {
                setFlyTarget([mapCenter[0], mapCenter[1], Date.now()]);
              }
            }}
            className="btn map-toolbar-btn"
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Go to Farm Base"
          >
            <Tractor size={16} />
          </button>
          <CurrentLocationButton onLocationFound={(loc) => setFlyTarget(loc)} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 0, position: 'relative' }}>
      
      {errors.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(198, 40, 40, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
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

        {/* Render Equipment (Hard Assets) as Markers */}
        {selectedLayers.some(l => l.value === 'equipment') && equipment.map(item => {
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
        {selectedLayers.some(l => l.value === 'nurseries') && nurseries.map(bed => {
          let positions = [];
          if (bed.polygon) {
            try { positions = typeof bed.polygon === 'string' ? JSON.parse(bed.polygon) : bed.polygon; } catch(e) {}
          }
          if (!Array.isArray(positions) || positions.length === 0) return null;
          return (
            <Polygon key={bed.id} pathOptions={{ color: bed.drawColor || polygonColor, weight: 2, fillOpacity: 0.4 }} positions={positions}>
              <Popup>
                <strong>Nursery: {bed.name}</strong><br/>
                Capacity: {bed.capacity} plugs
              </Popup>
            </Polygon>
          );
        })}

        {/* Render Fields */}
        {selectedLayers.some(l => l.value === 'fields') && fields.map(field => {
          let positions = [];
          if (field.polygon) {
            try {
              positions = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
            } catch (e) {}
          }
          if (!Array.isArray(positions) || positions.length === 0) return null;
          
          return (
            <Polygon key={field.id} pathOptions={{ color: field.drawColor || polygonColor }} positions={positions}>
              <Popup>
                <strong>{field.name}</strong><br/>
                Area: {field.area}
              </Popup>
            </Polygon>
          );
        })}

        {/* Render POIs */}
        {selectedLayers.some(l => l.value === 'pois') && pois.map(poi => {
          let positions = [];
          if (poi.points) {
            try { positions = typeof poi.points === 'string' ? JSON.parse(poi.points) : poi.points; } catch(e) {}
          }
          if (!Array.isArray(positions) || positions.length < 3) return null;
          const mappedPts = positions.map(pt => [pt[0], pt[1]]);
          return (
            <Polygon key={poi.id} pathOptions={{ color: poi.drawColor || polygonColor, weight: 2, fillOpacity: 0.5 }} positions={mappedPts}>
              <Popup>
                <strong>POI: {poi.name}</strong><br/>
                {poi.type}
              </Popup>
            </Polygon>
          );
        })}

        {/* Render Soil Tests */}
        {selectedLayers.some(l => l.value === 'soilTests') && soilTests.flatMap(test => 
          (test.testResults || []).filter(res => res.lat && res.lng).map((res, i) => (
            <Marker key={`${test.id}_${i}`} position={[parseFloat(res.lat), parseFloat(res.lng)]} icon={brownIcon}>
              <Popup>
                <strong>Soil Test: {test.date}</strong><br/>
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
