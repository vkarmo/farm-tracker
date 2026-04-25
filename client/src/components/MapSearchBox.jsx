import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';

export const CurrentLocationControl = ({ onLocationFound }) => {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 16);
        if (onLocationFound) onLocationFound([latitude, longitude]);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not find your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '10px', marginRight: '10px' }}>
      <div className="leaflet-control leaflet-bar">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); locateUser(); }}
          style={{
            width: '34px', height: '34px', background: 'white', border: 'none', borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: isLocating ? '#1976d2' : '#666', padding: 0
          }}
          title="Go to Current Location"
        >
          <LocateFixed size={20} className={isLocating ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
};

export const MapSearchBox = ({ onLocationFound }) => {
  const [query, setQuery] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Direct Lat, Lng coordinate parsing regex
    const coordsMatch = query.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[3]);
      onLocationFound([lat, lng]);
      return;
    }

    // Geocoding query
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        onLocationFound([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        alert("Location not found. Please try a more specific address or exact GPS coordinates.");
      }
    } catch (e) {
      alert("Search network error. Check connectivity or enter exact lat, lng coordinates directly.");
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
      <input
        type="text"
        placeholder="Search address or enter coordinates (lat, lng)..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(e); }}
        style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #ccc' }}
      />
      <button type="button" onClick={handleSearch} className="btn" style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#e0e0e0', color: '#333' }}>
        Add Pin
      </button>
    </div>
  );
};

export const MapFlyTo = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2) {
      map.flyTo(center, 16);
    }
  }, [center, map]);
  return null;
};
