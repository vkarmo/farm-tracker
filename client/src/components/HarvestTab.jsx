import React, { useState, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addHarvest, deleteHarvest } from '../store/assetsSlice';
import { BarChart as BarChartIcon, X, LineChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CrudTable from './CrudTable';

let isSubmitting = false;

export default function HarvestTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const harvests = useSelector(state => state.assets.harvests) || [];
  const units = useSelector(state => state.settings?.units) || ['lbs'];

  const INIT_HARVEST = { cropId: '', amount: '', unit: units[0] || 'lbs', date: new Date().toISOString().split('T')[0] };
  const [harvestData, setHarvestData] = useState(INIT_HARVEST);
  const [editingId, setEditingId] = useState(null);

  const [showGraph, setShowGraph] = useState(false);
  const [filterCropId, setFilterCropId] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const filteredHarvests = useMemo(() => {
    return harvests.filter(h => {
      if (filterCropId && h.cropId !== filterCropId) return false;
      return true;
    });
  }, [harvests, filterCropId]);

  const filteredHarvestByDay = useMemo(() => {
    const map = {};
    filteredHarvests.forEach(h => {
      if (filterFromDate && h.date < filterFromDate) return;
      if (filterToDate && h.date > filterToDate) return;

      const d = h.date || 'Unknown';
      if (!map[d]) map[d] = { date: d, yield: 0 };
      map[d].yield += parseFloat(h.amount) || 0;
    });
    return Object.values(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [filteredHarvests, filterFromDate, filterToDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
        if (!harvestData.cropId) return alert("Validation Error: Source Crop Batch is strictly required.");
    const parsedAmt = parseFloat(harvestData.amount);
    if (!harvestData.amount || isNaN(parsedAmt) || parsedAmt < 0) return alert("Validation Error: Harvest amount must be a valid positive number.");
    if (!harvestData.amount || !harvestData.cropId || !harvestData.date) return;

    if (editingId) {
      const updatedHarvest = { ...harvestData, id: editingId };
      dispatch(addHarvest(updatedHarvest)); // addHarvest acts as merge
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedHarvest }, meta: { id: Date.now() } }));
    } else {
      const newHarvest = { id: `h_${Date.now()}`, ...harvestData };
      dispatch(addHarvest(newHarvest));
      dispatch(queueAction({ type: 'assets/addHarvest', payload: newHarvest, meta: { id: Date.now() } }));
    }
    
    setHarvestData({...INIT_HARVEST, unit: units[0] || 'lbs', date: new Date().toISOString().split('T')[0]});
    setEditingId(null);
  };

  const columns = [
    { key: 'date', header: 'Date' },
    { 
      key: 'cropId', 
      header: 'Source Crop',
      render: (r) => {
        const c = crops.find(crop => crop.id === r.cropId);
        return c ? `${c.name} (${c.variety})` : 'Unknown';
      }
    },
    { key: 'amount', header: 'Yield Amount' },
    { key: 'unit', header: 'Unit' }
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Harvest Record' : 'Log Continuous Harvest'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setHarvestData({...INIT_HARVEST, unit: units[0] || 'lbs'}); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Date Harvested</label>
            <input type="date" value={harvestData.date} onChange={e => setHarvestData({...harvestData, date: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Source Crop Batch</label>
            <select value={harvestData.cropId} onChange={e => setHarvestData({...harvestData, cropId: e.target.value})}>
              <option value="">Select an active crop...</option>
              {[...crops].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => {
                let locationStr = 'Unassigned';
                if (c.fieldId) {
                  if (c.sowType === 'Nursery') {
                    locationStr = 'Nursery: ' + (nurseries.find(x => x.id === c.fieldId)?.name || 'Unknown');
                  } else {
                    locationStr = 'Field: ' + (fields.find(f => f.id === c.fieldId)?.name || 'Unknown');
                  }
                }
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.variety}) - Location: {locationStr}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group">
            <label>Amount Yielded</label>
            <input type="number" step="0.1" value={harvestData.amount} onChange={e => setHarvestData({...harvestData, amount: e.target.value})}/>
          </div>
          <div className="form-group">
            <label>Unit of Measurement</label>
            <select value={harvestData.unit} onChange={e => setHarvestData({...harvestData, unit: e.target.value})}>
              {[...units].sort((a,b) => (a || '').localeCompare(b || '')).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <button type="submit" className="btn btn-primary">
            <BarChartIcon size={16} style={{marginRight: 6}}/> {editingId ? 'Update Harvest' : 'Save Harvest Info'}
          </button>
          <button type="button" onClick={() => setShowGraph(!showGraph)} className="btn" style={{ background: '#e3f2fd', color: '#1565c0', display: 'flex', alignItems: 'center' }}>
            <LineChart size={16} style={{marginRight: 6}}/> {showGraph ? 'View Harvest Records' : 'View Harvest Graphs'}
          </button>
        </div>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
        {showGraph ? <h3 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>Harvest Yield Over Time</h3> : <div></div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={filterCropId} onChange={e => setFilterCropId(e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.9rem' }}>
            <option value="">All Source Crops...</option>
            {[...crops].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.variety})</option>
            ))}
          </select>
          {showGraph && (
            <>
              <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.9rem' }} title="From Date" />
              <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.9rem' }} title="To Date" />
            </>
          )}
        </div>
      </div>

      {!showGraph ? (
        <CrudTable 
          data={filteredHarvests} 
          columns={columns} 
          onEdit={(row) => { setHarvestData(row); setEditingId(row.id); }} 
          onDelete={(id) => {
            dispatch(deleteHarvest(id));
            dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
          }} 
          itemLabel="Harvest Record" 
          defaultSort={{ key: 'date', direction: 'desc' }}
        />
      ) : (
        <div className="card" style={{ background: '#fafafa', border: '1px solid var(--color-border)' }}>
          <div style={{ width: '100%', height: 350 }}>
            {filteredHarvestByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredHarvestByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: '#f5f5f5' }} />
                  <Bar dataKey="yield" fill="#4caf50" radius={[4, 4, 0, 0]} barSize={32} name="Total Yield" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontStyle: 'italic', background: '#fff', borderRadius: 8, border: '1px dashed #ccc' }}>
                No harvest data matches your current filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
