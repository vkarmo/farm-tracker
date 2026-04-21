import React, { useState, useEffect } from 'react';
import { useMap } from 'react-leaflet';

export const MapSearchBox = ({ onLocationFound, showSaveButton = false }) => {
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
      {showSaveButton && (
        <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          Connect-the-Dots
        </button>
      )}
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
