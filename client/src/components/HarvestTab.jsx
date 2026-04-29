import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addHarvest, deleteHarvest } from '../store/assetsSlice';
import { BarChart, X } from 'lucide-react';
import CrudTable from './CrudTable';

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

  const handleSubmit = (e) => {
    e.preventDefault();
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
              {[...crops].sort((a,b) => a.name.localeCompare(b.name)).map(c => {
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
              {[...units].sort((a,b) => a.localeCompare(b)).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{marginTop: 10}}>
          <BarChart size={16} style={{marginRight: 6}}/> {editingId ? 'Update Harvest' : 'Save Harvest Info'}
        </button>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <CrudTable 
        data={harvests} 
        columns={columns} 
        onEdit={(row) => { setHarvestData(row); setEditingId(row.id); }} 
        onDelete={(id) => {
          dispatch(deleteHarvest(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Harvest Pull" 
      />
    </div>
  );
}
