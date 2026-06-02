import React, { useMemo, useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveAssignment } from '../store/assignmentSlice';
import Select from 'react-select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Layers, Rabbit, DollarSign, Sun, CloudRain, Cloud, CloudLightning, Snowflake, CloudFog, MapPin, Droplets, Wind, ThermometerSun, CloudSun, Droplet, Clock, AlertTriangle, ShieldCheck, AlertCircle, Info, Thermometer, Target, ClipboardList, List, ChevronRight, ChevronDown } from 'lucide-react';
import CrudTable from './CrudTable';
import area from '@turf/area';
import { polygon } from '@turf/helpers';


const CollapsibleCard = ({ title, children, defaultOpen = true, forceFullGrid = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`card ${forceFullGrid ? 'form-grid-full' : ''}`} style={{ marginBottom: 0 }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isOpen ? '20px' : '0', borderBottom: isOpen ? '2px solid #efefef' : 'none', paddingBottom: isOpen ? '10px' : '0' }}
      >
        <h3 style={{ fontSize: '1.05rem', margin: 0, color: '#333' }}>
          {title}
        </h3>
        <button tabIndex="-1" className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', pointerEvents: 'none' }}>
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      {isOpen && children}
    </div>
  );
};

export default function DashboardTab() {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth?.currentUser);
  const fields = useSelector(state => state.fields.data) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const transactions = useSelector(state => state.financials.transactions) || [];
  const activities = useSelector(state => state.activities?.log) || [];
  const deadlines = useSelector(state => state.deadlines?.list) || [];
  const incidents = useSelector(state => state.incidents?.list) || [];
  const goals = useSelector(state => state.planning?.goals) || [];
  const objectives = useSelector(state => state.planning?.objectives) || [];
  const assignments = useSelector(state => state.assignments?.list) || [];
  const employeesList = useSelector(state => state.employees?.list) || [];

  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];
  const simulateHighWinds = useSelector(state => state.settings?.simulateHighWinds) || false;

  const [selectedLocIndex, setSelectedLocIndex] = useState(0);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [geeWeatherData, setGeeWeatherData] = useState(null);
  const [geeWeatherLoading, setGeeWeatherLoading] = useState(false);
  const [geeWeatherError, setGeeWeatherError] = useState(null);

  const effectiveGeeWeatherLoading = simulateHighWinds ? false : geeWeatherLoading;

  const effectiveGeeWeatherData = useMemo(() => {
    if (!geeWeatherData) {
      if (simulateHighWinds) {
        return {
          temperature: 28.0,
          precipitation: 0.0,
          windSpeed: 18.0,
          humidity: 85,
          clouds: 90,
          dateStr: new Date().toLocaleDateString() + ' (Simulated)',
          duration: '3 Hours (Hourly Forecast)',
          isSimulated: true,
          weatherCode: 3
        };
      }
      return null;
    }
    if (simulateHighWinds) {
      return {
        ...geeWeatherData,
        windSpeed: 18.0,
        isSimulated: true
      };
    }
    return geeWeatherData;
  }, [geeWeatherData, simulateHighWinds]);
  const [activeWeatherTab, setActiveWeatherTab] = useState('current');
  const [activeDashboardTab, setActiveDashboardTab] = useState('assignments');
  const [selectedCropIds, setSelectedCropIds] = useState([]);
  const [harvestFromDate, setHarvestFromDate] = useState('');
  const [harvestToDate, setHarvestToDate] = useState('');
  const [harvestViewToggle, setHarvestViewToggle] = useState('graph');
  const [expandedNodes, setExpandedNodes] = useState({});

  const activeRate = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const recent = sorted.find(t => t.exchangeRate && String(t.exchangeRate).trim() !== '');
    const rateVal = recent ? parseFloat(recent.exchangeRate) : 150;
    return rateVal > 0 ? rateVal : 150;
  }, [transactions]);

  const getEmployeeHourlyRate = (emp) => {
    if (!emp) return 0;
    if (emp.type === 'Daily') {
      const dailyLD = parseFloat(emp.dailyRateLD) || 0;
      const dailyUSD = activeRate > 0 ? (dailyLD / activeRate) : 0;
      return dailyUSD / 8; // assuming standard 8-hour day
    } else {
      const biweeklyUSD = parseFloat(emp.twoWeekPayUSD) || 0;
      return biweeklyUSD / 80; // assuming standard 80 hours per 2 weeks
    }
  };

  const avgHourlyRate = useMemo(() => {
    const activeEmployees = employeesList.filter(e => !e.isTerminated);
    if (activeEmployees.length === 0) return 0;
    const sum = activeEmployees.reduce((s, e) => s + getEmployeeHourlyRate(e), 0);
    return sum / activeEmployees.length;
  }, [employeesList, activeRate]);

  const getAssignmentCost = (ass) => {
    const assHours = parseFloat(ass.hours) || 0;
    if (assHours <= 0) return 0;

    const ids = ass.workerIds || [];
    if (ids.length === 0) {
      return assHours * avgHourlyRate;
    }

    const hoursPerWorker = assHours / ids.length;
    let totalCost = 0;
    ids.forEach(id => {
      const emp = employeesList.find(e => e.id === id);
      const rate = getEmployeeHourlyRate(emp);
      totalCost += hoursPerWorker * rate;
    });
    return totalCost;
  };

  const renderWorkerNames = (workerIds) => {
    if (!workerIds || workerIds.length === 0) return 'None';
    const names = workerIds.map(id => {
      const emp = employeesList.find(e => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
    });
    return names.join(', ');
  };

  const weatherLocations = useMemo(() => [
    { label: 'Default Farm Location', coords: mapCenter },
    { label: 'Bomi County, Liberia', coords: [6.7319579, -10.8700117] }
  ].sort((a, b) => (a.label || '').localeCompare(b.label || '')), [mapCenter]);

  // Fetch Weather Data
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const [lat, lng] = weatherLocations[selectedLocIndex].coords;
        // Open-Meteo free API
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit`);
        const data = await res.json();
        if (isMounted) {
          setWeatherData(data);
          setWeatherLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
        if (isMounted) setWeatherLoading(false);
      }
    };
    fetchWeather();
    return () => { isMounted = false; };
  }, [weatherLocations, selectedLocIndex]);

  // Fetch GEE Weather Data
  useEffect(() => {
    let isMounted = true;
    const fetchGeeWeather = async () => {
      setGeeWeatherLoading(true);
      setGeeWeatherError(null);
      try {
        const [lat, lng] = weatherLocations[selectedLocIndex].coords;
        const polygon = [
          [lat - 0.005, lng - 0.005],
          [lat + 0.005, lng - 0.005],
          [lat + 0.005, lng + 0.005],
          [lat - 0.005, lng + 0.005]
        ];

        const response = await fetch('/api/gee/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ polygon, dateOffset: 0 })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (isMounted) {
          setGeeWeatherData(data);
          setGeeWeatherLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch GEE weather forecast reanalysis:", err);
        if (isMounted) {
          setGeeWeatherError(err.message || 'Failed to fetch weather');
          setGeeWeatherLoading(false);
        }
      }
    };
    fetchGeeWeather();
    return () => { isMounted = false; };
  }, [weatherLocations, selectedLocIndex]);

  // Weather Code to Icon Mapper
  const getWeatherIcon = (code, temp, size = 24) => {
    if (code === 0) {
      if (temp && temp >= 90) return <ThermometerSun size={size} color="#d32f2f" />;
      return <Sun size={size} color="#f57c00" />;
    }
    if (code >= 1 && code <= 2) return <CloudSun size={size} color="#fbc02d" />;
    if (code === 3) return <Cloud size={size} color="#90a4ae" />;
    if (code >= 45 && code <= 48) return <CloudFog size={size} color="#78909c" />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} color="#1e88e5" />;
    if (code >= 71 && code <= 82) return <CloudRain size={size} color="#1565c0" />; // Replaces snow with heavy tropical rain
    if (code >= 95 && code <= 99) return <CloudLightning size={size} color="#5e35b1" />;
    return <Sun size={size} color="#f57c00" />;
  };

  const getWeatherDescription = (code) => {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 82) return 'Heavy Rain'; // Replaces snow with heavy rain for tropical context
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  // Top-Level Metric Calculations
  const totalAcres = fields
    .filter(f => f.includeInStats !== false)
    .reduce((sum, f) => sum + (parseFloat(f.area) || 0), 0);
  const activeCrops = crops.filter(c => c.status !== 'Harvested/Completed');
  const activeLivestock = livestock.filter(l => l.healthStatus !== 'Deceased');

  const netGross = transactions.reduce((sum, tx) => {
    const val = parseFloat(tx.amount) || 0;
    return tx.txType === 'Sale' ? sum + val : sum - val;
  }, 0);

  // 1. Harvest by Day
  const harvestByDay = useMemo(() => {
    const map = {};
    const filteredHarvests = harvests.filter(h => {
      if (selectedCropIds.length > 0 && !selectedCropIds.includes(h.cropId)) return false;
      if (harvestFromDate && h.date < harvestFromDate) return false;
      if (harvestToDate && h.date > harvestToDate) return false;
      return true;
    });
    filteredHarvests.forEach(h => {
      const d = h.date || 'Unknown';
      if (!map[d]) map[d] = { date: d, yield: 0 };
      map[d].yield += parseFloat(h.amount) || 0;
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [harvests, selectedCropIds, harvestFromDate, harvestToDate]);

  const cropsWithHarvests = useMemo(() => {
    const cropIds = new Set(harvests.map(h => h.cropId));
    return crops.filter(c => cropIds.has(c.id)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [harvests, crops]);

  const cropSelectOptions = useMemo(() => cropsWithHarvests.map(c => ({
    value: c.id, label: `${c.name} ${c.variety ? `(${c.variety})` : ''}`
  })), [cropsWithHarvests]);

  const harvestReportData = useMemo(() => {
    const filteredHarvests = harvests.filter(h => {
      if (selectedCropIds.length > 0 && !selectedCropIds.includes(h.cropId)) return false;
      if (harvestFromDate && h.date < harvestFromDate) return false;
      if (harvestToDate && h.date > harvestToDate) return false;
      return true;
    });

    return filteredHarvests.map(h => {
      const crop = crops.find(c => c.id === h.cropId);
      const cropName = crop ? `${crop.name} ${crop.variety ? `(${crop.variety})` : ''}` : 'Unknown Crop';
      const relatedSales = transactions.filter(tx => tx.txType === 'Sale' && tx.assetId === h.id);
      const salesTotal = relatedSales.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

      return {
        id: h.id,
        date: h.date || '-',
        cropName,
        amountText: `${h.amount || 0} ${h.unit || ''}`,
        amountValue: parseFloat(h.amount) || 0,
        salesTotal
      };
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [harvests, crops, transactions, selectedCropIds, harvestFromDate, harvestToDate]);

  const totalHarvestAmount = harvestReportData.reduce((sum, h) => sum + h.amountValue, 0);
  const totalHarvestSales = harvestReportData.reduce((sum, h) => sum + h.salesTotal, 0);

  const reportColumns = [
    { key: 'date', header: 'Date' },
    { key: 'cropName', header: 'Crop Details' },
    { key: 'amountText', header: 'Quantity' },
    { key: 'salesTotal', header: 'Related Sales', render: (r) => r.salesTotal > 0 ? `$${r.salesTotal.toFixed(2)}` : '-' }
  ];

  // Financial Grouping Function (By 2 weeks)
  const getFortnight = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const fortnight = Math.ceil(days / 14);
    return `${date.getFullYear()}-F${fortnight.toString().padStart(2, '0')}`;
  };

  const dashboardChartsData = useMemo(() => {
    const fortnightMap = {};
    const monthMap = {};
    const revCategoryMap = {};
    const expCategoryMap = {};

    transactions.forEach(tx => {
      const val = parseFloat(tx.amount) || 0;
      const fn = getFortnight(tx.date);
      const m = tx.date ? tx.date.substring(0, 7) : 'Unknown';
      const cat = tx.category || 'Other';

      if (!fortnightMap[fn]) fortnightMap[fn] = { time: fn, Revenue: 0, Expenses: 0 };
      if (!monthMap[m]) monthMap[m] = { time: m, Revenue: 0, Expenses: 0 };

      if (tx.txType === 'Sale' || tx.txType === 'Revenue') {
        fortnightMap[fn].Revenue += val;
        monthMap[m].Revenue += val;
        revCategoryMap[cat] = (revCategoryMap[cat] || 0) + val;
      } else {
        fortnightMap[fn].Expenses += val;
        monthMap[m].Expenses += val;
        expCategoryMap[cat] = (expCategoryMap[cat] || 0) + val;
      }
    });

    return {
      fortnightData: Object.values(fortnightMap).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      monthData: Object.values(monthMap).sort((a, b) => (a.time || '').localeCompare(b.time || '')),
      revPieData: Object.entries(revCategoryMap).map(([name, value]) => ({ name, value })),
      expPieData: Object.entries(expCategoryMap).map(([name, value]) => ({ name, value }))
    };
  }, [transactions]);

  const { fortnightData, monthData, revPieData, expPieData } = dashboardChartsData;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

  // Activities Feed
  const today = new Date().toISOString().split('T')[0];
  const sortedActivities = [...activities].sort((a, b) => {
    const dateA = a.plannedDate || a.date || '';
    const dateB = b.plannedDate || b.date || '';
    return (dateB || '').localeCompare(dateA || ''); // Descending
  });

  const getSeverity = (act) => {
    if (act.date) return { color: '#4caf50', title: 'Executed' }; // Green
    if (!act.plannedDate) return { color: '#9e9e9e', title: 'Unplanned' }; // Grey
    if (act.plannedDate >= today) return { color: '#ffeb3b', title: 'Upcoming' }; // Yellow
    if (act.plannedDate < today) return { color: '#f44336', title: 'Overdue' }; // Red
    return { color: '#9e9e9e', title: 'Unknown' };
  };

  const getTargetName = (id) => {
    if (!id) return '-';
    const crop = crops.find(c => c.id === id);
    if (crop) return `Crop: ${crop.name}`;
    const field = fields.find(f => f.id === id);
    if (field) return `Field: ${field.name}`;
    const bed = nurseries.find(n => n.id === id);
    if (bed) return `Nursery: ${bed.name}`;
    return id;
  };

  const incidentColumns = [
    { key: 'date', header: 'Date' },
    { key: 'title', header: 'Title' },
    { key: 'associatedAsset', header: 'Affected Asset', render: (r) => r.associatedAsset || '-' },
    {
      key: 'severity', header: 'Severity', render: (r) => (
        <span style={{
          color: r.severity === 'High' ? '#c62828' : r.severity === 'Medium' ? '#f57c00' : '#4caf50',
          fontWeight: 'bold'
        }}>{r.severity}</span>
      )
    },
    { key: 'resolutionStatus', header: 'Status' }
  ];

  const deadlineColumns = [
    { key: 'dueDate', header: 'Due Date' },
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Category' },
    { key: 'personResponsible', header: 'Responsible', render: (r) => r.personResponsible || '-' },
    {
      key: 'status', header: 'Status', render: (r) => (
        <span style={{ color: r.status === 'Overdue' ? '#c62828' : r.status === 'Resolved' ? '#2e7d32' : '#f57c00' }}>
          {r.status}
        </span>
      )
    }
  ];

  const renderForecastCard = (time, idx, date, isWeekend) => {
    if (!weatherData) return null;
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weatherCode = weatherData.daily.weather_code[idx];
    const tempMax = Math.round(weatherData.daily.temperature_2m_max[idx]);
    const tempMin = Math.round(weatherData.daily.temperature_2m_min[idx]);
    const description = getWeatherDescription(weatherCode);

    const themeColor = isWeekend ? '#b58900' : '#1b5e20';
    const bgGradient = isWeekend
      ? 'linear-gradient(135deg, #fffcf4 0%, #fff9e6 100%)'
      : 'linear-gradient(135deg, #f7faf7 0%, #edf4ed 100%)';
    const ringBorder = isWeekend
      ? '2px solid rgba(181, 137, 0, 0.3)'
      : '2px solid rgba(27, 94, 32, 0.3)';

    return (
      <div
        key={time}
        style={{
          flex: '1 1 140px',
          background: 'white',
          border: '1px solid #eef2f6',
          borderTop: `4px solid ${themeColor}`,
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'default'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.04)';
        }}
      >
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: themeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {idx === 0 ? 'Today' : dayName}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '-4px', fontWeight: 500 }}>
          {dateString}
        </div>
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: bgGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '8px 0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: ringBorder
        }}>
          {getWeatherIcon(weatherCode, tempMax, 46)}
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', minHeight: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {description}
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.95rem', marginTop: '4px', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: '#dc2626' }}>{tempMax}°</span>
          <span style={{ color: '#cbd5e1', fontWeight: 300 }}>|</span>
          <span style={{ color: '#2563eb', fontWeight: 800 }}>{tempMin}°</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Global Metric Cards */}
      <div style={{ width: '100%' }}>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: netGross >= 0 ? '#2e7d32' : '#d32f2f' }}><DollarSign size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">NET BALANCE</div>
              <div className="metric-card-value">${netGross.toFixed(2)}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#1565c0' }}><Layers size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">ACTIVE ACREAGE</div>
              <div className="metric-card-value">{totalAcres.toFixed(1)} ac</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#f57c00' }}><Rabbit size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">LIVESTOCK</div>
              <div className="metric-card-value">{activeLivestock.length}</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-icon" style={{ background: '#6a1b9a' }}><TrendingUp size={20} /></div>
            <div className="metric-card-content">
              <div className="metric-card-title">CROPS</div>
              <div className="metric-card-value">{activeCrops.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content', marginBottom: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveDashboardTab('assignments')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'assignments' ? 'white' : 'transparent',
            color: activeDashboardTab === 'assignments' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'assignments' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Current Assignments
        </button>
        <button
          onClick={() => setActiveDashboardTab('incidents')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'incidents' ? 'white' : 'transparent',
            color: activeDashboardTab === 'incidents' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'incidents' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Incidents
        </button>
        <button
          onClick={() => setActiveDashboardTab('deadlines')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'deadlines' ? 'white' : 'transparent',
            color: activeDashboardTab === 'deadlines' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'deadlines' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Deadlines
        </button>
        <button
          onClick={() => setActiveDashboardTab('weather')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'weather' ? 'white' : 'transparent',
            color: activeDashboardTab === 'weather' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'weather' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Weather
        </button>
        <button
          onClick={() => setActiveDashboardTab('harvests')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'harvests' ? 'white' : 'transparent',
            color: activeDashboardTab === 'harvests' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'harvests' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Harvests
        </button>
        <button
          onClick={() => setActiveDashboardTab('financials')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeDashboardTab === 'financials' ? 'white' : 'transparent',
            color: activeDashboardTab === 'financials' ? '#2e7d32' : '#64748b',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: activeDashboardTab === 'financials' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Financials
        </button>
      </div>

      {/* Agricultural Impact Analysis (placed globally below the sub-tabs selector) */}
      {effectiveGeeWeatherData && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'wrap', width: '100%', marginBottom: '20px' }}>
          {(() => {
            const alerts = [];
            const w = effectiveGeeWeatherData;

            if (w.windSpeed > 5.0) {
              alerts.push({
                type: 'warning',
                title: 'Spraying Advisory',
                text: `High wind drift risk (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Avoid chemical spraying.`,
                color: '#e65100',
                bg: '#fff8e1'
              });
            } else if (w.windSpeed < 1.0) {
              alerts.push({
                type: 'warning',
                title: 'Spraying Advisory',
                text: `Calm wind (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). Risk of thermal inversion drift.`,
                color: '#d84315',
                bg: '#fbe9e7'
              });
            } else {
              alerts.push({
                type: 'success',
                title: 'Spraying Advisory',
                text: `Optimal spraying window. Wind is between 1-5 m/s (${Math.round(w.windSpeed * 3.6)} km/h).`,
                color: '#2e7d32',
                bg: '#e8f5e9'
              });
            }

            if (w.windSpeed > 15.0) {
              alerts.push({
                type: 'danger',
                title: 'Severe High Winds Warning',
                text: `Dangerous winds detected (${Math.round(w.windSpeed * 3.6)} km/h / ${w.windSpeed} m/s). High risk of crop flattening, nursery damage, and minor structural damage. Secure covers and loose gear.`,
                color: '#c62828',
                bg: '#ffebee'
              });
            }

            if (w.temperature < 2.0) {
              alerts.push({
                type: 'danger',
                title: 'Frost Alert',
                text: `Low temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Cover sensitive crops & nurseries.`,
                color: '#c62828',
                bg: '#ffebee'
              });
            } else if (w.temperature > 32.0) {
              alerts.push({
                type: 'danger',
                title: 'Heat Alert',
                text: `High temp (${Math.round(w.temperature * 1.8 + 32)}°F / ${w.temperature}°C). Elevate crop irrigation frequency.`,
                color: '#c62828',
                bg: '#ffebee'
              });
            }

            if (w.precipitation > 0.1) {
              alerts.push({
                type: 'info',
                title: 'Precipitation Active',
                text: `Rain (${w.precipitation} mm/h) detected. Pause scheduled irrigation.`,
                color: '#1565c0',
                bg: '#e3f2fd'
              });
            } else if (w.humidity < 35.0) {
              alerts.push({
                type: 'warning',
                title: 'Dry Air Alert',
                text: `Humidity is low (${w.humidity}%). Monitor soil moisture profiles.`,
                color: '#e65100',
                bg: '#fff8e1'
              });
            }

            if (w.humidity > 85.0 && w.temperature >= 18.0 && w.temperature <= 28.0) {
              alerts.push({
                type: 'danger',
                title: 'Disease Risk',
                text: `Humid & warm conditions favor fungal / mildew growth.`,
                color: '#c62828',
                bg: '#ffebee'
              });
            }

            return alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: alert.bg,
                  borderLeft: `5px solid ${alert.color}`,
                  borderTop: '1px solid rgba(0,0,0,0.03)',
                  borderRight: '1px solid rgba(0,0,0,0.03)',
                  borderBottom: '1px solid rgba(0,0,0,0.03)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  flex: '1 1 280px',
                  minWidth: '280px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {alert.type === 'danger' && <AlertCircle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'warning' && <AlertTriangle size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'success' && <ShieldCheck size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  {alert.type === 'info' && <Info size={26} color={alert.color} style={{ flexShrink: 0 }} />}
                  <strong style={{ fontSize: '1.02rem', fontWeight: 800, color: alert.color }}>
                    {alert.title}
                  </strong>
                </div>
                <div style={{ color: '#4b5563', fontSize: '0.72rem', lineHeight: 1.45, paddingLeft: '34px', fontWeight: 500 }}>
                  {alert.text}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {activeDashboardTab === 'weather' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Weather Forecast Widget */}
          <CollapsibleCard title="Current Weather & Forecast">
            {/* Tab Controls and Location Selector */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #eef2f6', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                <button
                  onClick={() => setActiveWeatherTab('current')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeWeatherTab === 'current' ? 'white' : 'transparent',
                    color: activeWeatherTab === 'current' ? '#2e7d32' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    boxShadow: activeWeatherTab === 'current' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Current Conditions
                </button>
                <button
                  onClick={() => setActiveWeatherTab('forecast')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeWeatherTab === 'forecast' ? 'white' : 'transparent',
                    color: activeWeatherTab === 'forecast' ? '#2e7d32' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    boxShadow: activeWeatherTab === 'forecast' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Forecast
                </button>
              </div>
              <select
                value={selectedLocIndex}
                onChange={(e) => setSelectedLocIndex(Number(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', background: 'white', fontWeight: 600, color: 'var(--color-primary-dark)', cursor: 'pointer' }}
              >
                {weatherLocations.map((loc, idx) => (
                  <option key={idx} value={idx}>{loc.label}</option>
                ))}
              </select>
            </div>

            {weatherLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>Loading weather data...</div>
            ) : weatherData && weatherData.current ? (
              activeWeatherTab === 'current' ? (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  {/* Agricultural Advisory */}
                  <div style={{
                    flex: '1 1 100%',
                    maxWidth: '800px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: 'white',
                    border: '1px solid #eef2f6',
                    borderTop: '4px solid #1b5e20',
                    borderRadius: '12px',
                    padding: '20px',
                    color: '#1e293b',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eef2f6', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', background: '#e8f5e9', color: '#1b5e20' }}>
                          <ShieldCheck size={24} />
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1b5e20' }}>Agricultural Advisory</span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>NOAA GFS Reanalysis & Alerts</span>
                        </div>
                      </div>
                      {effectiveGeeWeatherData && (
                        <span style={{ fontSize: '0.6rem', background: effectiveGeeWeatherData.isSimulated ? '#fff3e0' : '#e8f5e9', padding: '2px 6px', borderRadius: '4px', color: effectiveGeeWeatherData.isSimulated ? '#e65100' : '#2e7d32', fontWeight: 600 }}>
                          {effectiveGeeWeatherData.isSimulated ? 'Simulated' : 'Verified GEE'}
                        </span>
                      )}
                    </div>

                    {effectiveGeeWeatherLoading ? (
                      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '40px 0', fontSize: '0.85rem', color: '#888' }}>
                        Fetching GEE weather & agricultural alerts...
                      </div>
                    ) : effectiveGeeWeatherData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Metrics Grid Row 1 (Temp, Rain, Wind) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                          {/* Temp Card */}
                          <div style={{ background: 'white', border: '1px solid #ffcc80', padding: '16px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(230,81,0,0.03)' }}>
                            <Thermometer size={32} color="#e65100" />
                            <span style={{ fontSize: '0.75rem', color: '#8c3d00', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temp</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#e65100' }}>{Math.round(effectiveGeeWeatherData.temperature * 1.8 + 32)}°F</span>
                              <span style={{ fontSize: '0.75rem', color: '#757575', fontWeight: 500 }}>{effectiveGeeWeatherData.temperature}°C</span>
                            </div>
                          </div>

                          {/* Rain Card */}
                          <div style={{ background: 'white', border: '1px solid #90caf9', padding: '16px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', justifyContent: 'center', boxShadow: '0 2px 8px rgba(21,101,192,0.03)' }}>
                            <CloudRain size={32} color="#1565c0" />
                            <span style={{ fontSize: '0.75rem', color: '#0d47a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rain</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1565c0' }}>{effectiveGeeWeatherData.precipitation} mm</span>
                          </div>

                          {/* Wind Card */}
                          <div style={{ background: 'white', border: '1px solid #81d4fa', padding: '16px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(2,136,209,0.03)' }}>
                            <Wind size={32} color="#0288d1" />
                            <span style={{ fontSize: '0.75rem', color: '#01579b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wind</span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0288d1' }}>{Math.round(effectiveGeeWeatherData.windSpeed * 3.6)} km/h</span>
                              <span style={{ fontSize: '0.75rem', color: '#757575', fontWeight: 500 }}>{effectiveGeeWeatherData.windSpeed} m/s</span>
                            </div>
                          </div>
                        </div>

                        {/* Metrics Grid Row 2 (Humidity, Clouds centered) */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', width: '100%', marginTop: '4px' }}>
                          {/* Humidity Card */}
                          <div style={{ flex: '0 1 calc((100% - 24px) / 3)', background: 'white', border: '1px solid #80deea', padding: '16px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,172,193,0.03)' }}>
                            <Droplet size={32} color="#00acc1" />
                            <span style={{ fontSize: '0.75rem', color: '#006064', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Humidity</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#00acc1' }}>{effectiveGeeWeatherData.humidity}%</span>
                          </div>

                          {/* Clouds Card */}
                          <div style={{ flex: '0 1 calc((100% - 24px) / 3)', background: 'white', border: '1px solid #b0bec5', padding: '16px 12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', justifyContent: 'center', boxShadow: '0 2px 8px rgba(84,110,122,0.03)' }}>
                            <Cloud size={32} color="#546e7a" />
                            <span style={{ fontSize: '0.75rem', color: '#263238', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clouds</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#546e7a' }}>{effectiveGeeWeatherData.clouds}%</span>
                          </div>
                        </div>

                        {/* Expected Time & Duration Banner */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', background: 'white', padding: '12px 16px', borderRadius: '10px', border: '1px solid #eef2f6', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px' }}>
                            <Clock size={16} color="#1b5e20" style={{ flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Expected Forecast Time</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{effectiveGeeWeatherData.dateStr}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 120px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Duration</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{effectiveGeeWeatherData.duration}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#c62828', fontSize: '0.8rem', padding: '10px 0' }}>
                        Failed to load NOAA GFS advisories.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* 7-Day Forecast Tab: Grouped by Mon-Thur and Fri-Sun with pronounced graphics */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>

                  {/* Monday - Thursday (Workdays) Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', background: '#e8f5e9', color: '#1b5e20' }}>
                        <Clock size={18} />
                      </span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1b5e20', margin: 0 }}>
                        Workdays (Monday - Thursday)
                      </h4>
                      <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, #c8e6c9, transparent)' }}></div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                      {(() => {
                        const items = [];
                        weatherData.daily?.time?.forEach((time, idx) => {
                          const date = new Date(time + 'T00:00:00');
                          const dayOfWeek = date.getDay(); // 0: Sun, 1: Mon, ..., 4: Thu, 5: Fri, 6: Sat
                          if (dayOfWeek >= 1 && dayOfWeek <= 4) {
                            items.push(renderForecastCard(time, idx, date, false));
                          }
                        });
                        return items.length > 0 ? items : (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', width: '100%', textAlign: 'center' }}>
                            No forecast days available for Monday - Thursday.
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Friday - Sunday (Weekend) Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', background: '#fff9e6', color: '#b58900' }}>
                        <Sun size={18} />
                      </span>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#b58900', margin: 0 }}>
                        Weekend (Friday - Sunday)
                      </h4>
                      <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, #ffe082, transparent)' }}></div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
                      {(() => {
                        const items = [];
                        weatherData.daily?.time?.forEach((time, idx) => {
                          const date = new Date(time + 'T00:00:00');
                          const dayOfWeek = date.getDay(); // 0: Sun, 1: Mon, ..., 4: Thu, 5: Fri, 6: Sat
                          if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
                            items.push(renderForecastCard(time, idx, date, true));
                          }
                        });
                        return items.length > 0 ? items : (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', width: '100%', textAlign: 'center' }}>
                            No forecast days available for Friday - Sunday.
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#f44336' }}>Failed to load weather data.</div>
            )}
          </CollapsibleCard>
        </div>
      )}

      {activeDashboardTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Active Assignments Progress */}
          <CollapsibleCard title="Assignments Progress" forceFullGrid>
            {(() => {
              const activeGoalIds = new Set(goals.filter(g => !g.completionDate).map(g => g.id));
              const activeObjIds = new Set(objectives.filter(o => !o.completionDate).map(o => o.id));
              const activePlanAssignments = assignments.filter(a => a.planningId && (activeGoalIds.has(a.planningId) || activeObjIds.has(a.planningId)));
              const sortedActivePlanAssignments = [...activePlanAssignments].sort((a, b) => (b.assignmentDate || '').localeCompare(a.assignmentDate || ''));

              const totalTasks = sortedActivePlanAssignments.length;
              const totalHours = sortedActivePlanAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
              const totalCost = sortedActivePlanAssignments.reduce((sum, a) => sum + getAssignmentCost(a), 0);

              const hasApprovalPermission = currentUser?.role === 'Admin' || currentUser?.canApprove;

              if (totalTasks === 0) {
                return (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                    No active tasks associated with active goals or objectives found.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {/* Summary row */}
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                      Active Tasks: {totalTasks}
                    </div>
                    <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                      Total Hours Spent: {totalHours.toFixed(1)} hrs
                    </div>
                    <div style={{ padding: '8px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.9rem', fontWeight: 600 }}>
                      Total Money Spent: ${totalCost.toFixed(2)}
                    </div>
                  </div>

                  {/* Flat table */}
                  <div style={{ overflowX: 'auto', margin: '0 -20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                      <thead>
                        <tr style={{ background: '#f5f7fa', borderBottom: '2px solid var(--color-border-light)' }}>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>Progress</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>Plan Health</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, width: '180px', minWidth: '180px', whiteSpace: 'nowrap' }}>Approval Status</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, width: '220px', minWidth: '220px', maxWidth: '220px' }}>Tasks</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>Target Asset</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>Plan Est. Hours</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 700 }}>Status</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>Start Date</th>
                          <th style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>Completion Date</th>
                          <th style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'top' }}>Hours Spent</th>
                          <th style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, verticalAlign: 'top' }}>Money Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedActivePlanAssignments.map(ass => {
                          const assProgress = ass.completedDate ? 100 : 0;
                          const assHours = parseFloat(ass.hours) || 0;
                          const assCost = getAssignmentCost(ass);
                          const reviewText = ass.reviewStatus || 'Pending Review';
                          const assStatus = ass.completedDate ? `Completed (${reviewText})` : `In Progress`;
                          let assBg = '#fff3e0';
                          let assFg = '#e65100';
                          if (ass.completedDate) {
                            if (reviewText === 'Complete' || reviewText === 'Satisfactory') {
                              assBg = '#e8f5e9';
                              assFg = '#2e7d32';
                            } else if (reviewText === 'Not Complete') {
                              assBg = '#ffebee';
                              assFg = '#c62828';
                            }
                          } else {
                            assBg = '#e3f2fd';
                            assFg = '#1565c0';
                          }

                          // Get linked plan info
                          const planGoal = goals.find(g => g.id === ass.planningId);
                          const planObj = planGoal ? null : objectives.find(o => o.id === ass.planningId);
                          const plan = planGoal || planObj;
                          const planEstHours = plan ? (parseFloat(plan.estimatedHours) || 0) : 0;

                          // Compute exceed estimate & overdue
                          let isExceedingEstimate = false;
                          let isOverdue = false;
                          if (plan) {
                            const planAssignments = assignments.filter(a => a.planningId === plan.id);
                            const totalPlanHours = planAssignments.reduce((sum, a) => sum + (parseFloat(a.hours) || 0), 0);
                            if (planEstHours > 0 && totalPlanHours > planEstHours) {
                              isExceedingEstimate = true;
                            }

                            const todayStr = new Date().toISOString().split('T')[0];
                            if (plan.toDate && todayStr > plan.toDate && !plan.completionDate) {
                              isOverdue = true;
                            }
                          }

                          return (
                            <tr key={ass.id} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff', verticalAlign: 'top' }}>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 800, fontSize: '0.95rem', verticalAlign: 'top' }}>
                                {assProgress}%
                              </td>
                              <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                {!plan ? '-' : (
                                  isExceedingEstimate && isOverdue ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c62828', fontWeight: 600, fontSize: '0.9rem' }} title="Exceeds estimated hours & past due date">
                                      <AlertTriangle size={18} color="#c62828" /> Critical
                                    </span>
                                  ) : isExceedingEstimate ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef6c00', fontWeight: 600, fontSize: '0.9rem' }} title="Total spent hours exceed estimate">
                                      <AlertTriangle size={18} color="#ef6c00" /> Over Hours
                                    </span>
                                  ) : isOverdue ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c62828', fontWeight: 600, fontSize: '0.9rem' }} title="Past planned complete date">
                                      <AlertCircle size={18} color="#c62828" /> Overdue
                                    </span>
                                  ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem' }} title="On schedule and within estimate">
                                      <ShieldCheck size={18} color="#2e7d32" /> On Track
                                    </span>
                                  )
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', width: '180px', minWidth: '180px', verticalAlign: 'top' }}>
                                <select
                                  value={ass.reviewStatus || 'Pending Review'}
                                  disabled={!hasApprovalPermission}
                                  onChange={(e) => {
                                    const newStatus = e.target.value;
                                    const updatedAss = { ...ass, reviewStatus: newStatus };
                                    dispatch(saveAssignment(updatedAss));
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    fontSize: '0.8rem',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: hasApprovalPermission ? '#fff' : '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 500,
                                    cursor: hasApprovalPermission ? 'pointer' : 'not-allowed'
                                  }}
                                >
                                  <option value="Pending Review">Pending Review</option>
                                  <option value="Complete">Complete</option>
                                  <option value="Satisfactory">Satisfactory</option>
                                  <option value="Not Complete">Not Complete</option>
                                </select>
                              </td>
                              <td style={{ padding: '12px 16px', width: '220px', minWidth: '220px', maxWidth: '220px', verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{ass.task}</span>
                                  <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Assigned: {ass.workers || renderWorkerNames(ass.workerIds)}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', fontWeight: 500, verticalAlign: 'top' }}>
                                {getTargetName(ass.fieldId)}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'top' }}>
                                {planEstHours > 0 ? `${planEstHours.toFixed(1)} hrs` : '-'}
                              </td>
                              <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                <span className="status-indicator" style={{
                                  background: assBg,
                                  color: assFg,
                                  fontWeight: 600,
                                  fontSize: '0.8rem'
                                }}>
                                  {assStatus}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{ass.assignmentDate || '-'}</td>
                              <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.85rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{ass.completedDate || '-'}</td>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 500, verticalAlign: 'top' }}>{assHours > 0 ? `${assHours.toFixed(1)} hrs` : '-'}</td>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, verticalAlign: 'top' }}>{assCost > 0 ? `$${assCost.toFixed(2)}` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CollapsibleCard>
        </div>
      )}

      {activeDashboardTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Incidents Feed Table */}
          <CollapsibleCard title="Active Incidents & Issues" forceFullGrid>
            <CrudTable
              data={[...incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''))}
              columns={incidentColumns}
              itemLabel="Incident"
              hideTitle
            />
          </CollapsibleCard>
        </div>
      )}

      {activeDashboardTab === 'deadlines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Deadlines Feed Table */}
          <CollapsibleCard title="Upcoming Deadlines" forceFullGrid>
            <CrudTable
              data={[...deadlines].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))}
              columns={deadlineColumns}
              itemLabel="Deadline"
              hideTitle
              rowStyle={(row) => ({ opacity: row.status === 'Resolved' ? 0.6 : 1 })}
            />
          </CollapsibleCard>
        </div>
      )}

      {activeDashboardTab === 'harvests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Harvests */}
          <CollapsibleCard title="Harvests" forceFullGrid>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '15px', background: '#f5f7fa', borderRadius: '8px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#555' }}>From:</label>
                  <input type="date" value={harvestFromDate} onChange={e => setHarvestFromDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#555' }}>To:</label>
                  <input type="date" value={harvestToDate} onChange={e => setHarvestToDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ minWidth: '200px', flex: '1 1 200px' }}>
                  <Select
                    isMulti
                    placeholder="Filter by specific crops..."
                    options={cropSelectOptions}
                    value={cropSelectOptions.filter(opt => selectedCropIds.includes(opt.value))}
                    onChange={(opts) => setSelectedCropIds(opts ? opts.map(o => o.value) : [])}
                    styles={{ control: (base) => ({ ...base, minHeight: '36px' }) }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', background: '#e0e0e0', padding: '4px', borderRadius: '6px' }}>
                <button onClick={() => setHarvestViewToggle('graph')} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: harvestViewToggle === 'graph' ? 'white' : 'transparent', fontWeight: harvestViewToggle === 'graph' ? 600 : 400, boxShadow: harvestViewToggle === 'graph' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', color: '#333' }}>Graph</button>
                <button onClick={() => setHarvestViewToggle('report')} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: harvestViewToggle === 'report' ? 'white' : 'transparent', fontWeight: harvestViewToggle === 'report' ? 600 : 400, boxShadow: harvestViewToggle === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', color: '#333' }}>Report</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ padding: '10px 15px', background: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9', color: '#2e7d32', fontSize: '1.05rem', minWidth: '200px' }}><strong style={{ color: '#1b5e20' }}>Total Harvest Yield:</strong> {totalHarvestAmount.toFixed(2)}</div>
              <div style={{ padding: '10px 15px', background: '#e8f5e9', borderRadius: '6px', border: '1px solid #c8e6c9', color: '#2e7d32', fontSize: '1.05rem', minWidth: '200px' }}><strong style={{ color: '#1b5e20' }}>Total Generated Sales:</strong> ${totalHarvestSales.toFixed(2)}</div>
            </div>

            {harvestViewToggle === 'graph' ? (
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="99%" height={350} minWidth={1} minHeight={1}>
                  <BarChart data={harvestByDay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f5f5f5' }} />
                    <Bar dataKey="yield" fill="#4caf50" radius={[4, 4, 0, 0]} barSize={32} name="Total Yield" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <CrudTable
                data={harvestReportData}
                columns={reportColumns}
                itemLabel="Harvest Record"
                maxHeight="350px"
              />
            )}
          </CollapsibleCard>
        </div>
      )}

      {activeDashboardTab === 'financials' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Finances (2 Week Segments) */}
          <CollapsibleCard title="Finances (2 Week Segments)">
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                <BarChart data={fortnightData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f5f5f5' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#2196f3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#f44336" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CollapsibleCard>

          {/* Side-by-side Pie Charts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            <div style={{ flex: '1 1 350px' }}>
              <CollapsibleCard title="Revenue by Category">
                <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie data={revPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {revPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val) => `$${val}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CollapsibleCard>
            </div>
            <div style={{ flex: '1 1 350px' }}>
              <CollapsibleCard title="Expenses by Category">
                <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                  <ResponsiveContainer width="99%" height={300} minWidth={1} minHeight={1}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie data={expPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {expPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val) => `$${val}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CollapsibleCard>
            </div>
          </div>

          {/* Monthly Financial Trend */}
          <CollapsibleCard title="Monthly Financial Trend" forceFullGrid>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="99%" height={350} minWidth={1} minHeight={1}>
                <LineChart data={monthData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip formatter={(val) => `$${val}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Revenue" stroke="#2196f3" activeDot={{ r: 8 }} strokeWidth={3} />
                  <Line type="monotone" dataKey="Expenses" stroke="#f44336" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CollapsibleCard>
        </div>
      )}
    </div>
  );
}
