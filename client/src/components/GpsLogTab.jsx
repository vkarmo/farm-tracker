import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearLocations } from '../store/gpsSlice';
import { Search, Trash2, Map, ChevronDown, ChevronUp } from 'lucide-react';
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('All');
  const [mapExpanded, setMapExpanded] = useState(false);

  // Authorization check
  if (currentUser?.role !== 'Admin') {
    return <div className="card" style={{ padding: 40, textAlign: 'center' }}>Unauthorized Access</div>;
  }

  const handleClear = () => {
    if (window.confirm('Clear all stored GPS breadcrumbs?')) {
      dispatch(clearLocations());
    }
  };

  const uniqueUsers = Array.from(new Set(logs.map(log => log.userEmail)));

  const filteredLogs = logs.filter(log => {
    const matchesUser = selectedUser === 'All' || log.userEmail === selectedUser;
    const matchesSearch = log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.lat?.toString().includes(searchTerm) ||
                          log.lng?.toString().includes(searchTerm);
    return matchesUser && matchesSearch;
  }).reverse(); // Newest first

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>User GPS Tracking Logs</h2>
        <button onClick={handleClear} className="btn" style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trash2 size={16} /> Purge Logs
        </button>
      </div>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
          <input 
            type="text" 
            placeholder="Search coordinates or users..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>
        
        <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Filter User:</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="All">All</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Latitude</th>
              <th>Longitude</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{log.userEmail}</td>
                  <td style={{ fontFamily: 'monospace' }}>{log.lat.toFixed(6)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{log.lng.toFixed(6)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-light)' }}>
                  No GPS coordinates recorded matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
        <button 
          onClick={() => setMapExpanded(!mapExpanded)} 
          style={{ width: '100%', padding: '15px', background: '#f5f7fa', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600, color: 'var(--color-primary-dark)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Map size={18} /> Map Visualization</span>
          {mapExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        
        {mapExpanded && (
          <div style={{ height: '400px', width: '100%' }}>
            {filteredLogs.length > 0 ? (
              <MapContainer 
                center={[filteredLogs[0].lat, filteredLogs[0].lng]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer attribution="Google Maps" url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" />
                {filteredLogs.map(log => {
                  const d = new Date(log.timestamp);
                  const dateStr = `${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
                  
                  return (
                    <Marker key={log.id} position={[log.lat, log.lng]} icon={redIcon}>
                      <Popup>
                        <strong>{log.userEmail}</strong><br/>
                        Date: {dateStr}<br/>
                        Time: {d.toLocaleTimeString()}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0', color: '#666' }}>
                No coordinates to display on map.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
