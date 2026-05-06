import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { MapContainer, TileLayer, Polygon, Popup, GeoJSON, Marker } from 'react-leaflet';
import { setMapCenter } from './store/settingsSlice';
import { kml } from '@tmcw/togeojson';
import L from 'leaflet';

// Create a custom orange icon for Hard Assets
const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
import 'leaflet/dist/leaflet.css';
import { CurrentLocationButton } from './components/MapSearchBox';

const MapLayer = ({ fields, nurseries = [], equipment = [] }) => {
  const dispatch = useDispatch();
  const kmlUrls = useSelector(state => state.settings.kmlUrls);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const [geoJsonLayers, setGeoJsonLayers] = useState([]);
  const [errors, setErrors] = useState([]);

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <CurrentLocationButton onLocationFound={(loc) => dispatch(setMapCenter([loc[0], loc[1]]))} />
      </div>
      <div style={{ flex: 1, minHeight: 0, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 0, position: 'relative' }}>
      
      {errors.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(198, 40, 40, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="Google Maps"
          url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
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
        {equipment.map(item => {
          let pos = null;
          if (item.gpsLocation) {
            try { pos = JSON.parse(item.gpsLocation); } catch(e) {}
          }
          if (!pos || pos.length !== 2) return null;
          
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
        {nurseries.map(bed => {
          let positions = [];
          if (bed.polygon) {
            try { positions = JSON.parse(bed.polygon); } catch(e) {}
          }
          if (positions.length === 0) return null;
          return (
            <Polygon key={bed.id} pathOptions={{ color: '#4caf50', weight: 2, fillOpacity: 0.4 }} positions={positions}>
              <Popup>
                <strong>Nursery: {bed.name}</strong><br/>
                Capacity: {bed.capacity} plugs
              </Popup>
            </Polygon>
          );
        })}

        {/* Existing logic to render simulated drawn polygons for the red Fields array */}
        {fields.map(field => {
          let positions = [];
          if (field.polygon) {
            try {
              positions = JSON.parse(field.polygon);
            } catch (e) {
              // fallback
            }
          }
          
          if (positions.length === 0) return null;
          
          return (
            <Polygon key={field.id} pathOptions={{ color: polygonColor }} positions={positions}>
              <Popup>
                <strong>{field.name}</strong><br/>
                Area: {field.area}
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
    </div>
  );
};

export default MapLayer;
