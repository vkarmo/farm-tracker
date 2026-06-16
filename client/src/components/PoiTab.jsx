import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addPoi, deletePoi } from '../store/poiSlice';
import { MapPin, X, Copy, Droplet } from 'lucide-react';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './MapSearchBox';
import area from '@turf/area';
import length from '@turf/length';
import { polygon, lineString } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';


const ClickToDrawComponent = ({ points, setPoints, setCenter }) => {
  useMapEvents({
    click(e) {
      setPoints([...points, [e.latlng.lat, e.latlng.lng, Date.now()]]);
    }
  });
  return null;
};

const MapEventsHelper = ({ setMapInstance }) => {
  const map = useMap();
  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);
  return null;
};

export const fetchGeoLocationInfo = async (lat, lng, googleMapsApiKey) => {
  const url = googleMapsApiKey
    ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`
    : `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    let country = '';
    let region = '';
    let county = '';
    let city = '';

    if (googleMapsApiKey) {
      if (json.results && json.results.length > 0) {
        for (const result of json.results) {
          if (result.address_components) {
            for (const comp of result.address_components) {
              if (comp.types.includes('country')) {
                if (!country) country = comp.long_name;
              }
              if (comp.types.includes('administrative_area_level_1')) {
                if (!region) region = comp.long_name;
              }
              if (comp.types.includes('administrative_area_level_2')) {
                if (!county) county = comp.long_name;
              }
              if (comp.types.includes('locality') || comp.types.includes('sublocality') || comp.types.includes('postal_town') || comp.types.includes('neighborhood')) {
                if (!city) city = comp.long_name;
              }
            }
          }
          if (region && country && county && city) break;
        }
      }
    } else {
      country = json.countryName || '';
      region = json.principalSubdivision || '';
      city = json.city || json.locality || '';
      if (json.localityInfo && Array.isArray(json.localityInfo.administrative)) {
        const countyDiv = json.localityInfo.administrative.find(d => 
          d.description && d.description.toLowerCase().includes('county')
        ) || json.localityInfo.administrative.find(d => 
          d.adminLevel === 6 || d.adminLevel === 5 || (d.name && d.name.toLowerCase().includes('county'))
        );
        if (countyDiv) county = countyDiv.name;
      }
    }
    return { country, region, county, city };
  } catch (err) {
    console.warn('Error geocoding POI location:', err);
    return { country: '', region: '', county: '', city: '' };
  }
};

const INIT_STATE = { name: '', type: 'Terrain Feature', description: '', area: '', length: '', drawColor: '', isLine: false, country: '', region: '', county: '', city: '', zoomLevel: '', mapElevation: '' };

export default function PoiTab() {
  const dispatch = useDispatch();
  const poiList = useSelector(state => state.poi?.list) || [];
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';

  const [activeTab, setActiveTab] = useState('roster');
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [points, setPoints] = useState([]);
  const [searchResultCenter, setSearchResultCenter] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [loadingWaterway, setLoadingWaterway] = useState(false);

  const [showGroupDeletePanel, setShowGroupDeletePanel] = useState(false);
  const [groupDeleteCriteria, setGroupDeleteCriteria] = useState({
    user: '',
    type: '',
    startDate: '',
    endDate: ''
  });

  const getPoiDate = (poi) => {
    if (poi.createdAt) return new Date(poi.createdAt);
    const parts = (poi.id || '').split('_');
    if (parts.length > 1) {
      const ts = parseInt(parts[1]);
      if (!isNaN(ts)) return new Date(ts);
    }
    return new Date();
  };

  const handleGroupDelete = () => {
    const matching = poiList.filter(poi => {
      if (groupDeleteCriteria.user) {
        const user = (poi.createdBy || poi.lastUpdatedBy || '').toLowerCase();
        if (user !== groupDeleteCriteria.user.toLowerCase()) return false;
      }
      if (groupDeleteCriteria.type) {
        if (poi.type !== groupDeleteCriteria.type) return false;
      }
      const poiDate = getPoiDate(poi);
      if (groupDeleteCriteria.startDate) {
        const start = new Date(groupDeleteCriteria.startDate);
        start.setHours(0,0,0,0);
        if (poiDate < start) return false;
      }
      if (groupDeleteCriteria.endDate) {
        const end = new Date(groupDeleteCriteria.endDate);
        end.setHours(23,59,59,999);
        if (poiDate > end) return false;
      }
      return true;
    });

    if (matching.length === 0) {
      alert("No Points of Interest found matching the selected criteria.");
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete ${matching.length} Points of Interest matching the criteria?\n\n` +
      `User: ${groupDeleteCriteria.user || 'All'}\n` +
      `Type: ${groupDeleteCriteria.type || 'All'}\n` +
      `Date Range: ${groupDeleteCriteria.startDate || 'Any'} to ${groupDeleteCriteria.endDate || 'Any'}`;

    if (window.confirm(confirmMsg)) {
      matching.forEach(poi => {
        dispatch(deletePoi(poi.id));
        dispatch(queueAction({ type: 'core/deleteNode', payload: { id: poi.id }, meta: { id: Date.now() } }));
      });
      alert(`Successfully deleted ${matching.length} Points of Interest.`);
      setGroupDeleteCriteria({ user: '', type: '', startDate: '', endDate: '' });
      setShowGroupDeletePanel(false);
    }
  };

  const uniqueUsers = Array.from(new Set(
    poiList.map(p => p.createdBy || p.lastUpdatedBy).filter(Boolean)
  )).sort();

  const handleLocationFound = (loc) => {
    const newLoc = loc.length >= 3 ? loc : [loc[0], loc[1], Date.now()];
    setSearchResultCenter(newLoc);
    setPoints(prev => [...prev, newLoc]);
  };

  useEffect(() => {
    if (points.length >= 2) {
      try {
        const lineRing = points.map(p => [p[1], p[0]]); // Turf expects [lng, lat]
        const turfLine = lineString(lineRing);
        const lineLengthKm = length(turfLine, { units: 'kilometers' });
        const lineLengthMeters = lineLengthKm * 1000;

        let calculatedArea = 0;
        if (points.length >= 3) {
          const polyRing = [...lineRing];
          if (polyRing[0][0] !== polyRing[polyRing.length - 1][0] || polyRing[0][1] !== polyRing[polyRing.length - 1][1]) {
            polyRing.push([...polyRing[0]]); // Close the ring for area calculation
          }
          const turfPoly = polygon([polyRing]);
          const sqMeters = area(turfPoly);
          calculatedArea = sqMeters * 0.000247105; // Acres
        }

        setFormData(prev => ({
          ...prev,
          length: lineLengthMeters.toFixed(2),
          area: calculatedArea ? calculatedArea.toFixed(2) : prev.area
        }));
      } catch (err) {
        console.warn("Geographic computation failed:", err);
      }
    } else {
      setFormData(prev => ({ ...prev, length: '', area: '' }));
    }
  }, [points]);

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setPoints([]);
    setActiveTab('roster');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Validation Error: POI Name is required.");

    let country = formData.country || '';
    let region = formData.region || '';
    let county = formData.county || '';
    let city = formData.city || '';

    if (points && points.length > 0 && (!country || !region || !county || !city)) {
      const [lat, lng] = points[0];
      const geoInfo = await fetchGeoLocationInfo(lat, lng, googleMapsApiKey);
      country = country || geoInfo.country;
      region = region || geoInfo.region;
      county = county || geoInfo.county;
      city = city || geoInfo.city;
    }

    const userEmail = currentUser?.email || currentUser?.name || 'Unknown User';
    const currentZoom = mapInstance ? mapInstance.getZoom() : null;
    const finalZoom = formData.zoomLevel !== '' && formData.zoomLevel !== undefined && formData.zoomLevel !== null ? formData.zoomLevel : currentZoom;

    const finalData = { 
      ...formData, 
      points: JSON.stringify(points),
      country,
      region,
      county,
      city,
      zoomLevel: finalZoom !== null ? Number(finalZoom) : null,
      mapElevation: formData.mapElevation !== '' && formData.mapElevation !== undefined && formData.mapElevation !== null ? Number(formData.mapElevation) : null,
      lastUpdatedBy: userEmail
    };

    if (editingId) {
      // UPDATE
      const updatedPoi = { ...finalData, id: editingId };
      dispatch(addPoi(updatedPoi)); // Handles update logic based on findIndex
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedPoi }, meta: { id: Date.now() } }));
    } else {
      // CREATE
      const newPoi = { 
        ...finalData, 
        id: `poi_${Date.now()}`, 
        createdBy: userEmail,
        createdAt: new Date().toISOString()
      };
      dispatch(addPoi(newPoi));
      dispatch(queueAction({ type: 'poi/addPoi', payload: newPoi, meta: { id: Date.now() } }));
    }

    resetForm();
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    if (row.points) {
      try {
        const pts = typeof row.points === 'string' ? JSON.parse(row.points) : row.points;
        setPoints(Array.isArray(pts) ? pts : []);
        if (Array.isArray(pts) && pts.length > 0) setSearchResultCenter(pts[0]);
      } catch (e) { setPoints([]); }
    } else {
      setPoints([]);
      setSearchResultCenter(mapCenter);
    }
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (window.confirm("Permanently delete this point of interest?")) {
      dispatch(deletePoi(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) resetForm();
    }
  };

  const clearDrawing = () => {
    setPoints([]);
    setFormData(prev => ({ ...prev, area: '', length: '', isLine: false }));
  };

  const handleAutoDetectWaterway = async () => {
    if (!mapInstance) {
      alert('Map is not fully initialized yet.');
      return;
    }
    const bounds = mapInstance.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();
    
    setLoadingWaterway(true);
    try {
      const res = await fetch('/api/gee/find-waterways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minLat: southWest.lat,
          maxLat: northEast.lat,
          minLng: southWest.lng,
          maxLng: northEast.lng
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to detect waterway');
      }
      
      const data = await res.json();
      if (!data.points || data.points.length === 0) {
        alert('No waterway detected in the current view area.');
        return;
      }
      
      const ptsWithTime = data.points.map((pt, index) => [pt[0], pt[1], Date.now() + index]);
      setPoints(ptsWithTime);

      let country = '';
      let region = '';
      let county = '';
      let city = '';
      if (data.points.length > 0) {
        const [lat, lng] = data.points[0];
        try {
          const geoInfo = await fetchGeoLocationInfo(lat, lng, googleMapsApiKey);
          country = geoInfo.country || '';
          region = geoInfo.region || '';
          county = geoInfo.county || '';
          city = geoInfo.city || '';
        } catch (geoErr) {
          console.warn('Geocoding error in handleAutoDetectWaterway:', geoErr);
        }
      }

      const zoomVal = mapInstance ? mapInstance.getZoom() : null;

      setFormData(prev => ({
        ...prev,
        type: 'Water Source',
        name: prev.name || `Waterway ${new Date().toLocaleDateString()}`,
        isLine: true,
        drawColor: '#4fc3f7',
        country,
        region,
        county,
        city,
        zoomLevel: zoomVal || '',
        mapElevation: data.mapElevation !== undefined && data.mapElevation !== null ? data.mapElevation : ''
      }));
    } catch (err) {
      console.error(err);
      alert(`Waterway detection failed: ${err.message}`);
    } finally {
      setLoadingWaterway(false);
    }
  };

  const columns = [
    { key: 'name', header: 'POI Name' },
    { key: 'type', header: 'Type', style: { whiteSpace: 'nowrap', minWidth: '160px' } },
    { key: 'city', header: 'City/Town', render: r => r.city || '-', style: { whiteSpace: 'nowrap' } },
    { key: 'county', header: 'County', render: r => r.county || '-' },
    { key: 'region', header: 'Region/State', render: r => r.region || '-' },
    { key: 'country', header: 'Country', render: r => r.country || '-' },
    { key: 'zoomLevel', header: 'Zoom', render: r => r.zoomLevel !== undefined && r.zoomLevel !== null ? r.zoomLevel : '-' },
    { key: 'mapElevation', header: 'Avg Elevation (m)', render: r => r.mapElevation !== undefined && r.mapElevation !== null ? r.mapElevation : '-' },
    { key: 'description', header: 'Description' },
    { key: 'area', header: 'Area (Acres)', render: r => r.area || '-' },
    { key: 'length', header: 'Length (Meters)', render: r => r.length || '-' }
  ];

  // Map rendering logic
  const sortedPositions = points
    .map((p, i) => ({ pos: p, idx: i, time: p.length > 2 ? p[2] : 0 }))
    .sort((a, b) => {
      if (a.time === 0 && b.time === 0) return a.idx - b.idx;
      return a.time - b.time;
    })
    .map(obj => obj.pos);

  const latLngs = sortedPositions.map(p => [p[0], p[1]]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', background: '#f5f7fa' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('roster')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'roster' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'roster' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'roster' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            POI Registry
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('entry')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'entry' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'entry' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'entry' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            {editingId ? 'Edit Configuration' : 'Record POI'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => setShowGroupDeletePanel(!showGroupDeletePanel)}
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: showGroupDeletePanel ? '#ffebee' : '#fafafa',
                    color: showGroupDeletePanel ? '#c62828' : '#666',
                    border: '1px solid ' + (showGroupDeletePanel ? '#ef9a9a' : '#ccc'),
                    padding: '8px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  {showGroupDeletePanel ? 'Hide Group Delete Panel' : 'Show Group Delete Panel'}
                </button>
              </div>

              {showGroupDeletePanel && (
                <div style={{
                  background: '#fafafa',
                  border: '1px solid #ef9a9a',
                  borderLeft: '4px solid #c62828',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Group Delete Points of Interest
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#666' }}>
                    Select search criteria below to permanently delete matching Points of Interest. Keep fields empty to ignore them.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>Created/Updated By User</label>
                      <select
                        value={groupDeleteCriteria.user}
                        onChange={e => setGroupDeleteCriteria({ ...groupDeleteCriteria, user: e.target.value })}
                        style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '0.85rem' }}
                      >
                        <option value="">-- All Users --</option>
                        {uniqueUsers.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>POI Type</label>
                      <select
                        value={groupDeleteCriteria.type}
                        onChange={e => setGroupDeleteCriteria({ ...groupDeleteCriteria, type: e.target.value })}
                        style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '0.85rem' }}
                      >
                        <option value="">-- All Types --</option>
                        <option value="Water Source">Water Source</option>
                        <option value="Terrain Feature">Terrain Feature</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>Start Date</label>
                      <input
                        type="date"
                        value={groupDeleteCriteria.startDate}
                        onChange={e => setGroupDeleteCriteria({ ...groupDeleteCriteria, startDate: e.target.value })}
                        style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555' }}>End Date</label>
                      <input
                        type="date"
                        value={groupDeleteCriteria.endDate}
                        onChange={e => setGroupDeleteCriteria({ ...groupDeleteCriteria, endDate: e.target.value })}
                        style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setGroupDeleteCriteria({ user: '', type: '', startDate: '', endDate: '' })}
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Reset Filters
                    </button>
                    <button
                      type="button"
                      onClick={handleGroupDelete}
                      className="btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        background: '#c62828',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Delete Matching POIs
                    </button>
                  </div>
                </div>
              )}

              <CrudTable activeRowId={editingId}
                data={poiList}
                columns={columns}
                onEdit={handleEdit}
                onDelete={handleDelete}
                itemLabel="Point of Interest"
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>{editingId ? 'Edit Point of Interest' : 'Record Point of Interest'}</h2>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" onClick={resetForm} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
                    <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <MapPin size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update POI' : 'Save POI'}
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Point of Interest Name *</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. North Creek, Water Well 1" required />
                </div>

                <div className="form-group form-grid-full" style={{ marginBottom: '15px' }}>
                  <label>Draw Location / Auto-Detect Waterway</label>
                  <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <MapSearchBox onLocationFound={handleLocationFound} onClear={clearDrawing} polygon={points} setPolygon={setPoints} activeId={editingId} />
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoDetectWaterway}
                      disabled={loadingWaterway}
                      className="btn"
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        background: '#e0f7fa',
                        color: '#006064',
                        border: '1px solid #b2ebf2',
                        borderRadius: '4px',
                        height: '38px',
                        boxSizing: 'border-box'
                      }}
                      title="Detect waterway centerline in visible map view"
                    >
                      <Droplet size={16} />
                      {loadingWaterway ? 'Scanning...' : 'Auto-Detect Waterway'}
                    </button>
                  </div>
                  <ResizableMapWrapper initialHeight={500} style={{ marginBottom: '20px' }}>
                    <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                      <MapEventsHelper setMapInstance={setMapInstance} />
                      <MapResizer />
                      <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />

                      <MapFlyTo center={searchResultCenter} />
                      <ClickToDrawComponent points={points} setPoints={setPoints} setCenter={setSearchResultCenter} />

                      {latLngs.length > 2 && !formData.isLine && <Polygon positions={latLngs} pathOptions={{ color: formData.drawColor || polygonColor, weight: 1.5, opacity: 0.6, fillOpacity: 0.3 }} />}
                      {latLngs.length > 1 && (formData.isLine || latLngs.length <= 2) && <Polyline positions={latLngs} pathOptions={{ color: formData.drawColor || '#4fc3f7', weight: (formData.name || '').toLowerCase().includes('waterway') ? 8 : 4, opacity: 0.85, dashArray: '10, 10' }} />}
                      {latLngs.map((pos, idx) => (
                        <Marker key={idx} position={pos} opacity={0.8} />
                      ))}

                      {/* Render existing POIs for editing (clickable) */}
                      {poiList.filter(p => p.id !== editingId).map(p => {
                        let existingPts = [];
                        try { existingPts = typeof p.points === 'string' ? JSON.parse(p.points) : p.points; } catch (e) { }
                        if (!existingPts || existingPts.length === 0) return null;
                        const mappedPts = existingPts.map(pt => [pt[0], pt[1]]);

                        const handleClick = (e) => {
                          e.originalEvent.stopPropagation();
                          if (editingId || points.length > 0) return;
                          handleEdit(p);
                        };

                        const isPolyline = p.isLine || p.drawType === 'polyline' || mappedPts.length === 2;
                        if (isPolyline && mappedPts.length > 1) {
                          return <Polyline key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || '#4fc3f7', weight: (p.name || '').toLowerCase().includes('waterway') ? 8 : 3, opacity: 0.8, bubblingMouseEvents: false }} eventHandlers={{ click: handleClick }} />
                        } else if (mappedPts.length > 2) {
                          return <Polygon key={p.id} positions={mappedPts} pathOptions={{ color: p.drawColor || polygonColor, weight: 1.2, opacity: 0.6, fillOpacity: 0.1, bubblingMouseEvents: false }} eventHandlers={{ click: handleClick }} />
                        } else {
                          return <Marker key={p.id} position={mappedPts[0]} opacity={0.5} bubblingMouseEvents={false} eventHandlers={{ click: handleClick }} />
                        }
                      })}

                      {/* Render fields for context (unclickable) */}
                      {fields.map(f => {
                        let positions = [];
                        if (f.polygon) { try { positions = typeof f.polygon === 'string' ? JSON.parse(f.polygon) : f.polygon; } catch (e) { } }
                        if (positions.length === 0) return null;
                        return <Polygon key={f.id} positions={positions} pathOptions={{ color: f.drawColor || '#ffffff', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                      })}

                      {/* Render nurseries for context (unclickable) */}
                      {nurseries.map(n => {
                        let positions = [];
                        if (n.polygon) { try { positions = typeof n.polygon === 'string' ? JSON.parse(n.polygon) : n.polygon; } catch (e) { } }
                        if (positions.length === 0) return null;
                        return <Polygon key={n.id} positions={positions} pathOptions={{ color: n.drawColor || 'orange', weight: 0.8, opacity: 0.5, dashArray: '5,5', fillOpacity: 0.1 }} interactive={false} />;
                      })}

                    </MapContainer>
                  </ResizableMapWrapper>
                </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                      <option value="Water Source">Water Source</option>
                      <option value="Terrain Feature">Terrain Feature</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Short description" />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input type="text" value={formData.country || ''} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="Auto-detecting country" />
                  </div>
                  <div className="form-group">
                    <label>Region / State</label>
                    <input type="text" value={formData.region || ''} onChange={e => setFormData({ ...formData, region: e.target.value })} placeholder="Auto-detecting region" />
                  </div>
                  <div className="form-group">
                    <label>City / Town</label>
                    <input type="text" value={formData.city || ''} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Auto-detecting city/town" />
                  </div>
                  <div className="form-group">
                    <label>County</label>
                    <input type="text" value={formData.county || ''} onChange={e => setFormData({ ...formData, county: e.target.value })} placeholder="Auto-detecting county" />
                  </div>
                  <div className="form-group">
                    <label>Map Zoom Level</label>
                    <input type="number" value={formData.zoomLevel || ''} onChange={e => setFormData({ ...formData, zoomLevel: e.target.value })} placeholder="Map zoom level" />
                  </div>
                  <div className="form-group">
                    <label>Map Elevation (Meters)</label>
                    <input type="number" step="0.01" value={formData.mapElevation || ''} onChange={e => setFormData({ ...formData, mapElevation: e.target.value })} placeholder="Avg elevation of view" />
                  </div>
                  {editingId && (
                    <>
                      <div className="form-group">
                        <label>Created By</label>
                        <input type="text" value={formData.createdBy || ''} readOnly style={{ background: '#f5f5f5', cursor: 'not-allowed', color: '#666' }} />
                      </div>
                      <div className="form-group">
                        <label>Last Updated By</label>
                        <input type="text" value={formData.lastUpdatedBy || ''} readOnly style={{ background: '#f5f5f5', cursor: 'not-allowed', color: '#666' }} />
                      </div>
                    </>
                  )}
                  <div className="form-group">
                    <label>Calculated Length (Meters)</label>
                    <input type="number" step="0.01" value={formData.length} onChange={e => setFormData({ ...formData, length: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Calculated Area (Acres)</label>
                    <input type="number" step="0.01" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Draw Color</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input type="color" value={formData.drawColor || polygonColor} onChange={e => setFormData({ ...formData, drawColor: e.target.value })} />
                      {formData.drawColor && (
                        <button type="button" onClick={() => setFormData({ ...formData, drawColor: '' })} className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }}>Clear</button>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '24px' }}>
                      <input 
                        type="checkbox" 
                        checked={formData.isLine || false} 
                        onChange={e => setFormData({ ...formData, isLine: e.target.checked })} 
                        style={{ width: '16px', height: '16px', margin: 0 }}
                      />
                      Render as Line (Waterway / Path)
                    </label>
                  </div>
                </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}

