import React from 'react';
import { useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, AlertTriangle, Layers, Rabbit, DollarSign } from 'lucide-react';

export default function DashboardTab() {
  const fields = useSelector(state => state.fields.data) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const transactions = useSelector(state => state.financials.transactions) || [];

  // Top-Level Metric Calculations
  const totalAcres = fields.reduce((sum, f) => sum + (parseFloat(f.size) || 0), 0);
  const activeCrops = crops.filter(c => c.status !== 'Harvested/Completed');
  
  const netGross = transactions.reduce((sum, tx) => {
    const val = parseFloat(tx.amount) || 0;
    return tx.txType === 'Sale' ? sum + val : sum - val;
  }, 0);

  // Harvest Yield Computations for BarChart
  // Group all harvest amounts by the name of the crop
  const yieldAnalyticsMap = harvests.reduce((acc, h) => {
    const targetCrop = crops.find(c => c.id === h.cropId);
    const label = targetCrop ? `${targetCrop.name} (${targetCrop.variety})` : 'Unassigned/Deleted Source';
    if (!acc[label]) acc[label] = { name: label, Yield: 0 };
    acc[label].Yield += (parseFloat(h.amount) || 0);
    return acc;
  }, {});
  const yieldData = Object.values(yieldAnalyticsMap).sort((a,b) => b.Yield - a.Yield);

  // Livestock Threat Pipeline
  const medicalThreats = livestock.filter(l => l.healthStatus === 'Sick' || l.healthStatus === 'Injured' || l.healthStatus === 'Critical');

  // Mini Metric Card UI Component
  const MetricCard = ({ title, value, icon, color }) => (
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #efefef', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#333' }}>{value}</div>
      </div>
    </div>
  );

  // Dynamic Threat Colors
  let threatColor = '#2e7d32'; // Green (No threats)
  let threatBg = '#e8f5e9';
  let threatBorder = '#c8e6c9';
  
  if (medicalThreats.length > 0) {
    if (medicalThreats.some(t => t.healthStatus === 'Critical')) {
      threatColor = '#c62828'; // Red (Critical present)
      threatBg = '#ffebee';
      threatBorder = '#ffcdd2';
    } else if (medicalThreats.length >= 3) {
      threatColor = '#e65100'; // Orange (3+ ongoing threats)
      threatBg = '#fff3e0';
      threatBorder = '#ffe0b2';
    } else {
      threatColor = '#f57f17'; // Yellow/Amber (1-2 non-criticals)
      threatBg = '#fffde7';
      threatBorder = '#fff59d';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Global Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <MetricCard title="Net Balance" value={`$${netGross.toFixed(2)}`} icon={<DollarSign size={24}/>} color={netGross >= 0 ? '#2e7d32' : '#d32f2f'} />
        <MetricCard title="Active Acreage" value={`${totalAcres.toFixed(1)} ac`} icon={<Layers size={24}/>} color="#1565c0" />
        <MetricCard title="Livestock Head Count" value={livestock.length} icon={<Rabbit size={24}/>} color="#f57c00" />
        <MetricCard title="Active Crop Batches" value={activeCrops.length} icon={<TrendingUp size={24}/>} color="#6a1b9a" />
      </div>

      <div className="form-grid">
        {/* 2. Recharts Yield Visualizer */}
        <div className="card form-grid-full" style={{ marginBottom: 0 }}>
          <h3 style={{ marginBottom: '20px', color: '#333', fontSize: '1.05rem', borderBottom: '2px solid #efefef', paddingBottom: '10px' }}>Lifetime Harvest Yield Distribution</h3>
          {yieldData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888', fontStyle: 'italic', background: '#fafafa', borderRadius: '8px' }}>
              No harvests recorded yet. Log your first harvest to generate production algorithms.
            </div>
          ) : (
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yieldData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{fontSize: 12}} />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 11}} width={120} />
                  <Tooltip cursor={{fill: '#f5f5f5'}} />
                  <Legend wrapperStyle={{fontSize: 12}} />
                  <Bar dataKey="Yield" fill="#2e7d32" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Operational Threat Radar */}
        <div className="card form-grid-full" style={{ marginBottom: 0, border: `1px solid ${threatBorder}`, background: threatBg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <AlertTriangle size={20} color={threatColor} />
            <h3 style={{ margin: 0, color: threatColor, fontSize: '1.05rem' }}>Active Medical Threats</h3>
          </div>
          
          {medicalThreats.length === 0 ? (
            <p style={{ color: '#2e7d32', fontSize: '0.9rem', fontWeight: 500 }}>All livestock registries are currently reporting healthy statuses. No critical interventions required.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {medicalThreats.map(threat => (
                <div key={threat.id} style={{ background: 'white', padding: '12px', borderRadius: '6px', borderLeft: `4px solid ${threat.healthStatus === 'Critical' ? '#d32f2f' : '#f57c00'}` }}>
                  <div style={{ fontWeight: 600, color: '#333' }}>{threat.type} - Tag #{threat.tagNumber}</div>
                  <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>Status:</span> {threat.healthStatus} 
                    {threat.causeOfDeath && <span style={{marginLeft: 8, color: '#d32f2f'}}>(Warning: {threat.causeOfDeath})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
