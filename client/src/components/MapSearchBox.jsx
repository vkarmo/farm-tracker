import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { useSelector } from 'react-redux';
import { LocateFixed, Map as MapIcon, Eraser, Plus, Tractor } from 'lucide-react';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

export const CurrentLocationButton = ({ onLocationFound, disabled }) => {
  const [isLocating, setIsLocating] = useState(false);

  const locateUser = () => {
    if (disabled) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (onLocationFound) onLocationFound([latitude, longitude, Date.now()]);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not find your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <button
      type="button"
      onClick={locateUser}
      disabled={disabled}
      className="btn map-toolbar-btn"
      style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      title="Go to Current Location"
    >
      <LocateFixed size={16} className={isLocating ? 'spin' : ''} />
    </button>
  );
};

export const MapSearchBox = ({ onLocationFound, onClear }) => {
  const [query, setQuery] = useState('');
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsInterval, setGpsInterval] = useState(30);
  const [isLocating, setIsLocating] = useState(false);
  const globalMapCenter = useSelector(state => state.settings?.mapCenter);
  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const wakeLockRef = useRef(null);
  const onLocationFoundRef = useRef(onLocationFound);

  useEffect(() => {
    onLocationFoundRef.current = onLocationFound;
  }, [onLocationFound]);

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake Lock error:', err);
        }
      }
    };
    
    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {
          console.warn('Wake Lock release error:', err);
        }
      }
    };

    if (gpsOn) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [gpsOn]);

  useEffect(() => {
    onLocationFoundRef.current = onLocationFound;
  }, [onLocationFound]);

  useEffect(() => {
    if (gpsOn) {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const now = Date.now();
            if (!lastPointRef.current) {
              onLocationFoundRef.current([latitude, longitude, now]);
              lastPointRef.current = { lat: latitude, lng: longitude };
            } else {
              const dist = calculateDistance(lastPointRef.current.lat, lastPointRef.current.lng, latitude, longitude);
              if (dist >= gpsInterval) {
                onLocationFoundRef.current([latitude, longitude, now]);
                lastPointRef.current = { lat: latitude, lng: longitude };
              }
            }
          },
          (err) => console.error("Geolocation watch error:", err),
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      } else {
        alert("Geolocation is not supported by your browser");
        setGpsOn(false);
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      lastPointRef.current = null;
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [gpsOn, gpsInterval]);

  const locateUser = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (onLocationFoundRef.current) onLocationFoundRef.current([latitude, longitude, Date.now()]);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not find your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Direct Lat, Lng coordinate parsing regex
    const coordsMatch = query.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[3]);
      onLocationFound([lat, lng, Date.now()]);
      return;
    }

    // Geocoding query
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        onLocationFound([parseFloat(data[0].lat), parseFloat(data[0].lon), Date.now()]);
      } else {
        alert("Location not found. Please try a more specific address or exact GPS coordinates.");
      }
    } catch (e) {
      alert("Search network error. Check connectivity or enter exact lat, lng coordinates directly.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', gap: '8px', flex: '1 1 250px' }}>
          <input
            type="text"
            placeholder="Search address or enter coordinates (lat, lng)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(e); }}
            style={{ flex: 1, minWidth: 0, padding: '6px 10px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button 
            type="button" 
            onClick={handleSearch} 
            disabled={gpsOn}
            className="btn map-toolbar-btn" 
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: gpsOn ? 0.5 : 1, cursor: gpsOn ? 'not-allowed' : 'pointer' }}
            title="Add Pin"
          >
            <Plus size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <CurrentLocationButton disabled={gpsOn} onLocationFound={(loc) => { if (onLocationFoundRef.current) onLocationFoundRef.current(loc); }} />
          
          <button
            type="button"
            onClick={() => {
              if (globalMapCenter && onLocationFoundRef.current) {
                onLocationFoundRef.current([globalMapCenter[0], globalMapCenter[1], Date.now()]);
              }
            }}
            disabled={gpsOn}
            className="btn map-toolbar-btn"
            style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: gpsOn ? 0.5 : 1, cursor: gpsOn ? 'not-allowed' : 'pointer' }}
            title="Go to Farm Base"
          >
            <Tractor size={16} />
          </button>
          <button 
            type="button" 
            onClick={() => setGpsOn(!gpsOn)}
            className={`btn map-toolbar-btn ${gpsOn ? 'active' : ''}`}
            style={{ 
              padding: '6px 12px', fontSize: '0.85rem', 
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: 'pointer'
            }}
          >
            <MapIcon size={16} /> {gpsOn ? 'GPS ON' : 'GPS OFF'}
          </button>
          {onClear !== undefined && (
            <button 
              type="button" 
              onClick={onClear || (() => {})} 
              disabled={gpsOn || !onClear}
              className="btn map-toolbar-btn" 
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (gpsOn || !onClear) ? 0.5 : 1, cursor: (gpsOn || !onClear) ? 'not-allowed' : 'pointer' }}
              title="Clear Drawing / Pin Drop"
            >
               <Eraser size={16} />
            </button>
          )}
        </div>

      </div>
      {gpsOn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Drop pin every</span>
            <input 
              type="number" 
              value={gpsInterval} 
              onChange={e => setGpsInterval(Number(e.target.value))} 
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }} 
              min="1"
            />
            <span>meters</span>
          </label>
        </div>
      )}
    </div>
  );
};

export const MapFlyTo = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.length >= 2) {
      const lat = parseFloat(center[0]);
      const lng = parseFloat(center[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        map.flyTo([lat, lng], 16);
      }
    }
  }, [center, map]);
  return null;
};

export const FarmLocationButton = () => {
  const map = useMap();
  const mapCenter = useSelector(state => state.settings?.mapCenter);
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 15;

  return (
    <div className="leaflet-top leaflet-left" style={{ pointerEvents: 'auto', marginTop: '80px', marginLeft: '10px' }}>
      <div className="leaflet-control leaflet-bar" style={{ border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <button 
          onClick={(e) => {
            e.preventDefault();
            if (mapCenter) {
              map.flyTo(mapCenter, mapZoom);
            }
          }}
          title="Return to Farm Base"
          className="btn map-toolbar-btn"
          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', color: '#333', cursor: 'pointer', padding: 0 }}
        >
          <Tractor size={16} />
        </button>
      </div>
    </div>
  );
};
