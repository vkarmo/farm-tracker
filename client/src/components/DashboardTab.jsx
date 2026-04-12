import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Layers, Rabbit, DollarSign } from 'lucide-react';

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

  // Top-Level Metric Calculations
  const totalAcres = fields.reduce((sum, f) => sum + (parseFloat(f.size) || 0), 0);
  const activeCrops = crops.filter(c => c.status !== 'Harvested/Completed');
  
  const netGross = transactions.reduce((sum, tx) => {
    const val = parseFloat(tx.amount) || 0;
    return tx.txType === 'Sale' ? sum + val : sum - val;
  }, 0);

  // 1. Harvest by Day
  const harvestByDay = useMemo(() => {
    const map = {};
    harvests.forEach(h => {
      const d = h.date || 'Unknown';
      if(!map[d]) map[d] = { date: d, yield: 0 };
      map[d].yield += parseFloat(h.amount) || 0;
    });
    return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
  }, [harvests]);

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
      fortnightData: Object.values(fortnightMap).sort((a,b) => a.time.localeCompare(b.time)),
      monthData: Object.values(monthMap).sort((a,b) => a.time.localeCompare(b.time)),
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
    return dateB.localeCompare(dateA); // Descending
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Global Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: netGross >= 0 ? '#2e7d32' : '#d32f2f', color: 'white' }}><DollarSign/></div>
          <div><div style={{ fontSize: '0.85rem', color: '#666' }}>NET BALANCE</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>${netGross.toFixed(2)}</div></div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#1565c0', color: 'white' }}><Layers/></div>
          <div><div style={{ fontSize: '0.85rem', color: '#666' }}>ACREAGE</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalAcres.toFixed(1)} ac</div></div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#f57c00', color: 'white' }}><Rabbit/></div>
          <div><div style={{ fontSize: '0.85rem', color: '#666' }}>LIVESTOCK</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{livestock.length}</div></div>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #efefef', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: 12, borderRadius: '50%', background: '#6a1b9a', color: 'white' }}><TrendingUp/></div>
          <div><div style={{ fontSize: '0.85rem', color: '#666' }}>CROPS</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activeCrops.length}</div></div>
        </div>
      </div>

      {/* Incidents Feed Table */}
      <CollapsibleCard title="Active Incidents & Issues" forceFullGrid>
        <div style={{ overflowX: 'auto' }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Affected Asset</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No incidents reported.</td></tr>
              ) : (
                incidents.slice().sort((a,b) => b.date.localeCompare(a.date)).map(i => (
                  <tr key={i.id}>
                    <td>{i.date}</td>
                    <td>{i.title}</td>
                    <td>{i.associatedAsset || '-'}</td>
                    <td>
                      <span style={{ 
                        color: i.severity === 'High' ? '#c62828' : i.severity === 'Medium' ? '#f57c00' : '#4caf50',
                        fontWeight: 'bold' 
                      }}>{i.severity}</span>
                    </td>
                    <td>{i.resolutionStatus}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      {/* Deadlines Feed Table */}
      <CollapsibleCard title="Upcoming Deadlines" forceFullGrid>
        <div style={{ overflowX: 'auto' }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Due Date</th>
                <th>Title</th>
                <th>Category</th>
                <th>Responsible</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No upcoming deadlines.</td></tr>
              ) : (
                deadlines.slice().sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map(d => (
                  <tr key={d.id} style={{ opacity: d.status === 'Resolved' ? 0.6 : 1 }}>
                    <td>{d.dueDate}</td>
                    <td>{d.title}</td>
                    <td>{d.type}</td>
                    <td>{d.personResponsible || '-'}</td>
                    <td>
                      <span style={{ color: d.status === 'Overdue' ? '#c62828' : d.status === 'Resolved' ? '#2e7d32' : '#f57c00' }}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      {/* Activities Feed Table */}
      <CollapsibleCard title="Recent & Upcoming Activities" forceFullGrid>
        <div style={{ overflowX: 'auto' }}>
          <table className="crud-table">
            <thead>
              <tr>
                <th>Sev</th>
                <th>Task</th>
                <th>Target Asset</th>
                <th>Planned</th>
                <th>Executed</th>
                <th>Responsible</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length === 0 ? (
                <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No activities logged yet.</td></tr>
              ) : (
                sortedActivities.map(a => {
                  const sev = getSeverity(a);
                  return (
                    <tr key={a.id}>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: sev.color, margin: '0 auto' }} title={sev.title}></div>
                      </td>
                      <td>{a.type}</td>
                      <td>{getTargetName(a.targetId)}</td>
                      <td>{a.plannedDate || '-'}</td>
                      <td>{a.date || '-'}</td>
                      <td>{a.personResponsible || '-'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.notes}>{a.notes}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* Harvest by Day */}
        <CollapsibleCard title="Harvest by Day">
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={harvestByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: '#f5f5f5'}} />
                <Bar dataKey="yield" fill="#4caf50" radius={[4, 4, 0, 0]} barSize={32} name="Total Yield" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleCard>

        {/* Expenses and Revenue by 2 weeks */}
        <CollapsibleCard title="Finances (2 Week Segments)">
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fortnightData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: '#f5f5f5'}} />
                <Legend wrapperStyle={{fontSize: 12}} />
                <Bar dataKey="Revenue" fill="#2196f3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f44336" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CollapsibleCard>

        {/* Revenue by Category (Pie) */}
        <CollapsibleCard title="Revenue by Category">
          <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
