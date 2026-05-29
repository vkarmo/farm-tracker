import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchFields } from './store/fieldsSlice';
import { addUnit, removeUnit, addJobTitle, removeJobTitle, addExpenseCategory, removeExpenseCategory, addIncomeCategory, removeIncomeCategory, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold, setAppName, addAnimalType, removeAnimalType, saveSettings, setGeeClientEmail, setGeePrivateKey, setGeeProjectId, setGeeScale, setOwmApiKey } from './store/settingsSlice';
import { addLocation } from './store/gpsSlice';
import { queueAction, fetchInitialData } from './store/syncSlice';
import { MapSearchBox, MapFlyTo, FarmLocationButton } from './components/MapSearchBox';
import { MapContainer, TileLayer, Marker, useMapEvents, Polygon, useMap } from 'react-leaflet';
import FieldImageryOverlay from './components/FieldImageryOverlay';
import { MapResizer } from './components/ResizableMapWrapper';

function SettingsMapBoundsFitter({ polygon }) {
  const map = useMap();
  React.useEffect(() => {
    if (!polygon) return;
    let flatPoints = polygon;
    if (Array.isArray(polygon) && polygon.length > 0 && Array.isArray(polygon[0]) && Array.isArray(polygon[0][0])) {
      flatPoints = polygon[0];
    }
    if (Array.isArray(flatPoints) && flatPoints.length >= 3) {
      map.fitBounds(flatPoints);
    }
  }, [map, polygon]);
  return null;
}
import 'leaflet/dist/leaflet.css';
import { CACHE_NAME } from './config/cache';
import packageJson from '../package.json';

import { Wifi, WifiOff, CloudOff, Target, Tractor, Leaf, DollarSign, MapPin, Rabbit, Settings, BarChart, Layers, Box, ClipboardList, ShieldAlert, Calculator, CalendarClock, AlertTriangle, LogOut, Database, Users, Contact, Briefcase, RefreshCw, Home, Baby, FlaskConical, Map, Check, ChevronDown, ChevronRight } from 'lucide-react';
import NmkLogo from './components/NmkLogo';
import MapLayer from './MapLayer';

// Modular Tabs
import FieldTab from './components/FieldTab';
import NurseryTab from './components/NurseryTab';
import CropTab from './components/CropTab';
import SoilTestingTab from './components/SoilTestingTab';
import HarvestTab from './components/HarvestTab';
import LivestockTab from './components/LivestockTab';
import KitsTab from './components/KitsTab';
import BreedingTab from './components/BreedingTab';
import LivestockDiseaseTab from './components/LivestockDiseaseTab';
import PestTab from './components/PestTab';
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
import PlanningTab from './components/PlanningTab';
import EmployeeTab from './components/EmployeeTab';
import EquipmentTab from './components/EquipmentTab';
import PoiTab from './components/PoiTab';
import SyncTab from './components/SyncTab';
import AuditTab from './components/AuditTab';
import GpsLogTab from './components/GpsLogTab';
import { logout, stopImpersonating } from './store/authSlice';
import { logAction } from './store/auditSlice';

const MODULES = {
  overview: ['dashboard', 'map'],
  agronomy: ['field', 'nursery', 'crop', 'soilTests', 'harvest', 'pest'],
  livestock: ['livestock', 'breeding', 'kits', 'livestockDiseases'],
  finance: ['finance', 'budget'],
  operations: ['employee', 'assignment', 'planning', 'equipment', 'deadline', 'incident'],
  admin: ['admin', 'access', 'audit', 'gps', 'settings']
};

export default function App() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const originalAdmin = useSelector(state => state.auth?.originalAdmin);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const equipment = useSelector(state => state.assets?.equipment) || [];
  const units = useSelector(state => state.settings?.units) || ['lbs'];
  const jobTitles = useSelector(state => state.settings?.jobTitles) || [];
  const animalTypes = useSelector(state => state.settings?.animalTypes) || [];
  const expenseCategories = useSelector(state => state.settings?.expenseCategories) || ['Equipment Maintenance', 'Fertilizer', 'Fuel', 'Labor', 'Seed'];
  const incomeCategories = useSelector(state => state.settings?.incomeCategories) || ['Crop Sale', 'Livestock Sale', 'Subsidy'];
  const kmlUrls = useSelector(state => state.settings?.kmlUrls) || [];
  const appName = useSelector(state => state.settings?.appName);
  const displayAppName = appName || packageJson.name;
  const logo = useSelector(state => state.settings?.logo);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const gpsDistanceThreshold = useSelector(state => state.settings?.gpsDistanceThreshold) || 10;
  const geeClientEmail = useSelector(state => state.settings?.geeClientEmail) || '';
  const geePrivateKey = useSelector(state => state.settings?.geePrivateKey) || '';
  const geeProjectId = useSelector(state => state.settings?.geeProjectId) || '';
  const geeScale = useSelector(state => state.settings?.geeScale) || 3;
  const owmApiKey = useSelector(state => state.settings?.owmApiKey) || '';
  const lastGpsLocation = useSelector(state => {
    const locs = state.gps?.locations || [];
    return locs.length > 0 ? locs[locs.length - 1] : null;
  });
  const syncQueue = useSelector(state => state.sync.offlineActionQueue) || [];
  const isSyncing = useSelector(state => state.sync.isSyncing);
  const backendAvailable = useSelector(state => state.sync.backendAvailable);

  const totalActionsQueued = useSelector(state => state.sync.totalActionsQueued || 0);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [openSettings, setOpenSettings] = useState({ general: true, dropdown: false, map: false, units: false, jobs: false, animals: false, ledgers: false, gee: false, owm: false });
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Record Saved Successfully");

  const prevTotalQueued = useRef(totalActionsQueued);

  const [geeTesting, setGeeTesting] = useState(false);
  const [geeTestStatus, setGeeTestStatus] = useState(null);
  const [testFieldId, setTestFieldId] = useState('');
  const [testIndexType, setTestIndexType] = useState('CurrentSatellite');
  const [testGeeStatus, setTestGeeStatus] = useState({});

  useEffect(() => {
    const handler = (e) => {
      const { fieldId, status, error } = e.detail;
      setTestGeeStatus(prev => ({ ...prev, [fieldId]: { status, error } }));
    };
    window.addEventListener('gee-status-change', handler);
    return () => window.removeEventListener('gee-status-change', handler);
  }, []);

  const handleTestGeeConnection = async () => {
    setGeeTesting(true);
    setGeeTestStatus(null);
    try {
      // Find selected test field if any and extract polygon boundaries
      const selectedField = fields.find(f => f.id === testFieldId);
      let testPolygon = null;
      if (selectedField && selectedField.polygon) {
        try {
          testPolygon = typeof selectedField.polygon === 'string'
            ? JSON.parse(selectedField.polygon)
            : selectedField.polygon;
        } catch (e) {
          console.error('Failed to parse selected test field polygon', e);
        }
      }

      const response = await fetch('/api/gee/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_email: geeClientEmail,
          private_key: geePrivateKey,
          project_id: geeProjectId,
          polygon: testPolygon
        })
      });
      const data = await response.json();
      setGeeTestStatus(data);
    } catch (err) {
      setGeeTestStatus({ success: false, error: err.message || 'Connection test request failed.' });
    } finally {
      setGeeTesting(false);
    }
  };

  // Global visual indicator for successful saves
  useEffect(() => {
    if (totalActionsQueued > prevTotalQueued.current) {
      document.body.classList.add('is-saving');

      const timer1 = setTimeout(() => {
        document.body.classList.remove('is-saving');
        document.body.classList.add('is-saved');
        setToastMessage("Record Saved Successfully");
        setShowSaveToast(true);
      }, 400); // Simulate network delay slightly

      const timer2 = setTimeout(() => {
        document.body.classList.remove('is-saved');
        setShowSaveToast(false);
      }, 2000);

      prevTotalQueued.current = totalActionsQueued;

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        document.body.classList.remove('is-saving', 'is-saved');
      };
    }
  }, [totalActionsQueued]);

  useEffect(() => {
    const handleShowToast = (e) => {
      setToastMessage(e.detail || "Action Completed");
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    };
    window.addEventListener('show-toast', handleShowToast);
    return () => window.removeEventListener('show-toast', handleShowToast);
  }, []);
  const [activeModule, setActiveModule] = useState('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  const [newUnit, setNewUnit] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newAnimalType, setNewAnimalType] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newKml, setNewKml] = useState('');
  const [showManualPin, setShowManualPin] = useState(false);
  const [manualCoords, setManualCoords] = useState('');

  useEffect(() => {
    if (mapCenter && mapCenter.length >= 2) {
      setManualCoords(`${mapCenter[0]}, ${mapCenter[1]}`);
    }
  }, [mapCenter]);

  const [localGpsThreshold, setLocalGpsThreshold] = useState(gpsDistanceThreshold ? gpsDistanceThreshold.toString() : '10');
  const [activeLedgerCategoryView, setActiveLedgerCategoryView] = useState('expense');
  const [showGpsPrompt, setShowGpsPrompt] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);

  useEffect(() => {
    if (currentUser && navigator.geolocation) {
      const hasPrompted = localStorage.getItem('gpsPrompted');
      if (!hasPrompted) {
        setShowGpsPrompt(true);
      } else {
        setGpsActive(true);
      }
    }
  }, [currentUser]);

  const handleEnableGps = () => {
    localStorage.setItem('gpsPrompted', 'true');
    setShowGpsPrompt(false);
    setGpsActive(true);
  };

  useEffect(() => {
    setLocalGpsThreshold(gpsDistanceThreshold ? gpsDistanceThreshold.toString() : '10');
  }, [gpsDistanceThreshold]);

  const hasAccess = (tabId) => {
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') return true;
    if (currentUser?.role === 'Viewer' && tabId === 'budget') {
      if (!currentUser?.allowedTabs) return false;
    }
    if (!currentUser?.allowedTabs) return true; // Default to all if admin hasn't customized
    return currentUser.allowedTabs.includes(tabId);
  };

  const hasModuleAccess = (moduleId) => {
    if (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') return true;
    const tabs = MODULES[moduleId] || [];
    return tabs.some(tab => hasAccess(tab));
  };

  const handleModuleSwitch = (moduleId) => {
    setActiveModule(moduleId);
    const firstAccessibleTab = MODULES[moduleId].find(tab => hasAccess(tab));
    if (firstAccessibleTab) {
      setActiveTab(firstAccessibleTab);
    }
  };

  useEffect(() => {
    document.title = displayAppName;
  }, [displayAppName]);

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
  const wakeLockRef = React.useRef(null);

  useEffect(() => {
    lastSavedLocRef.current = lastGpsLocation;
  }, [lastGpsLocation]);

  // Request Wake Lock to prevent screen sleep while tracking GPS
  useEffect(() => {
    if (!gpsActive || !('wakeLock' in navigator)) return;

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock error:', err.name, err.message);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gpsActive) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().catch(() => { });
        wakeLockRef.current = null;
      }
    };
  }, [gpsActive]);

  useEffect(() => {
    if (!currentUser || !navigator.geolocation || !gpsActive) return;

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

    const processGpsPosition = (position) => {
      const { latitude, longitude, altitude, accuracy } = position.coords;

      // Filter out low accuracy points (e.g. > 30 meters) to avoid GPS drifting/jumping
      if (accuracy !== undefined && accuracy !== null && accuracy > 30) {
        console.warn(`GPS tracking point skipped due to low accuracy: ${accuracy.toFixed(1)}m (threshold is 30m)`);
        return;
      }

      const lastLoc = lastSavedLocRef.current;

      let shouldSave = false;
      if (!lastLoc) {
        // Only capture the initial point if the network is available
        if (navigator.onLine) {
          shouldSave = true;
        }
      } else {
        const distance = getDistanceFromLatLonInM(latitude, longitude, Number(lastLoc.lat), Number(lastLoc.lng));
        const timeSinceLastSave = Date.now() - new Date(lastLoc.timestamp).getTime();

        // Save if moved beyond threshold OR if 2 minutes have passed (stationary heartbeat)
        if (distance >= Number(gpsDistanceThreshold) || timeSinceLastSave >= 2 * 60 * 1000) {
          shouldSave = true;
        }
      }

      if (shouldSave) {
        const newLoc = {
          id: `gps_${Date.now()}`,
          lat: latitude,
          lng: longitude,
          altitude: altitude || null,
          timestamp: new Date().toISOString(),
          userEmail: currentUser.email || currentUser.name || 'Unknown User'
        };

        dispatch(addLocation(newLoc));
        dispatch(queueAction({ type: 'gps/addLocation', payload: newLoc, meta: { id: Date.now() } }));
        lastSavedLocRef.current = newLoc; // Immediately update local ref to prevent rapid-fire saves
      }
    };

    // 1. Listen for active movements
    const watchId = navigator.geolocation.watchPosition(
      processGpsPosition,
      (error) => console.warn('GPS tracking error:', error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );

    // 2. Poll explicitly every 2 minutes for stationary heartbeats
    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        processGpsPosition,
        (error) => console.warn('GPS heartbeat error:', error),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
      );
    }, 2 * 60 * 1000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(intervalId);
    };
  }, [currentUser, dispatch, gpsDistanceThreshold, gpsActive]);

  const handleAddUnit = (e) => { e.preventDefault(); if (newUnit) { dispatch(addUnit(newUnit.toLowerCase())); dispatch(saveSettings()); setNewUnit(''); } };
  const handleAddJobTitle = (e) => {
    e.preventDefault();
    if (newJobTitle.trim()) {
      dispatch(addJobTitle(newJobTitle.trim()));
      dispatch(saveSettings());
      setNewJobTitle('');
    }
  };

  const handleAddAnimalType = (e) => {
    e.preventDefault();
    if (newAnimalType.trim()) {
      dispatch(addAnimalType(newAnimalType.trim()));
      dispatch(saveSettings());
      setNewAnimalType('');
    }
  };

  const handleAddExpenseCategory = (e) => {
    e.preventDefault();
    if (newExpenseCategory.trim()) {
      dispatch(addExpenseCategory(newExpenseCategory.trim()));
      dispatch(saveSettings());
      setNewExpenseCategory('');
    }
  };

  const handleAddIncomeCategory = (e) => {
    e.preventDefault();
    if (newIncomeCategory.trim()) {
      dispatch(addIncomeCategory(newIncomeCategory.trim()));
      dispatch(saveSettings());
      setNewIncomeCategory('');
    }
  };
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
    const isInitialMount = React.useRef(true);

    useEffect(() => {
      const timer = setTimeout(() => { isInitialMount.current = false; }, 800);
      return () => clearTimeout(timer);
    }, []);

    useMapEvents({
      click(e) {
        if (currentUser?.role === 'Admin Viewer') return;
        dispatch(setMapCenter([e.latlng.lat, e.latlng.lng]));
        dispatch(saveSettings());
      },
      zoomend(e) {
        if (currentUser?.role === 'Admin Viewer') return;
        dispatch(setMapZoom(e.target.getZoom()));
        if (!isInitialMount.current) {
          dispatch(saveSettings());
        }
      }
    });
    return null;
  };

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <>
      {originalAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'linear-gradient(90deg, #1565c0, #f57c00)',
          color: 'white',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span role="img" aria-label="simulation">👀</span>
            <span>Simulation Mode: Viewing as <strong>{currentUser.name || currentUser.email}</strong> ({currentUser.role})</span>
          </div>
          <button 
            type="button"
            onClick={() => dispatch(stopImpersonating())}
            className="btn"
            style={{
              background: 'white',
              color: '#d32f2f',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.8rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            Exit Simulation
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', marginTop: originalAdmin ? '40px' : '0' }}>
        {showGpsPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: '20px', textAlign: 'center' }}>
          <MapPin size={64} style={{ marginBottom: '24px', color: '#4caf50' }} />
          <h2 style={{ color: 'white', marginBottom: '16px' }}>Enable Mapping Features</h2>
          <p style={{ color: '#ccc', marginBottom: '30px', maxWidth: '400px', lineHeight: '1.6' }}>
            Mapping features are needed to mark fields and nurseries, determine peaks and valleys, and track assets. Please click below to grant permission when prompted.
          </p>
          <button onClick={handleEnableGps} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1.1rem', background: '#2e7d32', border: 'none' }}>
            Grant Permission
          </button>
        </div>
      )}
      {isUpdating && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <RefreshCw size={54} className="spin" style={{ marginBottom: '24px', color: 'var(--color-accent)' }} />
          <h2 style={{ color: 'white', marginBottom: '8px' }}>Updating {displayAppName}...</h2>
          <p style={{ color: '#ccc', maxWidth: '280px', textAlign: 'center', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>Downloading the latest version.<br />The app will reload automatically.</p>
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
            <h1 style={{ margin: 0, padding: 0 }}>{displayAppName}</h1>
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
            ) : !isOnline ? (
              <div className="status-indicator status-offline">
                <WifiOff size={16} /> Offline Cache Active
                {syncQueue.length > 0 && <span style={{ marginLeft: '4px' }}>({syncQueue.length} pending writes)</span>}
              </div>
            ) : !backendAvailable ? (
              <div className="status-indicator status-offline" style={{ background: '#ffebee', color: '#c62828' }}>
                <WifiOff size={16} /> DB Unreachable
                {syncQueue.length > 0 && <span style={{ marginLeft: '4px' }}>({syncQueue.length} pending writes)</span>}
              </div>
            ) : (
              <div className="status-indicator status-online"><Wifi size={16} /> Online</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '2px', background: '#f0f2f5', padding: '4px', borderRadius: '0', alignSelf: 'flex-end', flexWrap: 'nowrap', justifyContent: 'flex-end', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
            {hasModuleAccess('overview') && (
              <button onClick={() => handleModuleSwitch('overview')} className={`btn toolbar-btn ${activeModule === 'overview' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'overview' && activeTab !== 'sync' ? '#2e7d32' : 'transparent', color: activeModule === 'overview' && activeTab !== 'sync' ? 'white' : '#555', borderColor: 'transparent' }} title="Overview Module">
                <Home size={18} />
              </button>
            )}
            {hasModuleAccess('agronomy') && (
              <button onClick={() => handleModuleSwitch('agronomy')} className={`btn toolbar-btn ${activeModule === 'agronomy' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'agronomy' && activeTab !== 'sync' ? '#2e7d32' : 'transparent', color: activeModule === 'agronomy' && activeTab !== 'sync' ? 'white' : '#555', borderColor: 'transparent' }} title="Agronomy Module">
                <Leaf size={18} />
              </button>
            )}
            {hasModuleAccess('livestock') && (
              <button onClick={() => handleModuleSwitch('livestock')} className={`btn toolbar-btn ${activeModule === 'livestock' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'livestock' && activeTab !== 'sync' ? '#2e7d32' : 'transparent', color: activeModule === 'livestock' && activeTab !== 'sync' ? 'white' : '#555', borderColor: 'transparent' }} title="Livestock Module">
                <Rabbit size={18} />
              </button>
            )}
            {hasModuleAccess('finance') && (
              <button onClick={() => handleModuleSwitch('finance')} className={`btn toolbar-btn ${activeModule === 'finance' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'finance' && activeTab !== 'sync' ? '#2e7d32' : 'transparent', color: activeModule === 'finance' && activeTab !== 'sync' ? 'white' : '#555', borderColor: 'transparent' }} title="Financials Module">
                <DollarSign size={18} />
              </button>
            )}
            {hasModuleAccess('operations') && (
              <button onClick={() => handleModuleSwitch('operations')} className={`btn toolbar-btn ${activeModule === 'operations' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'operations' && activeTab !== 'sync' ? '#2e7d32' : 'transparent', color: activeModule === 'operations' && activeTab !== 'sync' ? 'white' : '#555', borderColor: 'transparent' }} title="Operations Module">
                <Users size={18} />
              </button>
            )}

            <div style={{ width: '1px', background: '#ccc', margin: '4px 2px', flexShrink: 0 }}></div>

            <button onClick={() => setActiveTab('sync')} className={`btn toolbar-btn ${activeTab === 'sync' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'sync' ? (!backendAvailable ? '#d32f2f' : '#1565c0') : 'transparent', color: activeTab === 'sync' ? 'white' : (!backendAvailable ? '#d32f2f' : '#1565c0'), borderColor: 'transparent' }} title="System Sync">
              <RefreshCw size={18} className={isSyncing ? "spin" : ""} />
            </button>

            {(currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') && (
              <button onClick={() => handleModuleSwitch('admin')} className={`btn toolbar-btn ${activeModule === 'admin' && activeTab !== 'sync' ? 'btn-primary' : ''}`} style={{ background: activeModule === 'admin' && activeTab !== 'sync' ? '#c62828' : 'transparent', color: activeModule === 'admin' && activeTab !== 'sync' ? 'white' : '#c62828', borderColor: 'transparent' }} title="Admin Module">
                <Settings size={18} />
              </button>
            )}

            <button onClick={() => { if (window.confirm('Sign out and lock offline data?')) dispatch(logout()) }} className="btn toolbar-btn" style={{ background: 'transparent', color: 'var(--color-primary-dark)', borderColor: 'transparent' }} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-nav" style={{ display: activeTab === 'sync' ? 'none' : 'flex' }}>
        {activeModule === 'overview' && (
          <>
            {hasAccess('dashboard') && <button onClick={() => setActiveTab('dashboard')} className={`btn ${activeTab === 'dashboard' ? 'tab-btn-active' : ''}`}><BarChart size={16} style={{ marginRight: 6 }} /> Dashboard</button>}
            {hasAccess('map') && <button onClick={() => setActiveTab('map')} className={`btn ${activeTab === 'map' ? 'tab-btn-active' : ''}`}><MapPin size={16} style={{ marginRight: 6 }} /> Map</button>}
            {hasAccess('poi') && <button onClick={() => setActiveTab('poi')} className={`btn ${activeTab === 'poi' ? 'tab-btn-active' : ''}`}><MapPin size={16} style={{ marginRight: 6 }} /> Points of Interest</button>}
          </>
        )}
        {activeModule === 'agronomy' && (
          <>
            {hasAccess('field') && <button onClick={() => setActiveTab('field')} className={`btn ${activeTab === 'field' ? 'tab-btn-active' : ''}`}><Map size={16} style={{ marginRight: 6 }} /> Fields</button>}
            {hasAccess('nursery') && <button onClick={() => setActiveTab('nursery')} className={`btn ${activeTab === 'nursery' ? 'tab-btn-active' : ''}`}><Box size={16} style={{ marginRight: 6 }} /> Nursery</button>}
            {hasAccess('crop') && <button onClick={() => setActiveTab('crop')} className={`btn ${activeTab === 'crop' ? 'tab-btn-active' : ''}`}><Leaf size={16} style={{ marginRight: 6 }} /> Crops</button>}
            {hasAccess('soilTests') && <button onClick={() => setActiveTab('soilTests')} className={`btn ${activeTab === 'soilTests' ? 'tab-btn-active' : ''}`}><FlaskConical size={16} style={{ marginRight: 6 }} /> Soil Tests</button>}
            {hasAccess('harvest') && <button onClick={() => setActiveTab('harvest')} className={`btn ${activeTab === 'harvest' ? 'tab-btn-active' : ''}`}><BarChart size={16} style={{ marginRight: 6 }} /> Harvests</button>}
            {hasAccess('pest') && <button onClick={() => setActiveTab('pest')} className={`btn ${activeTab === 'pest' ? 'tab-btn-active' : ''}`}><AlertTriangle size={16} style={{ marginRight: 6 }} /> Pests</button>}
          </>
        )}
        {activeModule === 'livestock' && (
          <>
            {hasAccess('livestock') && <button onClick={() => setActiveTab('livestock')} className={`btn ${activeTab === 'livestock' ? 'tab-btn-active' : ''}`}><Rabbit size={16} style={{ marginRight: 6 }} /> Livestock</button>}
            {hasAccess('breeding') && <button onClick={() => setActiveTab('breeding')} className={`btn ${activeTab === 'breeding' ? 'tab-btn-active' : ''}`}><Baby size={16} style={{ marginRight: 6 }} /> Breeding</button>}
            {hasAccess('kits') && <button onClick={() => setActiveTab('kits')} className={`btn ${activeTab === 'kits' ? 'tab-btn-active' : ''}`}><Layers size={16} style={{ marginRight: 6 }} /> Kits</button>}
            {hasAccess('livestockDiseases') && <button onClick={() => setActiveTab('livestockDiseases')} className={`btn ${activeTab === 'livestockDiseases' ? 'tab-btn-active' : ''}`}><AlertTriangle size={16} style={{ marginRight: 6 }} /> Diseases</button>}
          </>
        )}
        {activeModule === 'finance' && (
          <>
            {hasAccess('finance') && <button onClick={() => setActiveTab('finance')} className={`btn ${activeTab === 'finance' ? 'tab-btn-active' : ''}`}><DollarSign size={16} style={{ marginRight: 6 }} /> Ledger</button>}
            {hasAccess('budget') && <button onClick={() => setActiveTab('budget')} className={`btn ${activeTab === 'budget' ? 'tab-btn-active' : ''}`}><Calculator size={16} style={{ marginRight: 6 }} /> Budgets</button>}
          </>
        )}
        {activeModule === 'operations' && (
          <>
            {hasAccess('employee') && <button onClick={() => setActiveTab('employee')} className={`btn ${activeTab === 'employee' ? 'tab-btn-active' : ''}`}><Contact size={16} style={{ marginRight: 6 }} /> Employees</button>}
            {hasAccess('assignment') && <button onClick={() => setActiveTab('assignment')} className={`btn ${activeTab === 'assignment' ? 'tab-btn-active' : ''}`}><Users size={16} style={{ marginRight: 6 }} /> Assignments</button>}
            {hasAccess('planning') && <button onClick={() => setActiveTab('planning')} className={`btn ${activeTab === 'planning' ? 'tab-btn-active' : ''}`}><Target size={16} style={{ marginRight: 6 }} /> Planning</button>}
            {hasAccess('equipment') && <button onClick={() => setActiveTab('equipment')} className={`btn ${activeTab === 'equipment' ? 'tab-btn-active' : ''}`}><Briefcase size={16} style={{ marginRight: 6 }} /> Hard Assets</button>}
            {hasAccess('deadline') && <button onClick={() => setActiveTab('deadline')} className={`btn ${activeTab === 'deadline' ? 'tab-btn-active' : ''}`}><CalendarClock size={16} style={{ marginRight: 6 }} /> Deadlines</button>}
            {hasAccess('incident') && <button onClick={() => setActiveTab('incident')} className={`btn ${activeTab === 'incident' ? 'tab-btn-active' : ''}`}><AlertTriangle size={16} style={{ marginRight: 6 }} /> Incidents</button>}
          </>
        )}
        {activeModule === 'admin' && (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') && (
          <>
            <button onClick={() => setActiveTab('admin')} className={`btn ${activeTab === 'admin' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'admin' ? '#c62828' : 'white', color: activeTab === 'admin' ? 'white' : '#c62828', borderColor: '#c62828' }}>
              <ShieldAlert size={16} style={{ marginRight: 6 }} /> Admin
            </button>
            <button onClick={() => setActiveTab('access')} className={`btn ${activeTab === 'access' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'access' ? '#c62828' : 'white', color: activeTab === 'access' ? 'white' : '#c62828', borderColor: '#c62828' }}>
              Access Roles
            </button>
            <button onClick={() => setActiveTab('audit')} className={`btn ${activeTab === 'audit' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'audit' ? '#c62828' : 'white', color: activeTab === 'audit' ? 'white' : '#c62828', borderColor: '#c62828' }}>
              Audit Logs
            </button>
            <button onClick={() => setActiveTab('gps')} className={`btn ${activeTab === 'gps' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'gps' ? '#c62828' : 'white', color: activeTab === 'gps' ? 'white' : '#c62828', borderColor: '#c62828' }}>
              <MapPin size={16} style={{ marginRight: 6 }} /> GPS Logs
            </button>
            <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'settings' ? '#c62828' : 'white', color: activeTab === 'settings' ? 'white' : '#c62828', borderColor: '#c62828' }}>
              <Settings size={16} style={{ marginRight: 6 }} /> Settings
            </button>
          </>
        )}
      </nav>

      <main className={`container ${['map', 'field', 'nursery', 'soilTests', 'equipment', 'gps', 'poi'].includes(activeTab) ? 'container-wide' : ''} ${currentUser?.role === 'Viewer' || currentUser?.role === 'Admin Viewer' ? 'role-viewer' : ''}`} style={{ marginTop: '20px' }}>

        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'map' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
            <h2>Farm Overview Map</h2>
            <MapLayer fields={fields} nurseries={nurseries} equipment={equipment} />
          </div>
        )}
        {activeTab === 'poi' && <PoiTab />}

        {/* Modular Entity CRUD Component Wrappers */}
        {activeTab === 'field' && <FieldTab />}
        {activeTab === 'nursery' && <NurseryTab />}
        {activeTab === 'crop' && <CropTab />}
        {activeTab === 'soilTests' && <SoilTestingTab />}
        {activeTab === 'pest' && <PestTab />}
        {/* {activeTab === 'activity' && <ActivityTab />} */}
        {activeTab === 'deadline' && <DeadlineTab />}
        {activeTab === 'incident' && <IncidentTab />}
        {activeTab === 'harvest' && <HarvestTab />}
        {activeTab === 'livestock' && <LivestockTab />}
        {activeTab === 'kits' && <KitsTab />}
        {activeTab === 'breeding' && <BreedingTab />}
        {activeTab === 'livestockDiseases' && <LivestockDiseaseTab />}
        {activeTab === 'employee' && <EmployeeTab />}
        {activeTab === 'equipment' && <EquipmentTab />}
        {activeTab === 'assignment' && <AssignmentTab />}
        {activeTab === 'planning' && <PlanningTab />}
        {activeTab === 'finance' && <FinanceTab />}
        {activeTab === 'sync' && <SyncTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'admin' && <AdminTab />}
        {activeTab === 'access' && <AccessControlTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'gps' && <GpsLogTab />}

        {activeTab === 'settings' && (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') && (
          <div className="card">
            <h2>App Settings</h2>

            {/* General Card */}
            <div style={{ marginBottom: 15, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenSettings({ ...openSettings, general: !openSettings.general })}
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
              >
                General Settings
                {openSettings.general ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {openSettings.general && (
                <div style={{ padding: '20px', background: 'white' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>App Identity</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label>App Name</label>
                      <input
                        type="text"
                        value={appName || ''}
                        onChange={(e) => { dispatch(setAppName(e.target.value)); dispatch(saveSettings()); }}
                        placeholder={packageJson.name}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', minWidth: '200px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#666', display: 'block', marginTop: 4 }}>Custom name for your application instance. Leave blank to use default.</span>
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Company Logo</h3>
                    <div style={{ marginBottom: 16 }}>
                      {logo && (
                        <div style={{ marginBottom: 10 }}>
                          <img src={logo} alt="Current Logo" style={{ maxHeight: '60px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                          <br />
                          <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(setLogo(null)); dispatch(saveSettings()); } }} className="btn" style={{ marginTop: 8, background: '#ffebee', color: '#c62828', padding: '4px 8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Remove Logo</button>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="btn" style={{ padding: '6px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dropdown Data Card */}
            <div style={{ marginBottom: 15, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenSettings({ ...openSettings, dropdown: !openSettings.dropdown })}
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
              >
                Dropdown Data
                {openSettings.dropdown ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {openSettings.dropdown && (
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                  {/* Units Toggle */}
                  <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenSettings({ ...openSettings, units: !openSettings.units })}
                      style={{ width: '100%', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Measurement Units
                      {openSettings.units ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {openSettings.units && (
                      <div style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                          {units.map(u => (
                            <span key={u} className="status-indicator" style={{ background: '#e0e0e0', color: '#333' }}>
                              {u} <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(removeUnit(u)); dispatch(saveSettings()); } }} style={{ border: 'none', background: 'transparent', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', marginLeft: 4 }} disabled={currentUser?.role === 'Admin Viewer'}>x</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                          <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g. pallets, boxes" style={{ flex: 1, minWidth: '200px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }} onKeyDown={e => { if (e.key === 'Enter') handleAddUnit(e) }} disabled={currentUser?.role === 'Admin Viewer'} />
                          <button onClick={handleAddUnit} className="btn btn-primary" style={{ whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Add Unit</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Job Titles Toggle */}
                  <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenSettings({ ...openSettings, jobs: !openSettings.jobs })}
                      style={{ width: '100%', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Job Titles
                      {openSettings.jobs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {openSettings.jobs && (
                      <div style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                          {jobTitles.map(t => (
                            <span key={t} className="status-indicator" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                              {t} <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(removeJobTitle(t)); dispatch(saveSettings()); } }} style={{ border: 'none', background: 'transparent', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', marginLeft: 4, color: '#1565c0' }} disabled={currentUser?.role === 'Admin Viewer'}>x</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                          <input type="text" value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} placeholder="e.g. Foreman, Agronomist" style={{ flex: 1, minWidth: '200px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }} onKeyDown={e => { if (e.key === 'Enter') handleAddJobTitle(e) }} disabled={currentUser?.role === 'Admin Viewer'} />
                          <button onClick={handleAddJobTitle} className="btn btn-primary" style={{ whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Add Job Title</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Animal Types Toggle */}
                  <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenSettings({ ...openSettings, animals: !openSettings.animals })}
                      style={{ width: '100%', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Livestock Animal Types
                      {openSettings.animals ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {openSettings.animals && (
                      <div style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                          {animalTypes.map(t => (
                            <span key={t} className="status-indicator" style={{ background: '#f3e5f5', color: '#6a1b9a' }}>
                              {t} <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(removeAnimalType(t)); dispatch(saveSettings()); } }} style={{ border: 'none', background: 'transparent', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', marginLeft: 4, color: '#6a1b9a' }} disabled={currentUser?.role === 'Admin Viewer'}>x</button>
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                          <input type="text" value={newAnimalType} onChange={e => setNewAnimalType(e.target.value)} placeholder="e.g. Cattle, Poultry" style={{ flex: 1, minWidth: '200px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }} onKeyDown={e => { if (e.key === 'Enter') handleAddAnimalType(e) }} disabled={currentUser?.role === 'Admin Viewer'} />
                          <button onClick={handleAddAnimalType} className="btn btn-primary" style={{ whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Add Animal Type</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ledger Categories Toggle */}
                  <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenSettings({ ...openSettings, ledgers: !openSettings.ledgers })}
                      style={{ width: '100%', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Ledger Categories
                      {openSettings.ledgers ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {openSettings.ledgers && (
                      <div style={{ padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setActiveLedgerCategoryView('expense')} className={`btn ${activeLedgerCategoryView === 'expense' ? 'btn-primary' : ''}`} style={{ background: activeLedgerCategoryView !== 'expense' ? '#f0f0f0' : '#c62828', color: activeLedgerCategoryView !== 'expense' ? '#333' : 'white', borderColor: activeLedgerCategoryView === 'expense' ? '#b71c1c' : '' }}>Expenses</button>
                            <button onClick={() => setActiveLedgerCategoryView('income')} className={`btn ${activeLedgerCategoryView === 'income' ? 'btn-primary' : ''}`} style={{ background: activeLedgerCategoryView !== 'income' ? '#f0f0f0' : '#2e7d32', color: activeLedgerCategoryView !== 'income' ? '#333' : 'white', borderColor: activeLedgerCategoryView === 'income' ? '#1b5e20' : '' }}>Income</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          {activeLedgerCategoryView === 'expense' && (
                            <div style={{ flex: '1 1 300px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                                {expenseCategories.map(c => (
                                  <span key={c} className="status-indicator" style={{ background: '#ffebee', color: '#c62828' }}>
                                    {c} <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(removeExpenseCategory(c)); dispatch(saveSettings()); } }} style={{ border: 'none', background: 'transparent', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', marginLeft: 4, color: '#c62828' }} disabled={currentUser?.role === 'Admin Viewer'}>x</button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                <input type="text" value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value)} placeholder="e.g. Utilities, Insurance" style={{ flex: 1, minWidth: '150px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }} onKeyDown={e => { if (e.key === 'Enter') handleAddExpenseCategory(e) }} disabled={currentUser?.role === 'Admin Viewer'} />
                                <button onClick={handleAddExpenseCategory} className="btn" style={{ background: '#c62828', color: 'white', whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Add</button>
                              </div>
                            </div>
                          )}
                          {activeLedgerCategoryView === 'income' && (
                            <div style={{ flex: '1 1 300px' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 16 }}>
                                {incomeCategories.map(c => (
                                  <span key={c} className="status-indicator" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                                    {c} <button onClick={() => { if (currentUser?.role !== 'Admin Viewer') { dispatch(removeIncomeCategory(c)); dispatch(saveSettings()); } }} style={{ border: 'none', background: 'transparent', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', marginLeft: 4, color: '#2e7d32' }} disabled={currentUser?.role === 'Admin Viewer'}>x</button>
                                  </span>
                                ))}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                                <input type="text" value={newIncomeCategory} onChange={e => setNewIncomeCategory(e.target.value)} placeholder="e.g. Contract Work" style={{ flex: 1, minWidth: '150px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }} onKeyDown={e => { if (e.key === 'Enter') handleAddIncomeCategory(e) }} disabled={currentUser?.role === 'Admin Viewer'} />
                                <button onClick={handleAddIncomeCategory} className="btn" style={{ background: '#2e7d32', color: 'white', whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'}>Add</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Map Settings Card */}
            <div style={{ marginBottom: 15, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenSettings({ ...openSettings, map: !openSettings.map })}
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
              >
                Map Settings
                {openSettings.map ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {openSettings.map && (
                <div style={{ padding: '20px', background: 'white' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Map Preferences</h3>
                    <div style={{ marginBottom: 16 }}>
                      <label>GPS Distance Threshold (meters)</label>
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={localGpsThreshold}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        onChange={(e) => setLocalGpsThreshold(e.target.value)}
                        onBlur={(e) => {
                          if (currentUser?.role === 'Admin Viewer') return;
                          const num = Number(e.target.value);
                          if (!isNaN(num) && num > 0) {
                            dispatch(setGpsDistanceThreshold(num));
                            dispatch(saveSettings());
                          } else {
                            setLocalGpsThreshold(gpsDistanceThreshold.toString());
                          }
                        }}
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', minWidth: '200px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>Controls how many meters you must move before a new breadcrumb is captured.</span>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label>Polygon Draw Color</label>
                      <input type="color" value={polygonColor} onChange={(e) => { if (currentUser?.role !== 'Admin Viewer') { dispatch(setPolygonColor(e.target.value)); dispatch(saveSettings()); } }} style={{ display: 'block', marginTop: 8, cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }} disabled={currentUser?.role === 'Admin Viewer'} />
                    </div>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Location of Farm</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>Search below, Drop Pin by clicking on map, Zoom to save default zoom, or enter exact coordinates.</span>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: '#f5f7fa', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                        <input
                          id="farm-location-input"
                          type="text"
                          value={manualCoords}
                          onChange={(e) => setManualCoords(e.target.value)}
                          placeholder="e.g. 6.7319579, -10.8700117"
                          style={{ flex: 1, minWidth: '200px', padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text' }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                        />
                        <button
                          onClick={() => {
                            if (currentUser?.role === 'Admin Viewer') return;
                            const parts = manualCoords.split(',');
                            if (parts.length === 2) {
                              const lat = parseFloat(parts[0].trim());
                              const lng = parseFloat(parts[1].trim());
                              if (!isNaN(lat) && !isNaN(lng)) {
                                dispatch(setMapCenter([lat, lng, Date.now()]));
                                dispatch(saveSettings());
                              } else {
                                alert("Invalid coordinates. Please enter Lat, Lng.");
                              }
                            } else {
                              alert("Invalid format. Please enter as: Latitude, Longitude");
                            }
                          }}
                          className="btn btn-primary"
                          style={{ whiteSpace: 'nowrap', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                        >
                          Drop Pin
                        </button>
                      </div>
                    </div>
                    {currentUser?.role !== 'Admin Viewer' && (
                      <div style={{ marginTop: 8 }}>
                        <MapSearchBox
                          onLocationFound={(loc) => { dispatch(setMapCenter(loc)); dispatch(saveSettings()); }}
                        />
                      </div>
                    )}
                    <div style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: 8 }}>
                      <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={24} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                        <MapResizer />
                        <TileLayer attribution="Google Maps" url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga" maxZoom={24} maxNativeZoom={20} />
                        <MapFlyTo center={mapCenter} />
                        <Marker position={mapCenter} />
                        <LocationMarker />
                      </MapContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Google Earth Engine Settings Card */}
            <div style={{ marginBottom: 15, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenSettings({ ...openSettings, gee: !openSettings.gee })}
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
              >
                Google Earth Engine Settings
                {openSettings.gee ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {openSettings.gee && (
                <div style={{ padding: '20px', background: 'white' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Service Account Credentials</h3>
                    
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Project ID</label>
                      <input
                        type="text"
                        value={geeProjectId || ''}
                        onChange={(e) => { dispatch(setGeeProjectId(e.target.value)); dispatch(saveSettings()); }}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        placeholder="e.g. my-earth-engine-project"
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Client Email</label>
                      <input
                        type="email"
                        value={geeClientEmail || ''}
                        onChange={(e) => { dispatch(setGeeClientEmail(e.target.value)); dispatch(saveSettings()); }}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        placeholder="e.g. service-account@project.iam.gserviceaccount.com"
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Private Key</label>
                      <textarea
                        value={geePrivateKey || ''}
                        onChange={(e) => { dispatch(setGeePrivateKey(e.target.value)); dispatch(saveSettings()); }}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', height: '120px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Imagery Resolution Scale (meters/pixel)</label>
                      <input
                        type="number"
                        min="0.5"
                        max="50"
                        step="0.5"
                        value={geeScale}
                        onChange={(e) => { dispatch(setGeeScale(parseFloat(e.target.value) || 3)); dispatch(saveSettings()); }}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        placeholder="e.g. 3"
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                      />
                      <small style={{ display: 'block', marginTop: '6px', color: '#666', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Controls how close to the ground the Google Earth Engine satellite imagery is rendered. A lower value (recommended 5m or less) produces higher resolution details.
                      </small>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <button
                        onClick={handleTestGeeConnection}
                        className="btn btn-primary"
                        style={{ background: '#2e7d32', color: 'white', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', border: 'none', fontWeight: 600 }}
                        disabled={geeTesting}
                      >
                        {geeTesting ? 'Testing Connection...' : 'Test Connection'}
                      </button>
                      {geeTestStatus && (
                        <div style={{ marginTop: 12, padding: '10px', borderRadius: '4px', border: `1px solid ${geeTestStatus.success ? '#c5e1a5' : '#ffcdd2'}`, background: geeTestStatus.success ? '#f1f8e9' : '#ffebee', color: geeTestStatus.success ? '#33691e' : '#c62828', fontSize: '0.85rem' }}>
                          {geeTestStatus.message || geeTestStatus.error}
                        </div>
                      )}
                    </div>

                    {/* GEE Live Field Tester Section */}
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee' }}>
                      <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#333' }}>Live Field Imagery Tester</h3>
                      
                      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Select Field to Test</label>
                          <select
                            value={testFieldId}
                            onChange={(e) => setTestFieldId(e.target.value)}
                            style={{ padding: '8px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}
                          >
                            <option value="">-- Choose a Field --</option>
                            {fields.map(f => (
                              <option key={f.id} value={f.id}>{f.name || f.id}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Select Index (Unpersisted)</label>
                          <select
                            value={testIndexType}
                            onChange={(e) => setTestIndexType(e.target.value)}
                            style={{ padding: '8px', fontSize: '0.85rem', width: '100%', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}
                            disabled={!testFieldId}
                          >
                            <option value="none">None (Standard)</option>
                            <optgroup label="Satellite Indices">
                              <option value="CurrentSatellite">Current Satellite (High-Res RGB)</option>
                              <option value="NDVI">NDVI (Vegetation Index)</option>
                              <option value="NDWI">NDWI (Water Index)</option>
                              <option value="EVI">EVI (Enhanced Vegetation)</option>
                              <option value="SoilMoisture">Soil Moisture</option>
                              <option value="FalseColor">False Color (Biomass)</option>
                              <option value="TrueColor">True Color (RGB)</option>
                            </optgroup>
                            <optgroup label="Weather Map Overlays">
                              <option value="OWM_Clouds">Weather: Clouds (OpenWeather)</option>
                              <option value="OWM_Precipitation">Weather: Precipitation (OpenWeather)</option>
                              <option value="OWM_Temperature">Weather: Temperature (OpenWeather)</option>
                              <option value="OWM_Wind">Weather: Wind Speed (OpenWeather)</option>
                              <option value="OWM_Pressure">Weather: Sea Level Pressure (OpenWeather)</option>
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      {(() => {
                        const selectedField = fields.find(f => f.id === testFieldId);
                        if (!selectedField) return null;
                        
                        // Parse polygon if it's a string
                        let polyCoords = null;
                        if (selectedField.polygon) {
                          try {
                            polyCoords = typeof selectedField.polygon === 'string' 
                              ? JSON.parse(selectedField.polygon) 
                              : selectedField.polygon;
                          } catch (e) {
                            console.error('Failed to parse field polygon', e);
                          }
                        }
                        
                        if (!polyCoords || !Array.isArray(polyCoords) || polyCoords.length < 3) {
                          return <div style={{ color: '#c62828', fontSize: '0.85rem' }}>Selected field does not have valid polygon coordinates.</div>;
                        }
                        
                        // Get status from testGeeStatus state
                        const statusObj = testGeeStatus[selectedField.id] || {};
                        
                        return (
                          <div style={{ marginTop: '15px' }}>
                            {/* GEE loading/success/error status indicator */}
                            <div style={{ marginBottom: '10px', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, 
                              background: statusObj.status === 'success' ? '#e8f5e9' : statusObj.status === 'failed' ? '#ffebee' : '#e3f2fd',
                              color: statusObj.status === 'success' ? '#2e7d32' : statusObj.status === 'failed' ? '#c62828' : '#1565c0',
                              border: `1px solid ${statusObj.status === 'success' ? '#a5d6a7' : statusObj.status === 'failed' ? '#ef9a9a' : '#90caf9'}`
                            }}>
                              {statusObj.status === 'loading' && (testIndexType.startsWith('OWM_') ? '⌛ Fetching weather overlay tiles...' : '⌛ Fetching GEE tiles...')}
                              {statusObj.status === 'success' && (testIndexType.startsWith('OWM_') ? '✓ Live weather overlay successfully loaded.' : '✓ Live GEE tiles successfully loaded.')}
                              {statusObj.status === 'failed' && (testIndexType.startsWith('OWM_') ? `⚠ Weather Map Request Failed: ${statusObj.error || 'Unknown error'}.` : `⚠ GEE Request Failed: ${statusObj.error || 'Unknown error'}. Showing fallback simulation.`)}
                              {!statusObj.status && (testIndexType.startsWith('OWM_') ? 'Preparing Weather Map request...' : 'Preparing GEE request...')}
                            </div>

                            <div style={{ height: '300px', width: '100%', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                              <MapContainer
                                center={mapCenter}
                                zoom={mapZoom}
                                style={{ height: '100%', width: '100%' }}
                              >
                                <TileLayer
                                  attribution="Google Maps"
                                  url="https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga"
                                  maxZoom={24}
                                  maxNativeZoom={20}
                                />
                                {(() => {
                                  const showImagery = testIndexType !== 'none';
                                  const isLoaded = testGeeStatus[selectedField.id]?.status === 'success' || testGeeStatus[selectedField.id]?.status === 'failed';
                                  const makeTransparent = showImagery && isLoaded;
                                  return (
                                    <Polygon
                                      key={selectedField.id}
                                      positions={
                                        Array.isArray(polyCoords) && polyCoords.length > 0 && Array.isArray(polyCoords[0]) && Array.isArray(polyCoords[0][0])
                                          ? polyCoords[0]
                                          : polyCoords
                                      }
                                      pathOptions={{ 
                                         color: selectedField.drawColor || polygonColor, 
                                         weight: 1.5,
                                         opacity: 0.6,
                                         fill: true,
                                         fillOpacity: makeTransparent ? 0.0 : 0.1 
                                       }}
                                    />
                                  );
                                })()}
                                <FieldImageryOverlay
                                  polygon={polyCoords}
                                  indexType={testIndexType}
                                  dateOffset={0}
                                  fieldId={selectedField.id}
                                />
                                <SettingsMapBoundsFitter polygon={polyCoords} />
                              </MapContainer>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* OpenWeatherMap Settings Card */}
            <div style={{ marginBottom: 15, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenSettings({ ...openSettings, owm: !openSettings.owm })}
                type="button"
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
              >
                OpenWeatherMap Settings
                {openSettings.owm ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>

              {openSettings.owm && (
                <div style={{ padding: '20px', background: 'white' }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ marginTop: 0 }}>Weather Map Tile Configuration</h3>
                    
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>OpenWeatherMap API Key (appid)</label>
                      <input
                        type="password"
                        value={owmApiKey || ''}
                        onChange={(e) => { dispatch(setOwmApiKey(e.target.value)); dispatch(saveSettings()); }}
                        disabled={currentUser?.role === 'Admin Viewer'}
                        placeholder="e.g. 32-character hex API key"
                        className="btn"
                        style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                      />
                      <small style={{ display: 'block', marginTop: '6px', color: '#666', fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Required for displaying weather maps (Clouds, Precipitation, Temperature, Wind Speed, Sea Level Pressure) as layers on the farm map. Get your free API key at <a href="https://openweathermap.org" target="_blank" rel="noopener noreferrer" style={{ color: '#2e7d32', textDecoration: 'underline' }}>openweathermap.org</a>.
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Global Save Indicator Toast */}
      <div className={`global-save-toast ${showSaveToast ? 'visible' : ''}`}>
        <Check size={20} /> {toastMessage}
      </div>
      </div>
    </>
  );
}
