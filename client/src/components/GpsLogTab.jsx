import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearLocations, deleteGpsLocations } from '../store/gpsSlice';
import { Trash2, Map, TrendingUp, List } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapFlyTo } from './MapSearchBox';
import { Tractor } from 'lucide-react';
import L from 'leaflet';
import ResizableMapWrapper, { MapResizer } from './ResizableMapWrapper';


// Fix for leaflet marker icon missing in some react-leaflet builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Create a custom red icon for GPS markers
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBoundsFitter({ points, selectedUser }) {
  const map = useMap();
  useEffect(() => {
    if (selectedUser === 'All') {
      map.setView([20, 0], 2);
    } else if (points && points.length > 0) {
      const bounds = points.map(p => [p.lat, p.lng]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [points, selectedUser, map]);
  return null;
}

export default function GpsLogTab() {
  const dispatch = useDispatch();
  const logs = useSelector(state => state.gps?.locations) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [selectedUser, setSelectedUser] = useState('All');
  const [activeView, setActiveView] = useState('list');
  const [flyTarget, setFlyTarget] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [selectedUser]);

  // Authorization check
  if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Admin Viewer') {
    return <div className="card" style={{ padding: 40, textAlign: 'center' }}>Unauthorized Access</div>;
  }

  const handleClear = () => {
    if (window.confirm('Clear all stored GPS breadcrumbs?')) {
      dispatch(clearLocations());
      setSelectedIds([]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected GPS coordinates?`)) {
      dispatch(deleteGpsLocations(selectedIds));
      setSelectedIds([]);
      setActiveIndex(-1);
    }
  };

  const uniqueUsers = Array.from(new Set(logs.map(log => log.userEmail?.trim()?.toLowerCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const filteredLogs = logs.filter(log => {
    if (selectedUser === 'All') return true;
    if (!log.userEmail) return false;
    return log.userEmail.trim().toLowerCase() === selectedUser.trim().toLowerCase();
  }).reverse(); // Newest first

  console.log('[GpsLogTab] logs count:', logs.length, 'selectedUser:', selectedUser, 'filteredLogs count:', filteredLogs.length);

  const handleNextPoint = () => {
    if (filteredLogs.length === 0) return;
    const nextIdx = (activeIndex + 1) % filteredLogs.length;
    setActiveIndex(nextIdx);
    const p = filteredLogs[nextIdx];
    setFlyTarget([p.lat, p.lng, Date.now()]);
  };

  const handlePrevPoint = () => {
    if (filteredLogs.length === 0) return;
    const prevIdx = activeIndex <= 0 ? filteredLogs.length - 1 : activeIndex - 1;
    setActiveIndex(prevIdx);
    const p = filteredLogs[prevIdx];
    setFlyTarget([p.lat, p.lng, Date.now()]);
  };

  const gpsColumns = [
    { key: 'timestamp', header: 'Timestamp', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString()}</span> },
    { key: 'userEmail', header: 'User', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px', display: 'inline-block' }} title={r.userEmail}>{r.userEmail}</span> },
    { key: 'lat', header: 'Latitude', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.lat.toFixed(6)}</span> },
    { key: 'lng', header: 'Longitude', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.lng.toFixed(6)}</span> },
    { key: 'altitude', header: 'Elevation', render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{r.altitude !== undefined && r.altitude !== null ? `${r.altitude.toFixed(1)}m` : 'N/A'}</span> }
  ];

  const chartData = [...filteredLogs].reverse().map(log => ({
    time: new Date(log.timestamp).toLocaleTimeString(),
    date: new Date(log.timestamp).toLocaleDateString(),
    elevation: log.altitude !== undefined && log.altitude !== null ? parseFloat(log.altitude.toFixed(1)) : null,
    user: log.userEmail
  })).filter(d => d.elevation !== null);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>User GPS Tracking Logs</h2>
        {currentUser?.role !== 'Admin Viewer' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {selectedIds.length > 0 && (
              <button 
                onClick={handleDeleteSelected} 
                className="btn" 
                style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
              </button>
            )}
            <button onClick={handleClear} className="btn" style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={16} /> Purge Logs
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Filter User:</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="All">All</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setActiveView('list')} className={`btn ${activeView === 'list' ? 'btn-primary' : ''}`} style={{ background: activeView !== 'list' ? '#f0f0f0' : '', color: activeView !== 'list' ? '#333' : '', display: 'flex', alignItems: 'center', gap: 6 }}>
            <List size={16} /> List
          </button>
          <button onClick={() => setActiveView('map')} className={`btn ${activeView === 'map' ? 'btn-primary' : ''}`} style={{ background: activeView !== 'map' ? '#f0f0f0' : '', color: activeView !== 'map' ? '#333' : '', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Map size={16} /> Map
          </button>
          <button onClick={() => setActiveView('elevation')} className={`btn ${activeView === 'elevation' ? 'btn-primary' : ''}`} style={{ background: activeView !== 'elevation' ? '#f0f0f0' : '', color: activeView !== 'elevation' ? '#333' : '', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={16} /> Elevation
          </button>
        </div>
      </div>

      {filteredLogs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#f9fbe7', padding: '12px 20px', borderRadius: '8px', border: '1px solid #d4e157', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#558b2f' }}>
            Point Navigation: {activeIndex === -1 ? 'None selected' : `Point ${activeIndex + 1} of ${filteredLogs.length}`}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button"
              onClick={handlePrevPoint} 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              &larr; Prev
            </button>
            <button 
              type="button"
              onClick={handleNextPoint} 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Next &rarr;
            </button>
            {activeIndex !== -1 && (
              <button 
                type="button"
                onClick={() => { setActiveIndex(-1); }} 
                className="btn" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', background: '#fff', color: '#666', border: '1px solid #ccc', cursor: 'pointer' }}
              >
                Clear Selection
              </button>
            )}
          </div>
          {activeIndex !== -1 && (
            <div style={{ fontSize: '0.8rem', color: '#555', fontFamily: 'monospace' }}>
              Lat: {filteredLogs[activeIndex].lat.toFixed(6)}, Lng: {filteredLogs[activeIndex].lng.toFixed(6)} | Time: {new Date(filteredLogs[activeIndex].timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {activeView === 'list' && (
        <CrudTable 
          data={filteredLogs}
          columns={gpsColumns}
          itemLabel="Coordinate"
          customTitle="GPS Breadcrumbs"
          onEdit={(row) => {
            const idx = filteredLogs.findIndex(l => l.id === row.id);
            if (idx !== -1) {
              setActiveIndex(idx);
              setFlyTarget([row.lat, row.lng, Date.now()]);
            }
          }}
          activeRowId={activeIndex !== -1 ? filteredLogs[activeIndex]?.id : null}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {activeView === 'map' && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '15px', background: '#f5f7fa', fontWeight: 600, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Map size={18} /> Map Visualization
            </div>
            <button
              type="button"
              onClick={() => {
                if (mapCenter) {
                  setFlyTarget([mapCenter[0], mapCenter[1], Date.now()]);
                }
              }}
              className="btn map-toolbar-btn"
              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white' }}
              title="Go to Farm Base"
            >
              <Tractor size={16} /> Go to Farm
            </button>
          </div>
          <ResizableMapWrapper initialHeight={500} style={{ width: '100%' }}>
            <MapContainer
              center={filteredLogs.length > 0 ? [filteredLogs[0].lat, filteredLogs[0].lng] : mapCenter}
              zoom={mapZoom}
              maxZoom={24}
              style={{ height: '100%', width: '100%' }}
            >
              <MapResizer />
              <MapBoundsFitter points={filteredLogs} selectedUser={selectedUser} />
              <MapFlyTo center={flyTarget} />
              <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />
              {filteredLogs.map((log, index) => {
                const d = new Date(log.timestamp);
                const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
                const isActive = activeIndex === index;

                return (
                  <Marker key={log.id} position={[log.lat, log.lng]} icon={isActive ? activeIcon : redIcon} zIndexOffset={isActive ? 1000 : 0}>
                    <Popup>
                      <strong>{log.userEmail}</strong><br />
                      Date: {dateStr}<br />
                      Time: {d.toLocaleTimeString()}<br />
                      {isActive && <strong style={{ color: '#2e7d32' }}>Active Selection</strong>}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </ResizableMapWrapper>
        </div>
      )}

      {activeView === 'elevation' && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '15px', background: '#f5f7fa', fontWeight: 600, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} /> Elevation Changes Over Time
          </div>
          <div style={{ height: '400px', width: '100%', padding: '20px', background: 'white' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => [`${value} m`, 'Elevation']} labelFormatter={(label) => `Time: ${label}`} />
                  <Legend />
                  <Line type="monotone" dataKey="elevation" stroke="#f57c00" activeDot={{ r: 8 }} strokeWidth={2} name="Elevation (m)" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>
                No elevation data available for the selected filters.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
