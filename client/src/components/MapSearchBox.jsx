import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { useSelector, useDispatch } from 'react-redux';
import { setSnapGap, saveSettings } from '../store/settingsSlice';
import { LocateFixed, Map as MapIcon, Eraser, Plus, Tractor, Magnet, Copy } from 'lucide-react';
import * as turf from '@turf/turf';

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
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  };

  return (
    <button
      type="button"
      onClick={locateUser}
      disabled={disabled}
      className="btn map-toolbar-btn"
      style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      title="Go to Current Location"
    >
      <LocateFixed size={16} className={isLocating ? 'spin' : ''} />
    </button>
  );
};

export const MapSearchBox = ({ onLocationFound, onClear, polygon, setPolygon, activeId }) => {
  const [query, setQuery] = useState('');
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsInterval, setGpsInterval] = useState(30);
  const [isLocating, setIsLocating] = useState(false);
  const globalMapCenter = useSelector(state => state.settings?.mapCenter);
  const snapGap = useSelector(state => state.settings?.snapGap) ?? 5;
  const dispatch = useDispatch();
  
  // Data for snapping
  const fields = useSelector(state => state.fields?.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const pois = useSelector(state => state.poi?.list) || [];
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
  }, [gpsOn, gpsInterval, onLocationFound]);

  const handleSnap = () => {
    if (!polygon || polygon.length === 0 || !setPolygon) return;
    
    const existingPolygons = [];
    const existingLines = []; // Used for edge snapping, supports 2-point lines
    
    const addPolygon = (polyStringOrArr) => {
      let arr = [];
      try { arr = typeof polyStringOrArr === 'string' ? JSON.parse(polyStringOrArr) : polyStringOrArr; } catch (e) {}
      
      // Handle GeoJSON Feature or Geometry
      if (arr && typeof arr === 'object' && !Array.isArray(arr)) {
        if (arr.type === 'Feature' && arr.geometry && arr.geometry.coordinates) {
          arr = arr.geometry.coordinates[0];
        } else if (arr.type === 'Polygon' && arr.coordinates) {
          arr = arr.coordinates[0];
        }
      }

      if (Array.isArray(arr) && arr.length >= 2) {
        // Turf uses [lng, lat]
        const turfCoords = arr.map(pt => {
          if (Array.isArray(pt)) return [Number(pt[1]), Number(pt[0])];
          if (pt && typeof pt === 'object' && pt.lat !== undefined) return [Number(pt.lng || pt.lon || pt.longitude), Number(pt.lat)];
          return null;
        }).filter(Boolean);
        
        if (turfCoords.length >= 3) {
          if (turfCoords[0][0] !== turfCoords[turfCoords.length-1][0] || turfCoords[0][1] !== turfCoords[turfCoords.length-1][1]) {
            turfCoords.push([...turfCoords[0]]);
          }
          try {
            const poly = turf.polygon([turfCoords]);
            existingPolygons.push(poly);
            existingLines.push(turf.polygonToLine(poly));
          } catch(e) { console.warn("Failed to create turf polygon:", e, turfCoords); }
        } else if (turfCoords.length === 2) {
          // If it's just a line (2 points), we can't use it for containment, but we can snap to it!
          try {
            existingLines.push(turf.lineString(turfCoords));
          } catch(e) {}
        }
      }
    };
    
    fields.forEach(f => { if (f.polygon && f.id !== activeId) addPolygon(f.polygon); });
    nurseries.forEach(n => { if (n.polygon && n.id !== activeId) addPolygon(n.polygon); });
    pois.forEach(p => { if (p.points && p.id !== activeId) addPolygon(p.points); });

    // Current polygon in [lng, lat]
    const drawnLngLat = polygon.map(pt => [pt[1], pt[0]]);
    
    // Close the drawn polygon for containment testing
    let drawnPoly = null;
    if (drawnLngLat.length >= 3) {
      const closedCoords = [...drawnLngLat];
      if (closedCoords[0][0] !== closedCoords[closedCoords.length-1][0] || closedCoords[0][1] !== closedCoords[closedCoords.length-1][1]) {
        closedCoords.push([...closedCoords[0]]);
      }
      try { drawnPoly = turf.polygon([closedCoords]); } catch(e) {}
    }

    // Filter out existing lines that are INSIDE the drawn polygon
    // This prevents a large outer field from snapping inward to smaller interior features
    let validLines = existingLines;
    if (drawnPoly) {
      validLines = existingLines.filter(line => {
        let insideCount = 0;
        const coords = line.geometry.coordinates;
        coords.forEach(c => {
          if (turf.booleanPointInPolygon(turf.point(c), drawnPoly)) insideCount++;
        });
        // If more than 50% of vertices are inside, filter it out
        return (insideCount / coords.length) <= 0.5;
      });
    }

    const snappedPolygon = drawnLngLat.map((v, i) => {
      let snappedLngLat = [...v];
      let minDistance = snapGap; // dynamic threshold from Redux
      let closestVertex = [...snappedLngLat];
      const currentPt = turf.point(snappedLngLat);
      
      validLines.forEach(line => {
        try {
          const nearest = turf.nearestPointOnLine(line, currentPt);
          const dist = turf.distance(currentPt, nearest, {units: 'meters'});
          if (dist < minDistance) {
            minDistance = dist;
            closestVertex = nearest.geometry.coordinates;
          }
        } catch(e) { console.warn("Snap logic failed:", e); }
      });
      
      return [closestVertex[1], closestVertex[0]]; // Return [lat, lng]
    });

    let snappedCount = 0;
    snappedPolygon.forEach((p, i) => {
      // Small float comparison due to math precision
      if (Math.abs(p[0] - polygon[i][0]) > 0.0000001 || Math.abs(p[1] - polygon[i][1]) > 0.0000001) snappedCount++;
    });

    if (snappedCount > 0) {
      setPolygon(snappedPolygon);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Adjusted ${snappedCount} vertices using advanced topology.` }));
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `No boundaries were close enough to adjust.` }));
    }
  };

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

    // Multi-coordinate array parsing: e.g. [(lat, lng), (lat, lng)]
    const multiCoordsMatch = query.match(/\(\s*(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)\s*\)/g);
    if (multiCoordsMatch && multiCoordsMatch.length > 1) {
      multiCoordsMatch.forEach((matchStr, idx) => {
        const pair = matchStr.match(/(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)/);
        if (pair) {
          const lat = parseFloat(pair[1]);
          const lng = parseFloat(pair[3]);
          onLocationFound([lat, lng, Date.now() + idx]);
        }
      });
      setQuery('');
      return;
    }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
        <label htmlFor="snapGapInput" style={{ fontWeight: 500 }}>Snap Gap(meters):</label>
        <input 
          id="snapGapInput"
          type="number" 
          value={snapGap}
          onChange={(e) => {
            dispatch(setSnapGap(Number(e.target.value)));
            dispatch(saveSettings());
          }}
          style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
          min="1"
        />
      </div>

      {/* Row 1: Extended Search Input & Add Pin button */}
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <input
          type="text"
          placeholder="Search/Coords..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(e); }}
          style={{ flex: 1, padding: '6px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button 
          type="button" 
          onClick={handleSearch} 
          disabled={gpsOn}
          className="btn map-toolbar-btn" 
          style={{ flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: gpsOn ? 0.5 : 1, cursor: gpsOn ? 'not-allowed' : 'pointer' }}
          title="Add Pin"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Row 2: Gold Toolbar Buttons underneath the search input */}
      <div className="map-toolbar-container" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingBottom: '4px', alignItems: 'center' }}>
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
          style={{ flexShrink: 0, padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: gpsOn ? 0.5 : 1, cursor: gpsOn ? 'not-allowed' : 'pointer' }}
          title="Go to Farm Base"
        >
          <Tractor size={16} />
        </button>
        <button 
          type="button" 
          onClick={() => setGpsOn(!gpsOn)}
          className={`btn map-toolbar-btn ${gpsOn ? 'active' : ''}`}
          style={{ 
            flexShrink: 0,
            padding: '6px 10px', fontSize: '0.85rem', 
            display: 'flex', alignItems: 'center', gap: '4px',
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
            style={{ flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (gpsOn || !onClear) ? 0.5 : 1, cursor: (gpsOn || !onClear) ? 'not-allowed' : 'pointer' }}
            title="Clear Drawing / Pin Drop"
          >
             <Eraser size={16} />
          </button>
        )}
        {polygon !== undefined && setPolygon !== undefined && (
          <button 
            type="button" 
            onClick={handleSnap} 
            disabled={gpsOn || polygon.length === 0}
            className="btn map-toolbar-btn" 
            style={{ flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (gpsOn || polygon.length === 0) ? 0.5 : 1, cursor: (gpsOn || polygon.length === 0) ? 'not-allowed' : 'pointer' }}
            title={`Snap boundaries to nearest polygons (within ${snapGap}m)`}
          >
             <Magnet size={16} />
          </button>
        )}
        {polygon !== undefined && polygon.length > 0 && (
          <button 
            type="button" 
            className="btn map-toolbar-btn" 
            style={{ flexShrink: 0, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => {
              const str = '[' + polygon.map(p => `(${p[0]}, ${p[1]})`).join(',\n') + ']';
              navigator.clipboard.writeText(str);
              window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Coordinates copied to clipboard!' }));
            }} 
            title="Copy Coordinates to Clipboard"
          >
            <Copy size={16} />
          </button>
        )}
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
