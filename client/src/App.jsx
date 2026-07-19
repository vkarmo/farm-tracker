import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Select from 'react-select';
import { fetchFields } from './store/fieldsSlice';
import { addUnit, removeUnit, addJobTitle, removeJobTitle, addExpenseCategory, removeExpenseCategory, addIncomeCategory, removeIncomeCategory, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold, setAppName, addAnimalType, removeAnimalType, saveSettings, setGeeClientEmail, setGeePrivateKey, setGeeProjectId, setGeeScale, setOwmApiKey, setThemeAppBgColor, setThemeCardBgColor, setThemeCardBorderColor, setThemeCardBorderThickness, setThemeAppBorderColor, setThemeAppBorderThickness, setThemeFontName, setThemeFontSizeBase, setThemeFontSizeCardTitle, setThemeFontSizeTabs, setThemeColorPrimary, setThemeColorCardTitle, setThemeColorTabsActiveBg, setThemeColorTabsActiveText, setThemeColorTabsInactiveBg, setThemeColorTabsInactiveText, setThemeFontAppName, setThemeFontSizeAppName, setThemeFontAppNameBold, setThemeFontAppNameCapitalize, setThemeFontSizeBaseBold, setThemeFontSizeBaseCapitalize, setThemeFontSizeCardTitleBold, setThemeFontSizeCardTitleCapitalize, setThemeFontSizeTabsBold, setThemeFontSizeTabsCapitalize, setThemeFontImager, setThemeFontSizeImager, setThemeFontImagerBold, setThemeFontImagerCapitalize, setMtnClientId, setMtnClientSecret, setMtnEnvironment, setSimulateHighWinds, setGoogleMapsApiKey, setGeminiApiKey, setClaudeApiKey, setAiProvider, setNeo4jUri, setNeo4jUser, setNeo4jPassword, setNeo4jDatabase, setWorkdayHours, setWorkdays } from './store/settingsSlice';
import { addLocation } from './store/gpsSlice';
import { queueAction, fetchInitialData, abortSync, clearAllData } from './store/syncSlice';
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

import { Wifi, WifiOff, CloudOff, Target, Tractor, Leaf, DollarSign, MapPin, Rabbit, Settings, BarChart, Layers, Box, ClipboardList, ShieldAlert, Calculator, CalendarClock, AlertTriangle, LogOut, Database, Users, Contact, Briefcase, RefreshCw, Home, Baby, FlaskConical, Map, Check, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
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
import PayrollTab from './components/PayrollTab';
import GpsLogTab from './components/GpsLogTab';
import MessagingTab from './components/MessagingTab';
import { logout, stopImpersonating } from './store/authSlice';
import { logAction } from './store/auditSlice';

const MODULES = {
  overview: ['dashboard', 'map'],
  agronomy: ['field', 'nursery', 'crop', 'soilTests', 'pest'],
  livestock: ['livestock', 'breeding', 'kits', 'livestockDiseases'],
  finance: ['finance', 'budget', 'harvest'],
  operations: ['employee', 'assignment', 'payroll', 'planning', 'equipment', 'deadline', 'incident'],
  admin: ['settings', 'admin', 'access', 'audit', 'gps']
};

export default function App() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const originalAdmin = useSelector(state => state.auth?.originalAdmin);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [activeFarmId, setActiveFarmId] = useState(localStorage.getItem('activeFarmId') || 'default_farm');
  const [farmsList, setFarmsList] = useState([]);
  const [isFarmLoading, setIsFarmLoading] = useState(false);
  const [switchingToFarmId, setSwitchingToFarmId] = useState(null);
  const [hasLoadedInitialFarm, setHasLoadedInitialFarm] = useState(false);

  // Clear active farm from localStorage if the logged-in user changes (including simulation mode)
  useEffect(() => {
    if (currentUser) {
      const lastEmail = localStorage.getItem('lastUserEmail');
      if (lastEmail !== currentUser.email) {
        localStorage.removeItem('activeFarmId');
        localStorage.setItem('lastUserEmail', currentUser.email);
        setActiveFarmId('default_farm');
      }
      setHasLoadedInitialFarm(false);
    } else {
      localStorage.removeItem('lastUserEmail');
      setHasLoadedInitialFarm(false);
    }
  }, [currentUser]);

  const determineDefaultFarm = (farms) => {
    if (currentUser && currentUser.email === 'vkarmo@gmail.com') {
      return 'default_farm';
    }

    if (!farms || farms.length === 0) return 'default_farm';

    // Helper to identify viewing rights (Viewer, Admin Viewer, or any role containing 'viewer' case-insensitively)
    const isViewerRole = (role) => {
      if (!role) return false;
      const lower = role.toLowerCase();
      return lower === 'viewer' || lower === 'admin viewer' || lower.includes('view');
    };

    // 1. the app should default to the farm the logged in user is admin for
    const adminFarm = farms.find(f => f && typeof f.role === 'string' && f.role.toLowerCase() === 'admin');
    if (adminFarm) return adminFarm.id;

    // 2. if a user is simply whitelisted for a farm then default to that farm (non-viewer, non-admin)
    const simplyWhitelistedFarm = farms.find(f => f && !isViewerRole(f.role) && f.role && f.role.toLowerCase() !== 'admin');
    if (simplyWhitelistedFarm) return simplyWhitelistedFarm.id;

    // 3. if the user has viewing rights in other farm data sets, those should not be the default farm for them
    // (Only default to a viewing-rights farm if there are no admin or simply whitelisted options available)
    const viewingRightsFarm = farms.find(f => f && isViewerRole(f.role));
    if (viewingRightsFarm) return viewingRightsFarm.id;

    return farms[0].id;
  };

  const fetchFarms = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/farms?email=${encodeURIComponent(currentUser.email)}`);
      if (response.ok) {
        const data = await response.json();
        setFarmsList(data);

        // Determine default farm
        const defaultFarmId = determineDefaultFarm(data);

        if (!hasLoadedInitialFarm) {
          handleFarmChange(defaultFarmId);
          setHasLoadedInitialFarm(true);
        } else {
          // If we already loaded initial farm, but stored farm is no longer valid, fallback
          const storedFarmId = localStorage.getItem('activeFarmId');
          const isStoredValid = data.some(f => f.id === storedFarmId);
          if (!isStoredValid) {
            handleFarmChange(defaultFarmId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch farms:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFarms();
    }
  }, [currentUser]);

  const handleFarmChange = async (farmId) => {
    dispatch(abortSync());
    setIsFarmLoading(true);
    setSwitchingToFarmId(farmId);
    
    // Smooth transition overlay activation delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    dispatch(clearAllData());
    localStorage.setItem('activeFarmId', farmId);
    setActiveFarmId(farmId);
    
    try {
      await dispatch(fetchInitialData());
    } catch (err) {
      console.error('Failed to load farm data:', err);
    } finally {
      // Small delay to ensure all custom styles, color primary, cards, etc. are painted by the browser
      setTimeout(() => {
        setIsFarmLoading(false);
        setSwitchingToFarmId(null);
      }, 600);
    }
  };

  const handleCreateFarm = async () => {
    const farmName = prompt('Enter the name of the new farm:');
    if (!farmName || !farmName.trim()) return;

    try {
      const response = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: farmName.trim(),
          userEmail: currentUser?.email
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.farm) {
          await fetchFarms();
          handleFarmChange(data.farm.id);
        } else {
          alert(data.error || 'Failed to create farm');
        }
      } else {
        const errText = await response.text();
        alert('Failed to create farm: ' + errText);
      }
    } catch (err) {
      alert('Error creating farm: ' + err.message);
    }
  };

  const mapLabelToName = (labels) => {
    if (!labels || labels.length === 0) return 'Unknown Node';
    const primary = labels[0];
    const mapping = {
      'Field': 'Fields',
      'NurseryBed': 'Nursery Beds',
      'Crop': 'Crops',
      'Livestock': 'Livestock',
      'Transaction': 'Transactions',
      'TaskAssignment': 'Task Assignments',
      'Employee': 'Employees',
      'Budget': 'Budgets',
      'BudgetItem': 'Budget Items',
      'Incident': 'Incidents',
      'Deadline': 'Deadlines',
      'GpsLog': 'GPS Log Pins',
      'AuditLog': 'Audit Log Entries',
      'User': 'Users',
      'Harvest': 'Harvest Records',
      'LivestockKit': 'Livestock Kits',
      'BreedingEvent': 'Breeding Events',
      'GlobalSettings': 'Farm Settings',
      'Pest': 'Pests',
      'SoilTest': 'Soil Tests',
      'Goal': 'Goals',
      'Objective': 'Objectives',
      'LivestockDisease': 'Livestock Diseases',
      'PointOfInterest': 'Points of Interest',
      'Recommendation': 'Crop Recommendations'
    };
    return mapping[primary] || primary;
  };

  const handleScanFarmDataset = async () => {
    if (!selectedDeleteFarmId) return;
    setIsFetchingDeleteSummary(true);
    setDeleteSummary(null);
    setDeleteConfirmationText('');
    try {
      const response = await fetch(`/api/farms/${selectedDeleteFarmId}/summary?email=${encodeURIComponent(currentUser?.email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDeleteSummary(data.summary);
        } else {
          alert(data.error || 'Failed to fetch dataset summary.');
        }
      } else {
        const errText = await response.text();
        alert('Failed to scan: ' + errText);
      }
    } catch (err) {
      alert('Error scanning farm: ' + err.message);
    } finally {
      setIsFetchingDeleteSummary(false);
    }
  };

  const handleConfirmDeleteFarmDataset = async () => {
    if (!selectedDeleteFarmId) return;
    const targetFarm = farmsList.find(f => f.id === selectedDeleteFarmId);
    if (!targetFarm) return;

    if (deleteConfirmationText !== targetFarm.name) {
      alert('Confirmation name mismatch.');
      return;
    }

    setIsDeletingFarm(true);
    try {
      const response = await fetch(`/api/farms/${selectedDeleteFarmId}?email=${encodeURIComponent(currentUser?.email)}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert(`Farm dataset "${targetFarm.name}" has been permanently deleted.`);
          setDeleteSummary(null);
          setDeleteConfirmationText('');
          setSelectedDeleteFarmId('');

          // Refetch available farms list
          const freshResponse = await fetch(`/api/farms?email=${encodeURIComponent(currentUser.email)}`);
          if (freshResponse.ok) {
            const freshFarms = await freshResponse.json();
            setFarmsList(freshFarms);

            // Check if our active farm was the one deleted
            if (activeFarmId === selectedDeleteFarmId) {
              const newDefaultFarmId = determineDefaultFarm(freshFarms);
              handleFarmChange(newDefaultFarmId);
            }
          }
        } else {
          alert(data.error || 'Failed to delete farm dataset.');
        }
      } else {
        const errText = await response.text();
        alert('Failed to delete: ' + errText);
      }
    } catch (err) {
      alert('Error deleting farm: ' + err.message);
    } finally {
      setIsDeletingFarm(false);
    }
  };

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
  
  const loadingFarmName = useMemo(() => {
    if (isFarmLoading && switchingToFarmId) {
      const farm = farmsList.find(f => f.id === switchingToFarmId);
      if (farm) return farm.name;
      if (switchingToFarmId === 'default_farm') return 'NMK Farm';
    }
    return displayAppName;
  }, [isFarmLoading, switchingToFarmId, farmsList, displayAppName]);

  const logo = useSelector(state => state.settings?.logo);
  const polygonColor = useSelector(state => state.settings?.polygonColor) || '#ffffff';
  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const mapZoom = useSelector(state => state.settings?.mapZoom) || 13;
  const gpsDistanceThreshold = useSelector(state => state.settings?.gpsDistanceThreshold) || 10;
  const geeClientEmail = useSelector(state => state.settings?.geeClientEmail) || '';
  const geePrivateKey = useSelector(state => state.settings?.geePrivateKey) || '';
  const geeProjectId = useSelector(state => state.settings?.geeProjectId) || '';
  const geeScale = useSelector(state => state.settings?.geeScale) || 3;
  const mtnClientId = useSelector(state => state.settings?.mtnClientId) || '';
  const mtnClientSecret = useSelector(state => state.settings?.mtnClientSecret) || '';
  const mtnEnvironment = useSelector(state => state.settings?.mtnEnvironment) || 'sandbox';
  const googleMapsApiKey = useSelector(state => state.settings?.googleMapsApiKey) || '';
  const geminiApiKey = useSelector(state => state.settings?.geminiApiKey) || '';
  const claudeApiKey = useSelector(state => state.settings?.claudeApiKey) || '';
  const aiProvider = useSelector(state => state.settings?.aiProvider) || 'gemini';
  const neo4jUri = useSelector(state => state.settings?.neo4jUri) || '';
  const neo4jUser = useSelector(state => state.settings?.neo4jUser) || '';
  const neo4jPassword = useSelector(state => state.settings?.neo4jPassword) || '';
  const neo4jDatabase = useSelector(state => state.settings?.neo4jDatabase) || '';
  const workdayHours = useSelector(state => state.settings?.workdayHours) ?? 7.0;
  const workdays = useSelector(state => state.settings?.workdays);
  const stringWorkdays = useMemo(() => {
    if (workdays === undefined || workdays === null) {
      return ['1', '2', '3', '4', '5', '6', '0'];
    }
    let parsed = workdays;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        if (parsed.trim() === '') return [];
        parsed = parsed.split(',').map(String).filter(n => n.trim() !== '');
      }
    }
    if (!Array.isArray(parsed)) {
      parsed = [parsed];
    }
    return parsed.map(String);
  }, [workdays]);
  const employees = useSelector(state => state.employees?.list) || [];
  const themeAppBgColor = useSelector(state => state.settings?.themeAppBgColor) || '#eeeef1';
  const themeCardBgColor = useSelector(state => state.settings?.themeCardBgColor) || '#ffffff';
  const themeCardBorderColor = useSelector(state => state.settings?.themeCardBorderColor) || '#e0e0e0';
  const themeCardBorderThickness = useSelector(state => state.settings?.themeCardBorderThickness) || '0.50px';
  const themeAppBorderColor = useSelector(state => state.settings?.themeAppBorderColor) || '#363535';
  const themeAppBorderThickness = useSelector(state => state.settings?.themeAppBorderThickness) || '0.50px';
  const themeFontName = useSelector(state => state.settings?.themeFontName) || 'System Default';
  const themeFontSizeBase = useSelector(state => state.settings?.themeFontSizeBase) || '14px';
  const themeFontSizeCardTitle = useSelector(state => state.settings?.themeFontSizeCardTitle) || '1.25rem';
  const themeFontSizeTabs = useSelector(state => state.settings?.themeFontSizeTabs) || '0.9rem';
  const themeColorPrimary = useSelector(state => state.settings?.themeColorPrimary) || '#2e7d32';
  const themeColorCardTitle = useSelector(state => state.settings?.themeColorCardTitle) || '#2e7d32';
  const themeColorTabsActiveBg = useSelector(state => state.settings?.themeColorTabsActiveBg) || '#2e7d32';
  const themeColorTabsActiveText = useSelector(state => state.settings?.themeColorTabsActiveText) || '#ffffff';
  const themeColorTabsInactiveBg = useSelector(state => state.settings?.themeColorTabsInactiveBg) || '#ffffff';
  const themeColorTabsInactiveText = useSelector(state => state.settings?.themeColorTabsInactiveText) || '#6a6a6a';
  const themeFontAppName = useSelector(state => state.settings?.themeFontAppName) || 'System Default';
  const themeFontSizeAppName = useSelector(state => state.settings?.themeFontSizeAppName) || '1.5rem';
  const themeFontAppNameBold = useSelector(state => state.settings?.themeFontAppNameBold) !== false;
  const themeFontAppNameCapitalize = useSelector(state => state.settings?.themeFontAppNameCapitalize) || false;
  const themeFontSizeBaseBold = useSelector(state => state.settings?.themeFontSizeBaseBold) || false;
  const themeFontSizeBaseCapitalize = useSelector(state => state.settings?.themeFontSizeBaseCapitalize) || false;
  const themeFontSizeCardTitleBold = useSelector(state => state.settings?.themeFontSizeCardTitleBold) !== false;
  const themeFontSizeCardTitleCapitalize = useSelector(state => state.settings?.themeFontSizeCardTitleCapitalize) || false;
  const themeFontSizeTabsBold = useSelector(state => state.settings?.themeFontSizeTabsBold) || false;
  const themeFontSizeTabsCapitalize = useSelector(state => state.settings?.themeFontSizeTabsCapitalize) || false;
  const themeFontImager = useSelector(state => state.settings?.themeFontImager) || 'System Default';
  const themeFontSizeImager = useSelector(state => state.settings?.themeFontSizeImager) || '0.72rem';
  const themeFontImagerBold = useSelector(state => state.settings?.themeFontImagerBold) || false;
  const themeFontImagerCapitalize = useSelector(state => state.settings?.themeFontImagerCapitalize) || false;
  const simulateHighWinds = useSelector(state => state.settings?.simulateHighWinds) || false;
  const formatImagerLabel = (txt) => themeFontImagerCapitalize ? txt.toUpperCase() : txt;
  const lastGpsLocation = useSelector(state => {
    const locs = state.gps?.locations || [];
    return locs.length > 0 ? locs[locs.length - 1] : null;
  });
  const syncQueue = useSelector(state => state.sync.offlineActionQueue) || [];
  const isSyncing = useSelector(state => state.sync.isSyncing);
  const backendAvailable = useSelector(state => state.sync.backendAvailable);

  const totalActionsQueued = useSelector(state => state.sync.totalActionsQueued || 0);

  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const handleNavigate = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('navigate-tab', handleNavigate);
    return () => {
      window.removeEventListener('navigate-tab', handleNavigate);
    };
  }, []);
  const [openSettings, setOpenSettings] = useState({ general: true, dropdown: false, map: false, units: false, jobs: false, animals: false, ledgers: false, gee: false, mtn: false, owm: false, theme: false, typography: false, simulation: false, ai: false, neo4j: false, businessDefaults: false, deleteFarm: false });
  const [selectedDeleteFarmId, setSelectedDeleteFarmId] = useState('');
  const [deleteSummary, setDeleteSummary] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isFetchingDeleteSummary, setIsFetchingDeleteSummary] = useState(false);
  const [isDeletingFarm, setIsDeletingFarm] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Record Saved Successfully");
  const [mtnTesting, setMtnTesting] = useState(false);
  const [mtnTestStatus, setMtnTestStatus] = useState(null);
  const [mtnTestPhone, setMtnTestPhone] = useState('');
  const [selectedMtnEmployees, setSelectedMtnEmployees] = useState([]);
  const [mtnTestMessage, setMtnTestMessage] = useState('This is a test message from FarmTracker.');
  const [neo4jTesting, setNeo4jTesting] = useState(false);
  const [neo4jTestStatus, setNeo4jTestStatus] = useState(null);
  const [showNeo4jPassword, setShowNeo4jPassword] = useState(false);
  const [hideDbInfo, setHideDbInfo] = useState(false);
  const [dbVersion, setDbVersion] = useState('5.27-aura');

  const employeeOptions = useMemo(() => {
    return employees
      .filter(e => !e.isTerminated && e.phone)
      .map(e => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName} (${e.phone})`,
        phone: e.phone
      }));
  }, [employees]);

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

  useEffect(() => {
    const fetchDbVersion = async () => {
      try {
        const response = await fetch('/api/neo4j/server-credentials');
        if (response.ok) {
          const creds = await response.json();
          if (creds.version) {
            setDbVersion(creds.version);
          }
        }
      } catch (err) {
        console.error('Error fetching Neo4j version:', err);
      }
    };
    fetchDbVersion();
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
          polygon: testPolygon,
          farmId: activeFarmId,
          email: currentUser?.email
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

  const handleTestNeo4jConnection = async () => {
    if (!neo4jUri || !neo4jUser) {
      alert("Please provide at least a Neo4j URI and Username.");
      return;
    }
    setNeo4jTesting(true);
    setNeo4jTestStatus(null);
    try {
      const response = await fetch('/api/neo4j/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri: neo4jUri,
          username: neo4jUser,
          password: neo4jPassword,
          database: neo4jDatabase
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setNeo4jTestStatus({ success: true });
      } else {
        setNeo4jTestStatus({ success: false, error: data.error || 'Connection failed' });
      }
    } catch (err) {
      setNeo4jTestStatus({ success: false, error: err.message || 'Connection test request failed.' });
    } finally {
      setNeo4jTesting(false);
    }
  };

  const handleLoadDefaultNeo4jCredentials = async () => {
    try {
      const response = await fetch('/api/neo4j/server-credentials');
      if (response.ok) {
        const creds = await response.json();
        dispatch(setNeo4jUri(creds.uri));
        dispatch(setNeo4jUser(creds.username));
        dispatch(setNeo4jPassword(creds.password));
        dispatch(setNeo4jDatabase(creds.database));
        dispatch(saveSettings());
        alert("Server default Neo4j credentials successfully loaded and saved.");
      } else {
        alert("Failed to retrieve server credentials.");
      }
    } catch (err) {
      alert(`Error fetching server credentials: ${err.message}`);
    }
  };

  const handleSendTestSms = async () => {
    setMtnTesting(true);
    setMtnTestStatus(null);

    const sanitizePhoneNumber = (phone) => {
      if (!phone) return '';
      return phone.replace(/[+\-()\s]/g, '');
    };

    // Split manual phone numbers by comma or whitespace, sanitize them
    const manualNumbers = (mtnTestPhone || '')
      .split(/[\s,]+/)
      .map(num => sanitizePhoneNumber(num))
      .filter(num => num.length > 0);

    // Get phone numbers from selected employees, sanitize them
    const employeeNumbers = (selectedMtnEmployees || [])
      .map(emp => sanitizePhoneNumber(emp.phone))
      .filter(num => num.length > 0);

    // Merge and deduplicate
    const combinedRecipients = Array.from(new Set([...manualNumbers, ...employeeNumbers]));

    if (combinedRecipients.length === 0) {
      setMtnTestStatus({ success: false, error: 'Please enter a test phone number or select at least one employee.' });
      setMtnTesting(false);
      return;
    }

    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: mtnClientId,
          clientSecret: mtnClientSecret,
          phoneNumber: combinedRecipients,
          message: mtnTestMessage,
          environment: mtnEnvironment,
          farmId: activeFarmId,
          email: currentUser?.email
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMtnTestStatus({ success: true, message: data.message || 'Test message sent successfully!' });
      } else {
        setMtnTestStatus({ success: false, error: data.error || 'Failed to send test message.' });
      }
    } catch (err) {
      setMtnTestStatus({ success: false, error: err.message || 'An error occurred while sending test message.' });
    } finally {
      setMtnTesting(false);
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
    if (tabId === 'messaging') {
      const isNmkFarm = activeFarmId === 'default_farm';
      const isSuperAdmin = currentUser?.email === 'vkarmo@gmail.com';
      if (!isNmkFarm && !isSuperAdmin) {
        return false;
      }
    }
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

        // Save only if moved beyond distance threshold (removed stationary heartbeat to prevent drift)
        if (distance >= Number(gpsDistanceThreshold)) {
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
      <style>{`
        ${themeFontName && themeFontName !== 'System Default' ? `@import url('https://fonts.googleapis.com/css2?family=${themeFontName.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');` : ''}
        ${themeFontAppName && themeFontAppName !== 'System Default' && themeFontAppName !== themeFontName ? `@import url('https://fonts.googleapis.com/css2?family=${themeFontAppName.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');` : ''}
        ${themeFontImager && themeFontImager !== 'System Default' && themeFontImager !== themeFontName && themeFontImager !== themeFontAppName ? `@import url('https://fonts.googleapis.com/css2?family=${themeFontImager.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');` : ''}

        :root {
          --color-primary: ${themeColorPrimary} !important;
          --color-primary-dark: ${themeColorPrimary} !important;
          --color-primary-light: ${themeColorPrimary} !important;
          --color-accent: ${themeColorPrimary} !important;
          --color-bg: ${themeAppBgColor} !important;
          --color-surface: ${themeCardBgColor} !important;
          --color-border: ${themeAppBorderColor} !important;
        }
        body {
          font-family: ${themeFontName && themeFontName !== 'System Default' ? `'${themeFontName}', sans-serif` : `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`} !important;
          font-size: ${themeFontSizeBase} !important;
          font-weight: ${themeFontSizeBaseBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontSizeBaseCapitalize ? 'uppercase' : 'none'} !important;
          background-color: var(--color-bg) !important;
        }
        input, select, textarea, button {
          font-family: ${themeFontName && themeFontName !== 'System Default' ? `'${themeFontName}', sans-serif` : `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`} !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          text-transform: inherit !important;
        }
        header h1 {
          font-family: ${themeFontAppName && themeFontAppName !== 'System Default' ? `'${themeFontAppName}', sans-serif` : `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`} !important;
          font-size: ${themeFontSizeAppName} !important;
          font-weight: ${themeFontAppNameBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontAppNameCapitalize ? 'uppercase' : 'none'} !important;
        }
        .card {
          background: var(--color-surface) !important;
          border: ${themeCardBorderThickness} solid ${themeCardBorderColor} !important;
        }
        .card h2, .card h3, h2 {
          color: ${themeColorCardTitle} !important;
          font-size: ${themeFontSizeCardTitle} !important;
          font-weight: ${themeFontSizeCardTitleBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontSizeCardTitleCapitalize ? 'uppercase' : 'none'} !important;
        }
        .tab-nav button {
          font-size: ${themeFontSizeTabs} !important;
          font-weight: ${themeFontSizeTabsBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontSizeTabsCapitalize ? 'uppercase' : 'none'} !important;
          background-color: ${themeColorTabsInactiveBg} !important;
          color: ${themeColorTabsInactiveText} !important;
          border-color: ${themeColorTabsInactiveText} !important;
        }
        .tab-nav button.tab-btn-active {
          background-color: ${themeColorTabsActiveBg} !important;
          color: ${themeColorTabsActiveText} !important;
          border-color: ${themeColorTabsActiveBg} !important;
        }
        .tab-nav button.tab-btn-active svg {
          color: ${themeColorTabsActiveText} !important;
        }
        .mobile-data-card {
          background: var(--color-surface) !important;
          border: ${themeAppBorderThickness} solid var(--color-border) !important;
        }
        input[type="text"],
        input[type="number"],
        input[type="password"],
        input[type="email"],
        input[type="date"],
        input[type="tel"],
        select,
        textarea {
          border: ${themeAppBorderThickness} solid var(--color-border) !important;
        }
        .list-item {
          border-bottom: ${themeAppBorderThickness} solid var(--color-border) !important;
        }
        .imager-select-label {
          font-family: ${themeFontImager && themeFontImager !== 'System Default' ? `'${themeFontImager}', sans-serif` : `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`} !important;
          font-size: ${themeFontSizeImager} !important;
          font-weight: ${themeFontImagerBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontImagerCapitalize ? 'uppercase' : 'none'} !important;
        }
        .imager-select,
        .imager-select option,
        .imager-select optgroup {
          font-family: ${themeFontImager && themeFontImager !== 'System Default' ? `'${themeFontImager}', sans-serif` : `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'`} !important;
          font-size: ${themeFontSizeImager} !important;
          font-weight: ${themeFontImagerBold ? 'bold' : 'normal'} !important;
          text-transform: ${themeFontImagerCapitalize ? 'uppercase' : 'none'} !important;
        }
      `}</style>
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
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111111', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <RefreshCw size={54} className="spin" style={{ marginBottom: '24px', color: '#ffffff' }} />
            <h2 style={{ color: '#ffffff', marginBottom: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', textTransform: 'none', fontWeight: 'bold' }}>Updating {displayAppName}...</h2>
            <p style={{ color: '#9ca3af', maxWidth: '280px', textAlign: 'center', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Downloading the latest version.<br />The app will reload automatically.</p>
          </div>
        )}
        {isFarmLoading && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#111111', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <RefreshCw size={54} className="spin" style={{ marginBottom: '24px', color: '#ffffff' }} />
            <h2 style={{ color: '#ffffff', marginBottom: '8px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', textTransform: 'none', fontWeight: 'bold' }}>Switching to {loadingFarmName}...</h2>
            <p style={{ color: '#9ca3af', maxWidth: '280px', textAlign: 'center', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>Applying styles and updating view with the selected farm records.</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {isSyncing ? (
                  <div className="status-indicator status-syncing header-status-indicator"><RefreshCw size={12} className="spin" /> Pushing to DB...</div>
                ) : !isOnline ? (
                  <div className="status-indicator status-offline header-status-indicator">
                    <WifiOff size={12} /> Offline Cache Active
                    {syncQueue.length > 0 && <span style={{ marginLeft: '4px' }}>({syncQueue.length})</span>}
                  </div>
                ) : !backendAvailable ? (
                  <div className="status-indicator status-offline header-status-indicator" style={{ background: '#ffebee', color: '#c62828' }}>
                    <WifiOff size={12} /> Offline
                    {syncQueue.length > 0 && <span style={{ marginLeft: '4px' }}>({syncQueue.length})</span>}
                  </div>
                ) : (
                  <div className="status-indicator status-online header-status-indicator"><Wifi size={12} /> Online</div>
                )}
                <div className="db-info" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                  <Database size={14} style={{ flexShrink: 0 }} />
                  {hideDbInfo ? (
                    <span>Neo4j {dbVersion}</span>
                  ) : (
                    <span title={`${neo4jUri || 'neo4j+s://3fa11aa8.databases.neo4j.io'} | User: ${neo4jUser || '3fa11aa8'}`}>
                      {neo4jUri || 'neo4j+s://3fa11aa8.databases.neo4j.io'} | User: {neo4jUser || '3fa11aa8'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="header-right-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
              <div 
                className="app-toolbar hide-scrollbar"
                style={{ 
                  display: 'flex', 
                  gap: '0px', 
                  background: '#f0f2f5', 
                  padding: '4px', 
                  borderRadius: '0', 
                  flexWrap: 'nowrap', 
                  overflowX: 'auto', 
                  WebkitOverflowScrolling: 'touch', 
                  maxWidth: '100%' 
                }}
              >
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

                {hasAccess('messaging') && (
                  <button onClick={() => { setActiveTab('messaging'); setActiveModule(null); }} className={`btn toolbar-btn ${activeTab === 'messaging' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'messaging' ? '#2e7d32' : 'transparent', color: activeTab === 'messaging' ? 'white' : '#555', borderColor: 'transparent' }} title="Messaging">
                    <MessageSquare size={18} />
                  </button>
                )}

                <button onClick={() => setActiveTab('sync')} className={`btn toolbar-btn system-sync-btn ${activeTab === 'sync' ? 'btn-primary' : ''}`} style={{ background: activeTab === 'sync' ? (!backendAvailable ? '#d32f2f' : '#1565c0') : 'transparent', color: activeTab === 'sync' ? 'white' : (!backendAvailable ? '#d32f2f' : '#1565c0'), borderColor: 'transparent' }} title="System Sync">
                  <RefreshCw size={18} />
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

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', marginTop: '2px' }}>
                <select
                  value={activeFarmId}
                  onChange={(e) => handleFarmChange(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '2px 3px',
                    borderRadius: '2px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#334155',
                    fontSize: '0.65rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '160px',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word'
                  }}
                >
                  {farmsList.length === 0 ? (
                    <option value="default_farm" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>NMK FARM</option>
                  ) : (
                    farmsList.map(farm => (
                      <option key={farm.id} value={farm.id} style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{String(farm.name || '').toUpperCase()}</option>
                    ))
                  )}
                </select>
                {currentUser?.email === 'vkarmo@gmail.com' && (
                  <button
                    onClick={handleCreateFarm}
                    title="Create Farm"
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: 'none',
                      background: '#2e7d32',
                      color: 'white',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      padding: 0
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <nav className="tab-nav" style={{ display: (activeTab === 'sync' || activeTab === 'messaging') ? 'none' : 'flex' }}>
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
              {hasAccess('harvest') && <button onClick={() => setActiveTab('harvest')} className={`btn ${activeTab === 'harvest' ? 'tab-btn-active' : ''}`}><BarChart size={16} style={{ marginRight: 6 }} /> Harvests</button>}
            </>
          )}
          {activeModule === 'operations' && (
            <>
              {hasAccess('employee') && <button onClick={() => setActiveTab('employee')} className={`btn ${activeTab === 'employee' ? 'tab-btn-active' : ''}`}><Contact size={16} style={{ marginRight: 6 }} /> Employees</button>}
              {hasAccess('assignment') && <button onClick={() => setActiveTab('assignment')} className={`btn ${activeTab === 'assignment' ? 'tab-btn-active' : ''}`}><Users size={16} style={{ marginRight: 6 }} /> Assignments</button>}
              {hasAccess('payroll') && <button onClick={() => setActiveTab('payroll')} className={`btn ${activeTab === 'payroll' ? 'tab-btn-active' : ''}`}><DollarSign size={16} style={{ marginRight: 6 }} /> Payroll</button>}
              {hasAccess('planning') && <button onClick={() => setActiveTab('planning')} className={`btn ${activeTab === 'planning' ? 'tab-btn-active' : ''}`}><Target size={16} style={{ marginRight: 6 }} /> Planning</button>}
              {hasAccess('equipment') && <button onClick={() => setActiveTab('equipment')} className={`btn ${activeTab === 'equipment' ? 'tab-btn-active' : ''}`}><Briefcase size={16} style={{ marginRight: 6 }} /> Hard Assets</button>}
              {hasAccess('deadline') && <button onClick={() => setActiveTab('deadline')} className={`btn ${activeTab === 'deadline' ? 'tab-btn-active' : ''}`}><CalendarClock size={16} style={{ marginRight: 6 }} /> Deadlines</button>}
              {hasAccess('incident') && <button onClick={() => setActiveTab('incident')} className={`btn ${activeTab === 'incident' ? 'tab-btn-active' : ''}`}><AlertTriangle size={16} style={{ marginRight: 6 }} /> Incidents</button>}
            </>
          )}
          {activeModule === 'admin' && (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') && (
            <>
              <button onClick={() => setActiveTab('settings')} className={`btn ${activeTab === 'settings' ? 'tab-btn-active' : ''}`} style={{ background: activeTab === 'settings' ? '#c62828' : 'white', color: activeTab === 'settings' ? 'white' : '#c62828', borderColor: '#c62828' }}>
                <Settings size={16} style={{ marginRight: 6 }} /> Settings
              </button>
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
            </>
          )}
        </nav>

        <main className={`container ${['dashboard', 'map', 'field', 'nursery', 'soilTests', 'equipment', 'gps', 'poi', 'settings', 'pest', 'crop', 'budget', 'livestock', 'livestockDiseases', 'payroll', 'incident', 'deadline', 'kits', 'breeding', 'employee', 'assignment', 'planning', 'finance', 'sync', 'admin', 'harvest', 'activity'].includes(activeTab) ? 'container-wide' : ''} ${currentUser?.role === 'Viewer' || currentUser?.role === 'Admin Viewer' ? 'role-viewer' : ''}`} style={{ marginTop: '20px' }}>

          {activeTab === 'dashboard' && <DashboardTab key={activeFarmId} />}
          {activeTab === 'map' && (
            <div key={activeFarmId} className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
              <h2>Farm Overview Map</h2>
              <MapLayer fields={fields} nurseries={nurseries} equipment={equipment} />
            </div>
          )}
          {activeTab === 'poi' && <PoiTab key={activeFarmId} />}

          {/* Modular Entity CRUD Component Wrappers */}
          {activeTab === 'field' && <FieldTab key={activeFarmId} />}
          {activeTab === 'nursery' && <NurseryTab key={activeFarmId} />}
          {activeTab === 'crop' && <CropTab key={activeFarmId} />}
          {activeTab === 'soilTests' && <SoilTestingTab key={activeFarmId} />}
          {activeTab === 'pest' && <PestTab key={activeFarmId} />}
          {/* {activeTab === 'activity' && <ActivityTab key={activeFarmId} />} */}
          {activeTab === 'deadline' && <DeadlineTab key={activeFarmId} />}
          {activeTab === 'incident' && <IncidentTab key={activeFarmId} />}
          {activeTab === 'harvest' && <HarvestTab key={activeFarmId} />}
          {activeTab === 'livestock' && <LivestockTab key={activeFarmId} />}
          {activeTab === 'kits' && <KitsTab key={activeFarmId} />}
          {activeTab === 'breeding' && <BreedingTab key={activeFarmId} />}
          {activeTab === 'livestockDiseases' && <LivestockDiseaseTab key={activeFarmId} />}
          {activeTab === 'employee' && <EmployeeTab key={activeFarmId} />}
          {activeTab === 'equipment' && <EquipmentTab key={activeFarmId} />}
          {activeTab === 'assignment' && <AssignmentTab key={activeFarmId} />}
          {activeTab === 'planning' && <PlanningTab key={activeFarmId} />}
          {activeTab === 'payroll' && <PayrollTab key={activeFarmId} />}
          {activeTab === 'finance' && <FinanceTab key={activeFarmId} />}
          {activeTab === 'sync' && <SyncTab key={activeFarmId} />}
          {activeTab === 'budget' && <BudgetTab key={activeFarmId} />}
          {activeTab === 'admin' && <AdminTab key={activeFarmId} />}
          {activeTab === 'access' && <AccessControlTab key={activeFarmId} />}
          {activeTab === 'audit' && <AuditTab key={activeFarmId} />}
          {activeTab === 'gps' && <GpsLogTab key={activeFarmId} />}
          {activeTab === 'messaging' && <MessagingTab key={activeFarmId} />}

          {activeTab === 'settings' && (currentUser?.role === 'Admin' || currentUser?.role === 'Admin Viewer') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ marginBottom: 0, marginTop: 0 }}>App Settings</h2>

              {/* General Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, general: !openSettings.general })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  General Settings
                  {openSettings.general ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.general && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
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

              {/* Theme & Border Settings Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, theme: !openSettings.theme })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Theme & Border Settings
                  {openSettings.theme ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.theme && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>Color Customization</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>Configure colors and borders across the entire application interface.</p>

                      <div className="form-grid">
                        {/* App Background Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Background Color</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeAppBgColor}
                              onChange={(e) => { dispatch(setThemeAppBgColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeAppBgColor}
                              onChange={(e) => { dispatch(setThemeAppBgColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Card Background Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Card Background Color</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeCardBgColor}
                              onChange={(e) => { dispatch(setThemeCardBgColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeCardBgColor}
                              onChange={(e) => { dispatch(setThemeCardBgColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>Border Customization</h3>
                      <div className="form-grid">
                        {/* Card Border Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Card Border Color</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeCardBorderColor}
                              onChange={(e) => { dispatch(setThemeCardBorderColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeCardBorderColor}
                              onChange={(e) => { dispatch(setThemeCardBorderColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Card Border Thickness */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Card Border Thickness</label>
                          <select
                            value={themeCardBorderThickness}
                            onChange={(e) => { dispatch(setThemeCardBorderThickness(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="0.10px">0.10px</option>
                            <option value="0.25px">0.25px</option>
                            <option value="0.50px">0.50px (Default)</option>
                            <option value="0.75px">0.75px</option>
                            <option value="1px">1px</option>
                            <option value="2px">2px</option>
                            <option value="3px">3px</option>
                            <option value="4px">4px</option>
                            <option value="5px">5px</option>
                          </select>
                        </div>

                        {/* App Border Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Border Color (Inputs, Tables, Lists)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeAppBorderColor}
                              onChange={(e) => { dispatch(setThemeAppBorderColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeAppBorderColor}
                              onChange={(e) => { dispatch(setThemeAppBorderColor(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* App Border Thickness */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Border Thickness</label>
                          <select
                            value={themeAppBorderThickness}
                            onChange={(e) => { dispatch(setThemeAppBorderThickness(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="0.10px">0.10px</option>
                            <option value="0.25px">0.25px</option>
                            <option value="0.50px">0.50px (Default)</option>
                            <option value="0.75px">0.75px</option>
                            <option value="1px">1px</option>
                            <option value="2px">2px</option>
                            <option value="3px">3px</option>
                            <option value="4px">4px</option>
                            <option value="5px">5px</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Typography & Custom Colors Settings Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, typography: !openSettings.typography })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Typography & Custom Colors
                  {openSettings.typography ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.typography && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                    {/* App Name Font Settings Section */}
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>App Name Font Settings</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>Configure typography settings specifically for the application name displayed in the header.</p>

                      <div className="form-grid">
                        {/* App Name Font Family */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Name Font Name</label>
                          <select
                            value={themeFontAppName}
                            onChange={(e) => { dispatch(setThemeFontAppName(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="System Default">System Default (Inter / sans-serif)</option>
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Outfit">Outfit</option>
                            <option value="Poppins">Poppins</option>
                            <option value="Open Sans">Open Sans</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Lato">Lato</option>
                            <option value="Playfair Display">Playfair Display (Serif)</option>
                            <option value="Roboto Mono">Roboto Mono (Monospace)</option>
                          </select>
                        </div>

                        {/* App Name Font Size */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Name Font Size</label>
                          <select
                            value={themeFontSizeAppName}
                            onChange={(e) => { dispatch(setThemeFontSizeAppName(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="1.0rem">1.0rem</option>
                            <option value="1.1rem">1.1rem</option>
                            <option value="1.2rem">1.2rem</option>
                            <option value="1.25rem">1.25rem</option>
                            <option value="1.35rem">1.35rem</option>
                            <option value="1.5rem">1.5rem (Default)</option>
                            <option value="1.75rem">1.75rem</option>
                            <option value="2.0rem">2.0rem</option>
                          </select>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontAppNameBold}
                                onChange={(e) => { dispatch(setThemeFontAppNameBold(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Bold
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontAppNameCapitalize}
                                onChange={(e) => { dispatch(setThemeFontAppNameCapitalize(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Capitalize
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

                    {/* Typography Customization Section */}
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>Typography Customization</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>Select a custom font name and configure font sizes and styles for standard areas.</p>

                      <div className="form-grid">
                        {/* Font Family Selection */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>App Base Font Name</label>
                          <select
                            value={themeFontName}
                            onChange={(e) => { dispatch(setThemeFontName(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="System Default">System Default (Inter / sans-serif)</option>
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Outfit">Outfit</option>
                            <option value="Poppins">Poppins</option>
                            <option value="Open Sans">Open Sans</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Lato">Lato</option>
                            <option value="Playfair Display">Playfair Display (Serif)</option>
                            <option value="Roboto Mono">Roboto Mono (Monospace)</option>
                          </select>
                        </div>

                        {/* Global Base Font Size */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Global Base Font Size</label>
                          <select
                            value={themeFontSizeBase}
                            onChange={(e) => { dispatch(setThemeFontSizeBase(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="12px">12px</option>
                            <option value="13px">13px</option>
                            <option value="14px">14px (Default)</option>
                            <option value="15px">15px</option>
                            <option value="16px">16px</option>
                            <option value="18px">18px</option>
                            <option value="20px">20px</option>
                          </select>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeBaseBold}
                                onChange={(e) => { dispatch(setThemeFontSizeBaseBold(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Bold
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeBaseCapitalize}
                                onChange={(e) => { dispatch(setThemeFontSizeBaseCapitalize(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Capitalize
                            </label>
                          </div>
                        </div>

                        {/* Card Title Font Size */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Card Title Font Size</label>
                          <select
                            value={themeFontSizeCardTitle}
                            onChange={(e) => { dispatch(setThemeFontSizeCardTitle(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="1.0rem">1.0rem</option>
                            <option value="1.1rem">1.1rem</option>
                            <option value="1.2rem">1.2rem</option>
                            <option value="1.25rem">1.25rem (Default)</option>
                            <option value="1.35rem">1.35rem</option>
                            <option value="1.5rem">1.5rem</option>
                            <option value="1.75rem">1.75rem</option>
                          </select>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeCardTitleBold}
                                onChange={(e) => { dispatch(setThemeFontSizeCardTitleBold(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Bold
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeCardTitleCapitalize}
                                onChange={(e) => { dispatch(setThemeFontSizeCardTitleCapitalize(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Capitalize
                            </label>
                          </div>
                        </div>

                        {/* Navigation Tabs Font Size */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Navigation Tabs Font Size</label>
                          <select
                            value={themeFontSizeTabs}
                            onChange={(e) => { dispatch(setThemeFontSizeTabs(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="0.75rem">0.75rem</option>
                            <option value="0.8rem">0.8rem</option>
                            <option value="0.85rem">0.85rem</option>
                            <option value="0.9rem">.9rem (Default)</option>
                            <option value="1.0rem">1.0rem</option>
                            <option value="1.1rem">1.1rem</option>
                            <option value="1.2rem">1.2rem</option>
                          </select>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeTabsBold}
                                onChange={(e) => { dispatch(setThemeFontSizeTabsBold(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Bold
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontSizeTabsCapitalize}
                                onChange={(e) => { dispatch(setThemeFontSizeTabsCapitalize(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Capitalize
                            </label>
                          </div>
                        </div>

                        {/* Imager Dropdown Font Settings */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Imager Dropdown Font Name</label>
                          <select
                            value={themeFontImager}
                            onChange={(e) => { dispatch(setThemeFontImager(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="System Default">System Default (Inter / sans-serif)</option>
                            <option value="Inter">Inter</option>
                            <option value="Roboto">Roboto</option>
                            <option value="Outfit">Outfit</option>
                            <option value="Poppins">Poppins</option>
                            <option value="Open Sans">Open Sans</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Lato">Lato</option>
                            <option value="Playfair Display">Playfair Display (Serif)</option>
                            <option value="Roboto Mono">Roboto Mono (Monospace)</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Imager Dropdown Font Size</label>
                          <select
                            value={themeFontSizeImager}
                            onChange={(e) => { dispatch(setThemeFontSizeImager(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                          >
                            <option value="0.65rem">0.65rem</option>
                            <option value="0.70rem">0.70rem</option>
                            <option value="0.72rem">0.72rem (Default)</option>
                            <option value="0.75rem">0.75rem</option>
                            <option value="0.8rem">0.8rem</option>
                            <option value="0.85rem">0.85rem</option>
                            <option value="0.9rem">0.9rem</option>
                            <option value="1.0rem">1.0rem</option>
                          </select>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontImagerBold}
                                onChange={(e) => { dispatch(setThemeFontImagerBold(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Bold
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={themeFontImagerCapitalize}
                                onChange={(e) => { dispatch(setThemeFontImagerCapitalize(e.target.checked)); dispatch(saveSettings()); }}
                                disabled={currentUser?.role === 'Admin Viewer'}
                                style={{ width: '16px', height: '16px', margin: '0 8px 0 0', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                              />
                              Capitalize
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

                    {/* Component Colors Customization Section */}
                    <div>
                      <h3 style={{ marginTop: 0 }}>Component Colors Customization</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>Configure custom colors for active/inactive tabs, card titles, and primary accents.</p>

                      <div className="form-grid">
                        {/* Primary Brand Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Primary Brand Color</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorPrimary}
                              onChange={(e) => { dispatch(setThemeColorPrimary(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorPrimary}
                              onChange={(e) => { dispatch(setThemeColorPrimary(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Card Titles Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Card Titles Color</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorCardTitle}
                              onChange={(e) => { dispatch(setThemeColorCardTitle(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorCardTitle}
                              onChange={(e) => { dispatch(setThemeColorCardTitle(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Tabs Active Background Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Tabs Active Background</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorTabsActiveBg}
                              onChange={(e) => { dispatch(setThemeColorTabsActiveBg(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorTabsActiveBg}
                              onChange={(e) => { dispatch(setThemeColorTabsActiveBg(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Tabs Active Text Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Tabs Active Text</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorTabsActiveText}
                              onChange={(e) => { dispatch(setThemeColorTabsActiveText(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorTabsActiveText}
                              onChange={(e) => { dispatch(setThemeColorTabsActiveText(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Tabs Inactive Background Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Tabs Inactive Background</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorTabsInactiveBg}
                              onChange={(e) => { dispatch(setThemeColorTabsInactiveBg(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorTabsInactiveBg}
                              onChange={(e) => { dispatch(setThemeColorTabsInactiveBg(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>

                        {/* Tabs Inactive Text Color */}
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>Tabs Inactive Text</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 8 }}>
                            <input
                              type="color"
                              value={themeColorTabsInactiveText}
                              onChange={(e) => { dispatch(setThemeColorTabsInactiveText(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                            />
                            <input
                              type="text"
                              value={themeColorTabsInactiveText}
                              onChange={(e) => { dispatch(setThemeColorTabsInactiveText(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ padding: '8px', width: '100px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown Data Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, dropdown: !openSettings.dropdown })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Dropdown Data
                  {openSettings.dropdown ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.dropdown && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', gap: '15px' }}>

                    {/* Measurement Units Toggle */}
                    <div style={{ border: '1px solid #eee', borderRadius: '6px', overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenSettings({ ...openSettings, units: !openSettings.units })}
                        type="button"
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
                        type="button"
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
                        type="button"
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
                        type="button"
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
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, map: !openSettings.map })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Map Settings
                  {openSettings.map ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.map && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
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
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Google Maps API Key (for Reverse Geocoding)</label>
                        <input
                          type="password"
                          value={googleMapsApiKey || ''}
                          onChange={(e) => { dispatch(setGoogleMapsApiKey(e.target.value)); dispatch(saveSettings()); }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                          placeholder="AIzaSy..."
                          className="btn"
                          style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                        />
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Used to retrieve City/Town and Country names when using current device location.</span>
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
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, gee: !openSettings.gee })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Google Earth Engine Settings
                  {openSettings.gee ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.gee && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
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
                            <label className="imager-select-label" style={{ display: 'block', marginBottom: '4px' }}>{formatImagerLabel("Select Index (Unpersisted)")}</label>
                            <select
                              className="imager-select"
                              value={testIndexType}
                              onChange={(e) => setTestIndexType(e.target.value)}
                              style={{ fontSize: '0.65rem', padding: '2px 3px', borderRadius: '2px', width: '100%', border: '1px solid #ccc', background: 'white' }}
                              disabled={!testFieldId}
                            >
                              <option value="Elevation">{formatImagerLabel("Elevation (Topography)")}</option>
                              <option value="none">{formatImagerLabel("None (Standard)")}</option>
                              <optgroup label={formatImagerLabel("Satellite Indices")}>
                                <option value="CurrentSatellite">{formatImagerLabel("Current Satellite (High-Res RGB)")}</option>
                                <option value="TrueColor">{formatImagerLabel("True Color (RGB)")}</option>
                                <option value="NDVI">{formatImagerLabel("NDVI (Vegetation Index)")}</option>
                                <option value="NDWI">{formatImagerLabel("NDWI (Water Index)")}</option>
                                <option value="EVI">{formatImagerLabel("EVI (Enhanced Vegetation)")}</option>
                                <option value="SoilMoisture">{formatImagerLabel("Soil Moisture")}</option>
                                <option value="FalseColor">{formatImagerLabel("False Color (Biomass)")}</option>
                              </optgroup>
                              <optgroup label={formatImagerLabel("Weather Map Overlays (GEE)")}>
                                <option value="GEE_Temp">{formatImagerLabel("Weather: Temperature (GEE GFS)")}</option>
                                <option value="GEE_Precip">{formatImagerLabel("Weather: Precipitation (GEE GFS)")}</option>
                                <option value="GEE_Wind">{formatImagerLabel("Weather: Wind Speed (GEE GFS)")}</option>
                                <option value="GEE_Humidity">{formatImagerLabel("Weather: Relative Humidity (GEE GFS)")}</option>
                                <option value="GEE_Clouds">{formatImagerLabel("Weather: Total Cloud Cover (GEE GFS)")}</option>
                                <option value="GEE_Pressure">{formatImagerLabel("Weather: Sea Level Pressure (GEE GFS)")}</option>
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
                              <div style={{
                                marginBottom: '10px', padding: '2px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600,
                                background: statusObj.status === 'success' ? '#e8f5e9' : statusObj.status === 'failed' ? '#ffebee' : '#e3f2fd',
                                color: statusObj.status === 'success' ? '#2e7d32' : statusObj.status === 'failed' ? '#c62828' : '#1565c0',
                                border: `1px solid ${statusObj.status === 'success' ? '#a5d6a7' : statusObj.status === 'failed' ? '#ef9a9a' : '#90caf9'}`
                              }}>
                                {statusObj.status === 'loading' && '⌛ Fetching GEE tiles...'}
                                {statusObj.status === 'success' && '✓ Live GEE tiles successfully loaded.'}
                                {statusObj.status === 'failed' && `⚠ GEE Request Failed: ${statusObj.error || 'Unknown error'}. Showing fallback simulation.`}
                                {!statusObj.status && 'Preparing GEE request...'}
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

              {/* MTN SMS Settings Card */}
              {(activeFarmId === 'default_farm' || currentUser?.email === 'vkarmo@gmail.com') && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                  <button
                    onClick={() => setOpenSettings({ ...openSettings, mtn: !openSettings.mtn })}
                    type="button"
                    style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                  >
                    MTN SMS Settings
                    {openSettings.mtn ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>

                  {openSettings.mtn && (
                    <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ marginTop: 0 }}>Credentials & Test Tool</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>
                          Configure your MTN SMS Gateway client credentials. Settings are saved automatically when you edit them. Use the test tool below to verify connection status.
                        </p>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Client ID</label>
                          <input
                            type="text"
                            value={mtnClientId || ''}
                            onChange={(e) => { dispatch(setMtnClientId(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. your-mtn-client-id"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Client Secret</label>
                          <input
                            type="password"
                            value={mtnClientSecret || ''}
                            onChange={(e) => { dispatch(setMtnClientSecret(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. your-mtn-client-secret"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Environment</label>
                          <select
                            value={mtnEnvironment}
                            onChange={(e) => { dispatch(setMtnEnvironment(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc' }}
                          >
                            <option value="sandbox">Sandbox (Testing)</option>
                            <option value="production">Production (Live)</option>
                          </select>
                        </div>

                        {/* SMS Test Tool Section */}
                        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee' }}>
                          <h3 style={{ marginTop: 0, fontSize: '1.1rem', color: '#333' }}>Send Test SMS</h3>

                          <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Select Employee Recipients</label>
                            <Select
                              isMulti
                              options={employeeOptions}
                              value={selectedMtnEmployees}
                              onChange={setSelectedMtnEmployees}
                              placeholder="Search and select employees..."
                              styles={{
                                control: (base, state) => ({
                                  ...base,
                                  borderColor: state.isFocused ? '#2e7d32' : '#ccc',
                                  boxShadow: state.isFocused ? '0 0 0 1px #2e7d32' : null,
                                  '&:hover': {
                                    borderColor: state.isFocused ? '#2e7d32' : '#999',
                                  },
                                  minHeight: '40px',
                                  borderRadius: '6px',
                                  width: '100%',
                                  maxWidth: '500px',
                                  background: '#fff',
                                }),
                                multiValue: (base) => ({
                                  ...base,
                                  backgroundColor: '#e8f5e9',
                                  borderRadius: '4px',
                                }),
                                multiValueLabel: (base) => ({
                                  ...base,
                                  color: '#2e7d32',
                                  fontWeight: '500',
                                }),
                                multiValueRemove: (base) => ({
                                  ...base,
                                  color: '#2e7d32',
                                  ':hover': {
                                    backgroundColor: '#c8e6c9',
                                    color: '#1b5e20',
                                  },
                                }),
                                option: (base, state) => ({
                                  ...base,
                                  backgroundColor: state.isSelected
                                    ? '#2e7d32'
                                    : state.isFocused
                                      ? '#e8f5e9'
                                      : 'transparent',
                                  color: state.isSelected
                                    ? '#fff'
                                    : state.isFocused
                                      ? '#2e7d32'
                                      : '#333',
                                  ':active': {
                                    backgroundColor: '#c8e6c9',
                                  },
                                }),
                              }}
                            />
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Test Phone Number(s)</label>
                            <input
                              type="text"
                              value={mtnTestPhone}
                              onChange={(e) => setMtnTestPhone(e.target.value)}
                              placeholder="e.g. 233241234567, 233247654321"
                              className="btn"
                              style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', background: '#fff', border: '1px solid #ccc' }}
                            />
                            <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '0.75rem' }}>
                              Enter destination phone number(s) in international format without the "+" prefix, separated by commas or spaces.
                            </small>
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Test Message</label>
                            <textarea
                              value={mtnTestMessage}
                              onChange={(e) => setMtnTestMessage(e.target.value)}
                              placeholder="Type a test message..."
                              className="btn"
                              style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', height: '80px', background: '#fff', border: '1px solid #ccc' }}
                            />
                          </div>

                          <div style={{ marginTop: 16 }}>
                            <button
                              type="button"
                              onClick={handleSendTestSms}
                              className="btn btn-primary"
                              style={{ background: '#2e7d32', color: 'white', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', border: 'none', fontWeight: 600 }}
                              disabled={mtnTesting || (!(mtnTestPhone || '').trim() && (selectedMtnEmployees || []).length === 0) || !mtnTestMessage}
                            >
                              {mtnTesting ? 'Sending Test...' : 'Send Test Message'}
                            </button>

                            {mtnTestStatus && (
                              <div style={{ marginTop: 12, padding: '10px', borderRadius: '4px', border: `1px solid ${mtnTestStatus.success ? '#c5e1a5' : '#ffcdd2'}`, background: mtnTestStatus.success ? '#f1f8e9' : '#ffebee', color: mtnTestStatus.success ? '#33691e' : '#c62828', fontSize: '0.85rem' }}>
                                {mtnTestStatus.success ? mtnTestStatus.message : mtnTestStatus.error}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Neo4j Database Instance Settings Card */}
              {(activeFarmId === 'default_farm' || currentUser?.role === 'Admin') && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                  <button
                    onClick={() => setOpenSettings({ ...openSettings, neo4j: !openSettings.neo4j })}
                    type="button"
                    style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                  >
                    Neo4j Database Credentials
                    {openSettings.neo4j ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>

                  {openSettings.neo4j && (
                    <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ marginTop: 0 }}>Connection Settings</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>
                          Configure credentials for your Neo4j instance. These credentials will be stored in your global application settings.
                        </p>

                        <div style={{ marginBottom: 20, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={handleLoadDefaultNeo4jCredentials}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            className="btn"
                            style={{ background: '#37474f', color: 'white', padding: '6px 12px', fontSize: '0.85rem', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                          >
                            Load Server Defaults
                          </button>
                          <button
                            type="button"
                            onClick={() => setHideDbInfo(!hideDbInfo)}
                            className="btn"
                            style={{
                              background: hideDbInfo ? '#0284c7' : '#475569',
                              color: 'white',
                              padding: '6px 12px',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              border: 'none',
                              fontWeight: 600
                            }}
                          >
                            {hideDbInfo ? 'Show Db credentials in App Header' : 'Hide Db credentials in App Header'}
                          </button>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Neo4j URI</label>
                          <input
                            type="text"
                            value={neo4jUri}
                            onChange={(e) => { dispatch(setNeo4jUri(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. neo4j+s://3fa11aa8.databases.neo4j.io"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Username</label>
                          <input
                            type="text"
                            value={neo4jUser}
                            onChange={(e) => { dispatch(setNeo4jUser(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. neo4j"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Password</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '500px' }}>
                            <input
                              type={showNeo4jPassword ? 'text' : 'password'}
                              value={neo4jPassword}
                              onChange={(e) => { dispatch(setNeo4jPassword(e.target.value)); dispatch(saveSettings()); }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              placeholder="Password"
                              className="btn"
                              style={{ flex: 1, padding: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNeo4jPassword(!showNeo4jPassword)}
                              className="btn"
                              style={{ background: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '0.85rem' }}
                            >
                              {showNeo4jPassword ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Database Name (Optional)</label>
                          <input
                            type="text"
                            value={neo4jDatabase}
                            onChange={(e) => { dispatch(setNeo4jDatabase(e.target.value)); dispatch(saveSettings()); }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. neo4j (defaults to active database)"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                        </div>

                        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee' }}>
                          <button
                            type="button"
                            onClick={handleTestNeo4jConnection}
                            className="btn btn-primary"
                            style={{ background: '#0f766e', color: 'white', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', border: 'none', fontWeight: 600 }}
                            disabled={neo4jTesting || !neo4jUri || !neo4jUser}
                          >
                            {neo4jTesting ? 'Testing Connection...' : 'Test Database Connection'}
                          </button>

                          {neo4jTestStatus && (
                            <div style={{
                              marginTop: 12,
                              padding: '10px',
                              borderRadius: '4px',
                              border: `1px solid ${neo4jTestStatus.success ? '#c5e1a5' : '#ffcdd2'}`,
                              background: neo4jTestStatus.success ? '#f1f8e9' : '#ffebee',
                              color: neo4jTestStatus.success ? '#33691e' : '#c62828',
                              fontSize: '0.85rem'
                            }}>
                              {neo4jTestStatus.success
                                ? '✓ Neo4j Database Connection Successful!'
                                : `⚠ Connection Failed: ${neo4jTestStatus.error}`}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Business Defaults Settings Card */}
              {(activeFarmId === 'default_farm' || currentUser?.role === 'Admin') && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                  <button
                    onClick={() => setOpenSettings({ ...openSettings, businessDefaults: !openSettings.businessDefaults })}
                    type="button"
                    style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                  >
                    Business Defaults Settings
                    {openSettings.businessDefaults ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>

                  {openSettings.businessDefaults && (
                    <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ marginTop: 0 }}>Business Defaults Configuration</h3>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>
                          Configure standard business metrics, workday thresholds, and operational defaults.
                        </p>

                        <div style={{ marginBottom: 16 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Workday Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={workdayHours}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              dispatch(setWorkdayHours(isNaN(val) ? 0 : val));
                              dispatch(saveSettings());
                            }}
                            disabled={currentUser?.role === 'Admin Viewer'}
                            placeholder="e.g. 7.0"
                            className="btn"
                            style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                          />
                          <small style={{ display: 'block', marginTop: '6px', color: '#64748b' }}>
                            Specify the default number of hours in a single workday. Used for payroll worksheets and contract day tracking.
                          </small>
                        </div>

                        <div style={{ marginBottom: 16, marginTop: 24 }}>
                          <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Working Days (Weekdays)</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: 12 }}>
                            {[
                              { val: 1, label: 'Monday (M)' },
                              { val: 2, label: 'Tuesday (T)' },
                              { val: 3, label: 'Wednesday (W)' },
                              { val: 4, label: 'Thursday (R)' },
                              { val: 5, label: 'Friday (F)' },
                              { val: 6, label: 'Saturday (S)' },
                              { val: 0, label: 'Sunday (U)' }
                            ].map(dayObj => {
                              const isChecked = stringWorkdays.includes(String(dayObj.val));
                              return (
                                <label key={dayObj.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={currentUser?.role === 'Admin Viewer'}
                                    onChange={() => {
                                      let updated;
                                      if (isChecked) {
                                        updated = stringWorkdays.filter(d => String(d) !== String(dayObj.val));
                                      } else {
                                        updated = [...stringWorkdays, String(dayObj.val)];
                                      }
                                      dispatch(setWorkdays(updated));
                                      dispatch(saveSettings());
                                    }}
                                    style={{ cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer' }}
                                  />
                                  {dayObj.label}
                                </label>
                              );
                            })}
                          </div>
                          <small style={{ display: 'block', marginTop: '12px', color: '#64748b' }}>
                            Check the days of the week that should default to scheduled work days (1) during payroll attendance initialization. Unchecked days default to off (0).
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Crop Advisor AI Settings Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, ai: !openSettings.ai })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  AI Crop Advisor Settings
                  {openSettings.ai ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.ai && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>AI Provider Credentials</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>
                        Configure API keys for Google Gemini and Anthropic Claude models. These keys are used to generate custom crop recommendations and soil management plans.
                      </p>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Preferred AI Provider</label>
                        <select
                          value={aiProvider}
                          onChange={(e) => { dispatch(setAiProvider(e.target.value)); dispatch(saveSettings()); }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                          className="btn"
                          style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer', background: '#fff', border: '1px solid #ccc' }}
                        >
                          <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                          <option value="claude">Anthropic Claude (claude-3-5-sonnet)</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Google Gemini API Key</label>
                        <input
                          type="password"
                          value={geminiApiKey || ''}
                          onChange={(e) => { dispatch(setGeminiApiKey(e.target.value)); dispatch(saveSettings()); }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                          placeholder="AIzaSy..."
                          className="btn"
                          style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px' }}>Anthropic Claude API Key</label>
                        <input
                          type="password"
                          value={claudeApiKey || ''}
                          onChange={(e) => { dispatch(setClaudeApiKey(e.target.value)); dispatch(saveSettings()); }}
                          disabled={currentUser?.role === 'Admin Viewer'}
                          placeholder="sk-ant-..."
                          className="btn"
                          style={{ display: 'block', marginTop: 8, padding: '8px', width: '100%', maxWidth: '500px', cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'text', background: '#fff', border: '1px solid #ccc' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulation & Testing Card */}
              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
                <button
                  onClick={() => setOpenSettings({ ...openSettings, simulation: !openSettings.simulation })}
                  type="button"
                  style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f7fa', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#333' }}
                >
                  Simulation & Testing
                  {openSettings.simulation ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {openSettings.simulation && (
                  <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ marginTop: 0 }}>Severe Weather Simulation</h3>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>
                        Simulate extreme weather conditions (e.g. Severe High Winds) to test real-time agricultural advisories, system warnings, and dashboard response.
                      </p>

                      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontWeight: '600', display: 'block', fontSize: '0.9rem', color: '#1e293b' }}>Simulate Severe High Winds Warning</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Overwrites forecast wind speeds to 18 m/s (64.8 km/h) to trigger severe wind advisories on the dashboard weather view.</span>
                          </div>

                          {/* Toggle Switch */}
                          <label className="toggle-switch-container" style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
                            <input
                              type="checkbox"
                              checked={simulateHighWinds}
                              onChange={(e) => {
                                if (currentUser?.role !== 'Admin Viewer') {
                                  dispatch(setSimulateHighWinds(e.target.checked));
                                  dispatch(saveSettings());
                                }
                              }}
                              disabled={currentUser?.role === 'Admin Viewer'}
                              style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{
                              position: 'absolute',
                              cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer',
                              top: 0, left: 0, right: 0, bottom: 0,
                              backgroundColor: simulateHighWinds ? '#ef4444' : '#cbd5e1',
                              transition: '.4s',
                              borderRadius: '24px',
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '18px', width: '18px',
                                left: simulateHighWinds ? '26px' : '4px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                transition: '.4s',
                                borderRadius: '50%',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                              }} />
                            </span>
                          </label>
                        </div>

                        {simulateHighWinds && (
                          <div style={{ marginTop: '4px', padding: '10px 12px', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '6px', color: '#c62828', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c62828', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                            Severe High Winds Scenario Simulation is currently ACTIVE. Check the Weather dashboard tab to see the advisory warnings.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Farm Dataset Card (Super Admin Only) */}
              {currentUser?.email === 'vkarmo@gmail.com' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #ffcdd2', marginBottom: 0 }}>
                  <button
                    onClick={() => setOpenSettings({ ...openSettings, deleteFarm: !openSettings.deleteFarm })}
                    type="button"
                    style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffebee', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', color: '#c62828' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldAlert size={20} color="#c62828" />
                      <span>Delete Farm Dataset (Super Admin Only)</span>
                    </div>
                    {openSettings.deleteFarm ? <ChevronDown size={20} color="#c62828" /> : <ChevronRight size={20} color="#c62828" />}
                  </button>

                  {openSettings.deleteFarm && (
                    <div style={{ padding: '20px', background: 'var(--color-surface)' }}>
                      <div style={{ marginBottom: 20 }}>
                        <h3 style={{ marginTop: 0, color: '#c62828' }}>Permanently Remove a Farm Dataset</h3>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16, lineHeight: '1.5' }}>
                          Select a farm dataset to delete. Deleting a farm dataset is permanent. It will immediately purge the farm node, its global settings, and all connected telemetry, fields, crops, livestock, transactions, and logs. This operation cannot be undone.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
                          <div style={{ flex: '1 1 300px' }}>
                            <label style={{ fontWeight: '600', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Select Target Farm Dataset</label>
                            <select
                              value={selectedDeleteFarmId}
                              onChange={(e) => {
                                setSelectedDeleteFarmId(e.target.value);
                                setDeleteSummary(null);
                                setDeleteConfirmationText('');
                              }}
                              style={{ padding: '8px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', background: 'white' }}
                            >
                              <option value="">-- Choose Farm to Delete --</option>
                              {farmsList.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.id === 'default_farm' ? 'System Default' : f.id})</option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleScanFarmDataset}
                            className="btn btn-primary"
                            style={{ height: '38px', background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1', cursor: (!selectedDeleteFarmId || isFetchingDeleteSummary) ? 'not-allowed' : 'pointer' }}
                            disabled={!selectedDeleteFarmId || isFetchingDeleteSummary}
                          >
                            {isFetchingDeleteSummary ? 'Scanning...' : 'Scan Dataset'}
                          </button>
                        </div>

                        {deleteSummary && (() => {
                          const targetFarm = farmsList.find(f => f.id === selectedDeleteFarmId);
                          const farmName = targetFarm ? targetFarm.name : 'Unknown';
                          const totalNodes = deleteSummary.reduce((acc, curr) => acc + (curr.count || 0), 0);

                          return (
                            <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
                              <h4 style={{ margin: '0 0 10px 0', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={18} color="#c62828" />
                                Review Node Deletion Summary for "{farmName}"
                              </h4>

                              <p style={{ fontSize: '0.85rem', color: '#27272a', margin: '0 0 12px 0' }}>
                                The selected farm dataset contains <strong>{totalNodes}</strong> total database nodes:
                              </p>

                              {deleteSummary.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#666', margin: '0 0 12px 0' }}>
                                  No nodes connected to this farm. (Empty dataset)
                                </p>
                              ) : (
                                <div style={{ background: 'white', border: '1px solid #e4e4e7', borderRadius: '6px', overflow: 'hidden', marginBottom: '15px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                                    <thead>
                                      <tr style={{ background: '#f4f4f5', borderBottom: '1px solid #e4e4e7' }}>
                                        <th style={{ padding: '8px 12px', fontWeight: '600', color: '#52525b' }}>Data Type</th>
                                        <th style={{ padding: '8px 12px', fontWeight: '600', color: '#52525b', textAlign: 'right' }}>Count</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {deleteSummary.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: idx < deleteSummary.length - 1 ? '1px solid #f4f4f5' : 'none' }}>
                                          <td style={{ padding: '8px 12px', color: '#27272a' }}>{mapLabelToName(item.labels)}</td>
                                          <td style={{ padding: '8px 12px', color: '#27272a', textAlign: 'right', fontWeight: '600' }}>{item.count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '600', margin: '0 0 12px 0' }}>
                                WARNING: Performing this action will detach and permanently delete the farm node, all summary nodes listed above, and any associated nested budget items.
                              </p>

                              <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: '600', color: '#c62828' }}>
                                  To confirm, please type the exact farm name "{farmName}":
                                </label>
                                <input
                                  type="text"
                                  value={deleteConfirmationText}
                                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                                  placeholder="Type farm name here"
                                  style={{ padding: '8px', width: '100%', border: '1px solid #ef9a9a', borderRadius: '4px', background: 'white' }}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={handleConfirmDeleteFarmDataset}
                                className="btn"
                                style={{
                                  background: deleteConfirmationText === farmName ? '#d32f2f' : '#e4e4e7',
                                  color: deleteConfirmationText === farmName ? 'white' : '#a1a1aa',
                                  border: 'none',
                                  padding: '10px 16px',
                                  borderRadius: '6px',
                                  fontWeight: '600',
                                  cursor: deleteConfirmationText === farmName ? 'pointer' : 'not-allowed',
                                  width: '100%',
                                  transition: 'all 0.3s'
                                }}
                                disabled={deleteConfirmationText !== farmName || isDeletingFarm}
                              >
                                {isDeletingFarm ? 'Permanently Purging Data...' : `Permanently Delete Dataset "${farmName}"`}
                              </button>
                            </div>
                          );
                        })()}

                      </div>
                    </div>
                  )}
                </div>
              )}

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
