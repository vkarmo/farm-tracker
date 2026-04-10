import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { MapContainer, TileLayer, Polygon, Popup, GeoJSON } from 'react-leaflet';
import { kml } from '@tmcw/togeojson';
import 'leaflet/dist/leaflet.css';

const MapLayer = ({ fields }) => {
  const kmlUrls = useSelector(state => state.settings.kmlUrls);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
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

  const zoom = 13;

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', zIndex: 0, position: 'relative' }}>
      
      {errors.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(198, 40, 40, 0.9)', color: 'white', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem' }}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
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
          
          if (positions.length === 0) {
            // fallback generic dummy polygon
            const lat = 51.505;
            const lng = -0.09;
            positions = [
              [lat + (Math.random() * 0.01), lng + (Math.random() * 0.01)],
              [lat - (Math.random() * 0.01), lng + (Math.random() * 0.01)],
              [lat - (Math.random() * 0.01), lng - (Math.random() * 0.01)],
              [lat + (Math.random() * 0.01), lng - (Math.random() * 0.01)],
            ];
          }
          
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
  );
};

export default MapLayer;
