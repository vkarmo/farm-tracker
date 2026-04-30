import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearLocations } from '../store/gpsSlice';
import { Trash2, Map, TrendingUp, List } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import CrudTable from './CrudTable';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

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

export default function GpsLogTab() {
  const dispatch = useDispatch();
  const logs = useSelector(state => state.gps?.locations) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;

  const [selectedUser, setSelectedUser] = useState('All');
  const [activeView, setActiveView] = useState('list');

  // Authorization check
  if (currentUser?.role !== 'Admin') {
    return <div className="card" style={{ padding: 40, textAlign: 'center' }}>Unauthorized Access</div>;
  }

  const handleClear = () => {
    if (window.confirm('Clear all stored GPS breadcrumbs?')) {
      dispatch(clearLocations());
    }
  };

  const uniqueUsers = Array.from(new Set(logs.map(log => log.userEmail))).sort((a, b) => a.localeCompare(b));

  const filteredLogs = logs.filter(log => {
    return selectedUser === 'All' || log.userEmail === selectedUser;
  }).reverse(); // Newest first

  const gpsColumns = [
    { key: 'timestamp', header: 'Timestamp', render: (r) => <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{new Date(r.timestamp).toLocaleString()}</span> },
    { key: 'userEmail', header: 'User', render: (r) => <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.userEmail}</span> },
    { key: 'lat', header: 'Latitude', render: (r) => <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.lat.toFixed(6)}</span> },
    { key: 'lng', header: 'Longitude', render: (r) => <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.lng.toFixed(6)}</span> },
    { key: 'altitude', header: 'Elevation', render: (r) => <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.altitude !== undefined && r.altitude !== null ? `${r.altitude.toFixed(1)}m` : 'N/A'}</span> }
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
        <button onClick={handleClear} className="btn" style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trash2 size={16} /> Purge Logs
        </button>
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

      {activeView === 'list' && (
        <CrudTable 
          data={filteredLogs}
          columns={gpsColumns}
          itemLabel="Coordinate"
          customTitle="GPS Breadcrumbs"
        />
      )}

      {activeView === 'map' && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '15px', background: '#f5f7fa', fontWeight: 600, color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={18} /> Map Visualization
          </div>
          <div style={{ height: '500px', width: '100%' }}>
            <MapContainer
              center={filteredLogs.length > 0 ? [filteredLogs[0].lat, filteredLogs[0].lng] : mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer attribution="Google Maps" url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" />
              {filteredLogs.map(log => {
                const d = new Date(log.timestamp);
                const dateStr = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;

                return (
                  <Marker key={log.id} position={[log.lat, log.lng]} icon={redIcon}>
                    <Popup>
                      <strong>{log.userEmail}</strong><br />
                      Date: {dateStr}<br />
                      Time: {d.toLocaleTimeString()}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
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
