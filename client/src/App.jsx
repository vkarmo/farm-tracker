import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchFields } from './store/fieldsSlice';
import { addUnit, removeUnit, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter } from './store/settingsSlice';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LocationMarker = () => {
  const dispatch = useDispatch();
  useMapEvents({
    click(e) {
      dispatch(setMapCenter([e.latlng.lat, e.latlng.lng]));
    },
  });
  const position = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  return <Marker position={position}></Marker>;
};
import { Wifi, WifiOff, CloudOff, Target, Tractor, Leaf, DollarSign, MapPin, Rabbit, Settings, BarChart, Layers, Box, ClipboardList, ShieldAlert, Calculator } from 'lucide-react';
import MapLayer from './MapLayer';

// Modular Tabs
import FieldTab from './components/FieldTab';
import NurseryTab from './components/NurseryTab';
import CropTab from './components/CropTab';
import HarvestTab from './components/HarvestTab';
import LivestockTab from './components/LivestockTab';
import FinanceTab from './components/FinanceTab';
import BudgetTab from './components/BudgetTab';
import ActivityTab from './components/ActivityTab';
import LoginScreen from './components/LoginScreen';
import AdminTab from './components/AdminTab';
import DashboardTab from './components/DashboardTab';
import { logout } from './store/authSlice';

export default function App() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const fields = useSelector(state => state.fields.data) || [];
  const units = useSelector(state => state.settings?.units) || ['lbs'];
  const kmlUrls = useSelector(state => state.settings?.kmlUrls) || [];
  const logo = useSelector(state => state.settings?.logo);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const syncQueue = useSelector(state => state.sync.offlineActionQueue) || [];
  const isSyncing = useSelector(state => state.sync.isSyncing);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [newUnit, setNewUnit] = useState('');
  const [newKml, setNewKml] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    dispatch(fetchFields());
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, [dispatch]);

  const handleAddUnit = (e) => { e.preventDefault(); if (newUnit) { dispatch(addUnit(newUnit.toLowerCase())); setNewUnit(''); } };
  const handleAddKml = (e) => { e.preventDefault(); if (newKml) { dispatch(addKmlUrl(newKml)); setNewKml(''); } };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        dispatch(setLogo(reader.result));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {logo ? (
            <img src={logo} alt="Company Logo" style={{ maxHeight: '40px', maxWidth: '150px', objectFit: 'contain' }} />
          ) : (
            <Tractor color="var(--color-primary-dark)" />
          )}
          <h1>Antigravity Farm Tracker</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {isSyncing ? (
            <div className="status-indicator status-syncing"><CloudOff size={16} /> Syncing...</div>
          ) : isOnline ? (
            <div className="status-indicator status-online"><Wifi size={16} /> Online</div>
          ) : (
            <div className="status-indicator status-offline">
              <WifiOff size={16} /> Offline
              {syncQueue.length > 0 && <span style={{marginLeft: '4px'}}>({syncQueue.length} pending)</span>}
            </div>
          )}
          
          <button onClick={() => { if(window.confirm('Sign out and lock offline data?')) dispatch(logout()) }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
             Sign Out
          </button>
        </div>
      </header>

      <nav style={{ display: 'flex', background: 'var(--color-surface)', padding: '10px 16px', borderBottom: '1px solid var(--color-border)', gap: '10px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}><BarChart size={16} style={{marginRight: 6}}/> Dashboard</button>
        <button onClick={() => setActiveTab('map')} className={`btn ${activeTab === 'map' ? 'btn-primary' : ''}`}><MapPin size={16} style={{marginRight: 6}}/> Map</button>
        <button onClick={() => setActiveTab('field')} className={`btn ${activeTab === 'field' ? 'btn-primary' : ''}`}><Target size={16} style={{marginRight: 6}}/> Fields</button>
        <button onClick={() => setActiveTab('nursery')} className={`btn ${activeTab === 'nursery' ? 'btn-primary' : ''}`}><Box size={16} style={{marginRight: 6}}/> Nursery</button>
        <button onClick={() => setActiveTab('crop')} className={`btn ${activeTab === 'crop' ? 'btn-primary' : ''}`}><Leaf size={16} style={{marginRight: 6}}/> Crops</button>
        <button onClick={() => setActiveTab('activity')} className={`btn ${activeTab === 'activity' ? 'btn-primary' : ''}`}><ClipboardList size={16} style={{marginRight: 6}}/> Activities</button>
        <button onClick={() => setActiveTab('harvest')} className={`btn ${activeTab === 'harvest' ? 'btn-primary' : ''}`}><BarChart size={16} style={{marginRight: 6}}/> Harvests</button>
        <button onClick={() => setActiveTab('livestock')} className={`btn ${activeTab === 'livestock' ? 'btn-primary' : ''}`}><Rabbit size={16} style={{marginRight: 6}}/> Livestock</button>
        <button onClick={() => setActiveTab('finance')} className={`btn ${activeTab === 'finance' ? 'btn-primary' : ''}`}><DollarSign size={16} style={{marginRight: 6}}/> Financials</button>
        <button onClick={() => setActiveTab('budget')} className={`btn ${activeTab === 'budget' ? 'btn-primary' : ''}`}><Calculator size={16} style={{marginRight: 6}}/> Budgets</button>
        <div style={{ flex: 1 }}></div>
        {currentUser?.role === 'Admin' && (
           <button onClick={() => setActiveTab('admin')} className={`btn ${activeTab === 'admin' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'admin' ? '#c62828' : 'white', color: activeTab === 'admin' ? 'white' : '#c62828', borderColor: '#c62828' }}>
             <ShieldAlert size={16} style={{marginRight: 6}}/> Admin
           </button>
        )}
        <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : ''}`}><Settings size={16} style={{marginRight: 6}}/> Settings</button>
      </nav>

      <main className="container" style={{ marginTop: '20px' }}>
        
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'map' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
            <h2>GIS Field Map</h2>
            <MapLayer fields={fields} />
          </div>
        )}

        {/* Modular Entity CRUD Component Wrappers */}
        {activeTab === 'field' && <FieldTab />}
        {activeTab === 'nursery' && <NurseryTab />}
        {activeTab === 'crop' && <CropTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'harvest' && <HarvestTab />}
        {activeTab === 'livestock' && <LivestockTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'admin' && <AdminTab />}

        {activeTab === 'settings' && (
           <div className="card">
           <h2>Configuration</h2>
           <div style={{marginBottom: 20}}>
             <h3>Company Logo</h3>
             <div style={{ marginBottom: 16 }}>
               {logo && (
                 <div style={{ marginBottom: 10 }}>
                   <img src={logo} alt="Current Logo" style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                   <br/>
                   <button onClick={() => dispatch(setLogo(null))} className="btn" style={{marginTop: 8, background: '#ffebee', color: '#c62828', padding: '4px 8px'}}>Remove Logo</button>
                 </div>
               )}
               <input type="file" accept="image/*" onChange={handleLogoUpload} className="btn" style={{ padding: '6px' }} />
             </div>
           </div>
           <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0'}} />
           <div style={{marginBottom: 20}}>
             <h3>Configurable Measurement Units</h3>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
               {units.map(u => (
                 <span key={u} className="status-indicator" style={{background: '#e0e0e0', color: '#333'}}>
                   {u} <button onClick={() => dispatch(removeUnit(u))} style={{border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4}}>x</button>
                 </span>
               ))}
             </div>
             <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '10px' }}>
               <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g. pallets, boxes" style={{flex: 1}}/>
               <button type="submit" className="btn btn-primary">Add Unit</button>
             </form>
           </div>
           <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0'}} />
           <div>
             <h3><Layers size={16} style={{marginRight: 6, display: 'inline'}} /> Map Configuration (KML Layers)</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 16 }}>
               {kmlUrls.map(url => (
                 <div key={url} className="list-item" style={{display: 'flex', justifyContent: 'space-between', flexDirection: 'row'}}>
                   <span style={{wordBreak: 'break-all'}}>{url}</span>
                   <button onClick={() => dispatch(removeKmlUrl(url))} className="btn" style={{background: '#ffebee', color: '#c62828', padding: '4px 8px'}}>Remove</button>
                 </div>
               ))}
             </div>
             <form onSubmit={handleAddKml} style={{ display: 'flex', gap: '10px' }}>
               <input type="url" value={newKml} onChange={e => setNewKml(e.target.value)} placeholder="https://example.com/farm.kml" style={{flex: 1}}/>
               <button type="submit" className="btn btn-primary">Add Layer</button>
             </form>
           </div>

           <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0'}} />
           
           <div style={{marginBottom: 20}}>
             <h3>Map Preferences</h3>
             <div style={{ marginBottom: 16 }}>
               <label>Polygon Draw Color</label>
               <input type="color" value={polygonColor} onChange={(e) => dispatch(setPolygonColor(e.target.value))} style={{ display: 'block', marginTop: 8 }} />
             </div>
             <div>
               <label>Default Map Tab Location (Drop Pin by clicking on map)</label>
               <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: 8 }}>
                 <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                   <TileLayer attribution="Google Maps" url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" />
                   <LocationMarker />
                 </MapContainer>
               </div>
             </div>
           </div>

          </div>
        )}

      </main>
    </>
  );
}
