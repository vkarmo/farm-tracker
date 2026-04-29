import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchFields } from './store/fieldsSlice';
import { addUnit, removeUnit, addJobTitle, removeJobTitle, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold, saveSettings } from './store/settingsSlice';
import { addLocation } from './store/gpsSlice';
import { queueAction, fetchInitialData } from './store/syncSlice';
import { MapSearchBox, MapFlyTo, CurrentLocationControl } from './components/MapSearchBox';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { CACHE_NAME } from './config/cache';

import { Wifi, WifiOff, CloudOff, Target, Tractor, Leaf, DollarSign, MapPin, Rabbit, Settings, BarChart, Layers, Box, ClipboardList, ShieldAlert, Calculator, CalendarClock, AlertTriangle, LogOut, Database, Users, Contact, Briefcase, RefreshCw, Home } from 'lucide-react';
import NmkLogo from './components/NmkLogo';
import MapLayer from './MapLayer';

// Modular Tabs
import FieldTab from './components/FieldTab';
import NurseryTab from './components/NurseryTab';
import CropTab from './components/CropTab';
import HarvestTab from './components/HarvestTab';
import LivestockTab from './components/LivestockTab';
import FinanceTab from './components/FinanceTab';
import BudgetTab from './components/BudgetTab';
// import ActivityTab from './components/ActivityTab';
import DeadlineTab from './components/DeadlineTab';
import IncidentTab from './components/IncidentTab';
import LoginScreen from './components/LoginScreen';
import AdminTab from './components/AdminTab';
import AccessControlTab from './components/AccessControlTab';
import DashboardTab from './components/DashboardTab';
import AssignmentTab from './components/AssignmentTab';
import EmployeeTab from './components/EmployeeTab';
import EquipmentTab from './components/EquipmentTab';
import SyncTab from './components/SyncTab';
import AuditTab from './components/AuditTab';
import GpsLogTab from './components/GpsLogTab';
import { logout } from './store/authSlice';
import { logAction } from './store/auditSlice';

export default function App() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const equipment = useSelector(state => state.assets?.equipment) || [];
  const units = useSelector(state => state.settings?.units) || ['lbs'];
  const jobTitles = useSelector(state => state.settings?.jobTitles) || [];
  const kmlUrls = useSelector(state => state.settings?.kmlUrls) || [];
  const logo = useSelector(state => state.settings?.logo);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const gpsDistanceThreshold = useSelector(state => state.settings?.gpsDistanceThreshold) || 10;
  const lastGpsLocation = useSelector(state => {
    const locs = state.gps?.locations || [];
    return locs.length > 0 ? locs[locs.length - 1] : null;
  });
  const syncQueue = useSelector(state => state.sync.offlineActionQueue) || [];
  const isSyncing = useSelector(state => state.sync.isSyncing);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAdminNav, setShowAdminNav] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newKml, setNewKml] = useState('');
  const [showManualPin, setShowManualPin] = useState(false);
  const [manualCoords, setManualCoords] = useState('6.7319579, -10.8700117');

  const hasAccess = (tabId) => {
    if (currentUser?.role === 'Admin') return true;
    if (!currentUser?.allowedTabs) return true; // Default to all if admin hasn't customized
    return currentUser.allowedTabs.includes(tabId);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      dispatch(fetchInitialData());
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    dispatch(fetchInitialData());
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, [dispatch]);

  useEffect(() => {
    if (activeTab && currentUser) {
      dispatch(logAction({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        timestamp: new Date().toISOString(),
        userEmail: currentUser.email || currentUser.name || 'Unknown User',
        actionType: 'OPEN_PAGE',
        details: `Navigated to ${activeTab} tab`
      }));
    }
  }, [activeTab, currentUser, dispatch]);

  const lastSavedLocRef = React.useRef(null);
  useEffect(() => {
    lastSavedLocRef.current = lastGpsLocation;
  }, [lastGpsLocation]);

  useEffect(() => {
    if (!currentUser || !navigator.geolocation) return;

    // Haversine formula
    const getDistanceFromLatLonInM = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // Radius of the earth in m
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const lastLoc = lastSavedLocRef.current;

        let shouldSave = false;
        if (!lastLoc) {
          // Only capture the initial point if the network is available
          if (navigator.onLine) {
            shouldSave = true;
          }
        } else {
          const distance = getDistanceFromLatLonInM(latitude, longitude, Number(lastLoc.lat), Number(lastLoc.lng));
          if (distance >= Number(gpsDistanceThreshold)) {
            shouldSave = true;
          }
        }

        if (shouldSave) {
          const newLoc = {
            id: `gps_${Date.now()}`,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString(),
            userEmail: currentUser.email || currentUser.name || 'Unknown User'
          };

          dispatch(addLocation(newLoc));
          dispatch(queueAction({ type: 'gps/addLocation', payload: newLoc, meta: { id: Date.now() } }));
        }
      },
      (error) => console.warn('GPS tracking error:', error),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser, dispatch, gpsDistanceThreshold]);

  const handleAddUnit = (e) => { e.preventDefault(); if (newUnit) { dispatch(addUnit(newUnit.toLowerCase())); dispatch(saveSettings()); setNewUnit(''); } };
  const handleAddJobTitle = (e) => { e.preventDefault(); if (newJobTitle) { dispatch(addJobTitle(newJobTitle)); dispatch(saveSettings()); setNewJobTitle(''); } };
  const handleAddKml = (e) => { e.preventDefault(); if (newKml) { dispatch(addKmlUrl(newKml)); dispatch(saveSettings()); setNewKml(''); } };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        dispatch(setLogo(reader.result));
        dispatch(saveSettings());
      };
      reader.readAsDataURL(file);
    }
  };

  // Listen for PWA updates to show an overlay
  useEffect(() => {
    const handleUpdate = () => setIsUpdating(true);
    window.addEventListener('pwa-update-downloading', handleUpdate);
    return () => window.removeEventListener('pwa-update-downloading', handleUpdate);
  }, []);

  const LocationMarker = () => {
    const dispatch = useDispatch();
    useMapEvents({
      click(e) {
        dispatch(setMapCenter([e.latlng.lat, e.latlng.lng]));
        dispatch(saveSettings());
      },
      zoomend(e) {
        dispatch(setMapZoom(e.target.getZoom()));
        dispatch(saveSettings());
      }
    });
    return null;
  };

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <>
      {isUpdating && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <RefreshCw size={54} className="spin" style={{ marginBottom: '24px', color: 'var(--color-accent)' }} />
          <h2 style={{ color: 'white', marginBottom: '8px' }}>Updating Farm Tracker...</h2>
          <p style={{ color: '#ccc' }}>Downloading the latest version. The app will reload automatically.</p>
        </div>
      )}
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {logo ? (
            <img src={logo} alt="Company Logo" style={{ maxHeight: '70px', maxWidth: '185px', objectFit: 'contain' }} />
          ) : (
            <NmkLogo size={32} color="transparent" textColor="white" />
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, padding: 0 }}>NMK Farm Tracker</h1>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>Version: {CACHE_NAME}</span>
          </div>
        </div>

        <div className="header-right">
          <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="db-info" title="neo4j+s://3fa11aa8.databases.neo4j.io | User: 3fa11aa8">
              <Database size={14} style={{ flexShrink: 0 }} /> <span>neo4j+s://3fa11aa8.databases.neo4j.io | User: 3fa11aa8</span>
            </div>
            {isSyncing ? (
              <div className="status-indicator status-syncing"><RefreshCw size={16} className="spin" /> Pushing to DB...</div>
            ) : isOnline ? (
              <div className="status-indicator status-online"><Wifi size={16} /> Online</div>
            ) : (
              <div className="status-indicator status-offline">
                <WifiOff size={16} /> Offline Cache Active
                {syncQueue.length > 0 && <span style={{ marginLeft: '4px' }}>({syncQueue.length} pending writes)</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', background: '#f0f2f5', padding: '6px', borderRadius: '0', alignSelf: 'flex-end' }}>
            {currentUser?.role === 'Admin' && (
              <button onClick={() => { setShowAdminNav(false); setActiveTab(activeTab === 'sync' ? 'dashboard' : activeTab); }} className={`btn ${!showAdminNav && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ padding: '8px 12px', background: !showAdminNav && activeTab !== 'sync' ? '' : 'transparent', borderColor: !showAdminNav && activeTab !== 'sync' ? '' : 'transparent' }} title="Home View">
                <Home size={22} />
              </button>
            )}
            <button onClick={() => { setShowAdminNav(false); setActiveTab('sync'); }} className={`btn ${activeTab === 'sync' ? 'btn-primary' : ''}`} style={{ padding: '8px 12px', background: activeTab === 'sync' ? '#1565c0' : 'transparent', color: activeTab === 'sync' ? 'white' : '#1565c0', borderColor: activeTab === 'sync' ? '#1565c0' : 'transparent' }} title="System Sync">
              <RefreshCw size={22} className={isSyncing ? "spin" : ""} />
            </button>
            {currentUser?.role === 'Admin' && (
              <button onClick={() => { setShowAdminNav(true); setActiveTab('admin'); }} className={`btn ${showAdminNav ? 'btn-primary' : ''}`} style={{ padding: '8px 12px', background: showAdminNav ? '#c62828' : 'transparent', color: showAdminNav ? 'white' : '#c62828', borderColor: showAdminNav ? '#c62828' : 'transparent' }} title="Admin View">
                <Settings size={22} />
              </button>
            )}
            <button onClick={() => { if (window.confirm('Sign out and lock offline data?')) dispatch(logout()) }} className="btn" style={{ padding: '8px 12px', background: 'transparent', color: 'var(--color-primary-dark)', borderColor: 'transparent' }} title="Logout">
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-nav" style={{ display: activeTab === 'sync' ? 'none' : 'flex' }}>
        {!showAdminNav ? (
          <>
            {hasAccess('dashboard') && <button onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}><BarChart size={16} style={{ marginRight: 6 }} /> Dashboard</button>}
            {hasAccess('map') && <button onClick={() => setActiveTab('map')} className={`btn ${activeTab === 'map' ? 'btn-primary' : ''}`}><MapPin size={16} style={{ marginRight: 6 }} /> Map</button>}
            {hasAccess('livestock') && <button onClick={() => setActiveTab('livestock')} className={`btn ${activeTab === 'livestock' ? 'btn-primary' : ''}`}><Rabbit size={16} style={{ marginRight: 6 }} /> Livestock</button>}
            {hasAccess('field') && <button onClick={() => setActiveTab('field')} className={`btn ${activeTab === 'field' ? 'btn-primary' : ''}`}><Target size={16} style={{ marginRight: 6 }} /> Fields</button>}
            {hasAccess('nursery') && <button onClick={() => setActiveTab('nursery')} className={`btn ${activeTab === 'nursery' ? 'btn-primary' : ''}`}><Box size={16} style={{ marginRight: 6 }} /> Nursery</button>}
            {hasAccess('crop') && <button onClick={() => setActiveTab('crop')} className={`btn ${activeTab === 'crop' ? 'btn-primary' : ''}`}><Leaf size={16} style={{ marginRight: 6 }} /> Crops</button>}
            {hasAccess('harvest') && <button onClick={() => setActiveTab('harvest')} className={`btn ${activeTab === 'harvest' ? 'btn-primary' : ''}`}><BarChart size={16} style={{ marginRight: 6 }} /> Harvests</button>}
            {hasAccess('deadline') && <button onClick={() => setActiveTab('deadline')} className={`btn ${activeTab === 'deadline' ? 'btn-primary' : ''}`}><CalendarClock size={16} style={{ marginRight: 6 }} /> Deadlines</button>}
            {hasAccess('incident') && <button onClick={() => setActiveTab('incident')} className={`btn ${activeTab === 'incident' ? 'btn-primary' : ''}`}><AlertTriangle size={16} style={{ marginRight: 6 }} /> Incidents</button>}
            {hasAccess('assignment') && <button onClick={() => setActiveTab('assignment')} className={`btn ${activeTab === 'assignment' ? 'btn-primary' : ''}`}><Users size={16} style={{ marginRight: 6 }} /> Assignments</button>}
            {hasAccess('employee') && <button onClick={() => setActiveTab('employee')} className={`btn ${activeTab === 'employee' ? 'btn-primary' : ''}`}><Contact size={16} style={{ marginRight: 6 }} /> Employees</button>}
            {hasAccess('equipment') && <button onClick={() => setActiveTab('equipment')} className={`btn ${activeTab === 'equipment' ? 'btn-primary' : ''}`}><Briefcase size={16} style={{ marginRight: 6 }} /> Hard Assets</button>}
            {hasAccess('finance') && <button onClick={() => setActiveTab('finance')} className={`btn ${activeTab === 'finance' ? 'btn-primary' : ''}`}><DollarSign size={16} style={{ marginRight: 6 }} /> Ledger</button>}
            {hasAccess('budget') && <button onClick={() => setActiveTab('budget')} className={`btn ${activeTab === 'budget' ? 'btn-primary' : ''}`}><Calculator size={16} style={{ marginRight: 6 }} /> Budgets</button>}
          </>
        ) : (
          <>
            {currentUser?.role === 'Admin' && (
              <>
                <button onClick={() => setActiveTab('admin')} className={`btn ${activeTab === 'admin' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'admin' ? '#c62828' : 'white', color: activeTab === 'admin' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                  <ShieldAlert size={16} style={{ marginRight: 6 }} /> Admin
                </button>
                <button onClick={() => setActiveTab('access')} className={`btn ${activeTab === 'access' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'access' ? '#c62828' : 'white', color: activeTab === 'access' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                  Access Roles
                </button>
                <button onClick={() => setActiveTab('audit')} className={`btn ${activeTab === 'audit' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'audit' ? '#c62828' : 'white', color: activeTab === 'audit' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                  Audit Logs
                </button>
                <button onClick={() => setActiveTab('gps')} className={`btn ${activeTab === 'gps' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'gps' ? '#c62828' : 'white', color: activeTab === 'gps' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                  <MapPin size={16} style={{ marginRight: 6 }} /> GPS Logs
                </button>
                <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'settings' ? '#c62828' : 'white', color: activeTab === 'settings' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                  <Settings size={16} style={{ marginRight: 6 }} /> Settings
                </button>
              </>
            )}
          </>
        )}
      </nav>

      <main className="container" style={{ marginTop: '20px' }}>

        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'map' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
            <h2>GIS Field Map</h2>
            <MapLayer fields={fields} nurseries={nurseries} equipment={equipment} />
          </div>
        )}

        {/* Modular Entity CRUD Component Wrappers */}
        {activeTab === 'field' && <FieldTab />}
        {activeTab === 'nursery' && <NurseryTab />}
        {activeTab === 'crop' && <CropTab />}
        {/* {activeTab === 'activity' && <ActivityTab />} */}
        {activeTab === 'deadline' && <DeadlineTab />}
        {activeTab === 'incident' && <IncidentTab />}
        {activeTab === 'harvest' && <HarvestTab />}
        {activeTab === 'livestock' && <LivestockTab />}
        {activeTab === 'employee' && <EmployeeTab />}
        {activeTab === 'equipment' && <EquipmentTab />}
        {activeTab === 'assignment' && <AssignmentTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'sync' && <SyncTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'admin' && <AdminTab />}
        {activeTab === 'access' && <AccessControlTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'gps' && <GpsLogTab />}

        {activeTab === 'settings' && currentUser?.role === 'Admin' && (
          <div className="card">
            <h2>App Settings</h2>
            <div style={{ marginBottom: 20 }}>
              <h3>Company Logo</h3>
              <div style={{ marginBottom: 16 }}>
                {logo && (
                  <div style={{ marginBottom: 10 }}>
                    <img src={logo} alt="Current Logo" style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                    <br />
                    <button onClick={() => { dispatch(setLogo(null)); dispatch(saveSettings()); }} className="btn" style={{ marginTop: 8, background: '#ffebee', color: '#c62828', padding: '4px 8px' }}>Remove Logo</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="btn" style={{ padding: '6px' }} />
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />
            <div style={{ marginBottom: 20 }}>
              <h3>Measurement Unites</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                {units.map(u => (
                  <span key={u} className="status-indicator" style={{ background: '#e0e0e0', color: '#333' }}>
                    {u} <button onClick={() => { dispatch(removeUnit(u)); dispatch(saveSettings()); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4 }}>x</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g. pallets, boxes" style={{ flex: 1, minWidth: '200px', padding: '8px' }} onKeyDown={e => { if(e.key === 'Enter') handleAddUnit(e) }} />
                <button onClick={handleAddUnit} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Add Unit</button>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />
            <div style={{ marginBottom: 20 }}>
              <h3>Job Titles</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                {jobTitles.map(t => (
                  <span key={t} className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    {t} <button onClick={() => { dispatch(removeJobTitle(t)); dispatch(saveSettings()); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4, color: '#1565c0' }}>x</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                <input type="text" value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} placeholder="e.g. Foreman, Agronomist" style={{ flex: 1, minWidth: '200px', padding: '8px' }} onKeyDown={e => { if(e.key === 'Enter') handleAddJobTitle(e) }} />
                <button onClick={handleAddJobTitle} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Add Job Title</button>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />
            <div style={{ marginBottom: 20 }}>
              <h3>Map Preferences</h3>
              <div style={{ marginBottom: 16 }}>
                <label>GPS Distance Threshold (meters)</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={gpsDistanceThreshold}
                  onChange={(e) => { dispatch(setGpsDistanceThreshold(Number(e.target.value))); dispatch(saveSettings()); }}
                  className="btn"
                  style={{ display: 'block', marginTop: 8, padding: '8px', minWidth: '200px', cursor: 'text' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Controls how many meters you must move before a new breadcrumb is captured.</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>Polygon Draw Color</label>
                <input type="color" value={polygonColor} onChange={(e) => { dispatch(setPolygonColor(e.target.value)); dispatch(saveSettings()); }} style={{ display: 'block', marginTop: 8 }} />
              </div>
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                  <label style={{ margin: 0, fontWeight: 'bold' }}>Default Map Tab Location</label>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>Search below, Drop Pin by clicking on map, Zoom to save default zoom, or enter exact coordinates.</span>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      value={manualCoords}
                      onChange={(e) => setManualCoords(e.target.value)}
                      placeholder="e.g. 6.7319579, -10.8700117"
                      style={{ flex: 1, minWidth: '200px', padding: '8px' }}
                    />
                    <button
                      onClick={() => {
                        const parts = manualCoords.split(',');
                        if (parts.length === 2) {
                          const lat = parseFloat(parts[0].trim());
                          const lng = parseFloat(parts[1].trim());
                          if (!isNaN(lat) && !isNaN(lng)) {
                            dispatch(setMapCenter([lat, lng]));
                            dispatch(saveSettings());
                          } else {
                            alert("Invalid coordinates. Please enter Lat, Lng.");
                          }
                        } else {
                          alert("Invalid format. Please enter as: Latitude, Longitude");
                        }
                      }}
                      className="btn btn-primary"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Drop Pin
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <MapSearchBox onLocationFound={(loc) => { dispatch(setMapCenter(loc)); dispatch(saveSettings()); }} />
                </div>
                <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: 8 }}>
                  <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer attribution="Google Maps" url="http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" />
                    <MapFlyTo center={mapCenter} />
                    <LocationMarker />
                    <CurrentLocationControl onLocationFound={(loc) => { dispatch(setMapCenter(loc)); dispatch(saveSettings()); }} />
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
