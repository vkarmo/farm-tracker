import React, { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Select from 'react-select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Layers, Rabbit, DollarSign, Sun, CloudRain, Cloud, CloudLightning, Snowflake, CloudFog, MapPin, Droplets, Wind, ThermometerSun, CloudSun } from 'lucide-react';
import CrudTable from './CrudTable';


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
  const fields = useSelector(state => state.fields.data) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const transactions = useSelector(state => state.financials.transactions) || [];
  const activities = useSelector(state => state.activities?.log) || [];
  const deadlines = useSelector(state => state.deadlines?.list) || [];
  const incidents = useSelector(state => state.incidents?.list) || [];

  const mapCenter = useSelector(state => state.settings?.mapCenter) || [51.505, -0.09];

  const [selectedLocIndex, setSelectedLocIndex] = useState(0);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [selectedCropIds, setSelectedCropIds] = useState([]);
  const [harvestFromDate, setHarvestFromDate] = useState('');
  const [harvestToDate, setHarvestToDate] = useState('');
  const [harvestViewToggle, setHarvestViewToggle] = useState('graph');

  const weatherLocations = useMemo(() => [
    { label: 'Default Farm Location', coords: mapCenter },
    { label: 'Bomi County, Liberia', coords: [6.7319579, -10.8700117] }
  ].sort((a,b) => (a.label || '').localeCompare(b.label || '')), [mapCenter]);

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
    if (code >= 71 && code <= 82) return 'Snow';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  // Top-Level Metric Calculations
  const totalAcres = fields.reduce((sum, f) => sum + (parseFloat(f.area) || 0), 0);
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
    return crops.filter(c => cropIds.has(c.id)).sort((a,b) => (a.name || '').localeCompare(b.name || ''));
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
    }).sort((a,b) => (b.date || '').localeCompare(a.date || ''));
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
    { key: 'severity', header: 'Severity', render: (r) => (
      <span style={{
        color: r.severity === 'High' ? '#c62828' : r.severity === 'Medium' ? '#f57c00' : '#4caf50',
        fontWeight: 'bold'
      }}>{r.severity}</span>
    )},
    { key: 'resolutionStatus', header: 'Status' }
  ];

  const deadlineColumns = [
    { key: 'dueDate', header: 'Due Date' },
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Category' },
    { key: 'personResponsible', header: 'Responsible', render: (r) => r.personResponsible || '-' },
    { key: 'status', header: 'Status', render: (r) => (
      <span style={{ color: r.status === 'Overdue' ? '#c62828' : r.status === 'Resolved' ? '#2e7d32' : '#f57c00' }}>
        {r.status}
      </span>
    )}
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 1. Global Metric Cards */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: 10, borderRadius: '50%', background: netGross >= 0 ? '#2e7d32' : '#d32f2f', color: 'white', display: 'flex' }}><DollarSign size={20} /></div>
            <div><div style={{ fontSize: '0.75rem', color: '#666', whiteSpace: 'nowrap' }}>NET BALANCE</div><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>${netGross.toFixed(2)}</div></div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: 10, borderRadius: '50%', background: '#1565c0', color: 'white', display: 'flex' }}><Layers size={20} /></div>
            <div><div style={{ fontSize: '0.75rem', color: '#666' }}>ACREAGE</div><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalAcres.toFixed(1)} ac</div></div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: 10, borderRadius: '50%', background: '#f57c00', color: 'white', display: 'flex' }}><Rabbit size={20} /></div>
            <div><div style={{ fontSize: '0.75rem', color: '#666' }}>LIVESTOCK</div><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeLivestock.length}</div></div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '12px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: 10, borderRadius: '50%', background: '#6a1b9a', color: 'white', display: 'flex' }}><TrendingUp size={20} /></div>
            <div><div style={{ fontSize: '0.75rem', color: '#666' }}>CROPS</div><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{activeCrops.length}</div></div>
          </div>
        </div>
      </div>

      {/* Weather Forecast Widget */}
      <CollapsibleCard title="Current Weather & Forecast">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
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
          <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading weather data...</div>
        ) : weatherData && weatherData.current ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa', padding: '20px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getWeatherIcon(weatherData.current.weather_code, weatherData.current.temperature_2m, 48)}
                <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                  {Math.round(weatherData.current.temperature_2m)}°F
                </div>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#555', marginTop: '10px' }}>
                {getWeatherDescription(weatherData.current.weather_code)}
              </div>
              <div style={{ display: 'flex', gap: '15px', marginTop: '15px', fontSize: '0.9rem', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Droplets size={16} color="#1e88e5" /> {weatherData.current.relative_humidity_2m}% Humidity</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Wind size={16} color="#78909c" /> {weatherData.current.wind_speed_10m} km/h</div>
              </div>
            </div>
            <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#666', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>7-Day Forecast</h4>
              <div style={{ display: 'flex', justifyContent: 'flex-start', overflowX: 'auto', gap: '15px', paddingBottom: '10px', width: '100%' }}>
                {weatherData.daily?.time?.map((time, idx) => {
                  if (idx === 0) return null; // Skip today since we show it large
                  const date = new Date(time);
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  return (
                    <div key={time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555' }}>{dayName}</div>
                      <div style={{ margin: '8px 0' }}>{getWeatherIcon(weatherData.daily.weather_code[idx], weatherData.daily.temperature_2m_max[idx], 24)}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{Math.round(weatherData.daily.temperature_2m_max[idx])}°</div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{Math.round(weatherData.daily.temperature_2m_min[idx])}°</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#f44336' }}>Failed to load weather data.</div>
        )}
      </CollapsibleCard>

      {/* Incidents Feed Table */}
      <CollapsibleCard title="Active Incidents & Issues" forceFullGrid>
        <CrudTable 
          data={[...incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''))}
          columns={incidentColumns}
          itemLabel="Incident"
          customTitle="Active Incidents & Issues"
        />
      </CollapsibleCard>

      {/* Deadlines Feed Table */}
      <CollapsibleCard title="Upcoming Deadlines" forceFullGrid>
        <CrudTable 
          data={[...deadlines].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))}
          columns={deadlineColumns}
          itemLabel="Deadline"
          customTitle="Upcoming Deadlines"
          rowStyle={(row) => ({ opacity: row.status === 'Resolved' ? 0.6 : 1 })}
        />
      </CollapsibleCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Harvest by Day Graph and Report */}
        <CollapsibleCard title="Harvest Analysis" forceFullGrid>
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
              <div style={{ minWidth: '300px' }}>
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

        {/* Expenses and Revenue by 2 weeks */}
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

        {/* Revenue by Category (Pie) */}
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

        {/* Expenses by Category (Pie) */}
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

        {/* Monthly Revenue & Expenses (Line) */}
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
    </div>
  );
}
