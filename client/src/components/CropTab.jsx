import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addCrop, deleteCrop } from '../store/assetsSlice';
import { Leaf, X } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_CROP = { sowType: 'Direct', fieldId: '', name: '', variety: '', plantingDate: '', expectedHarvest: '', seedingRate: '', targetYield: '' };

export default function CropTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];

  const [cropData, setCropData] = useState(INIT_CROP);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cropData.name || !cropData.name.trim()) return alert("Validation Error: Crop Name is required to initialize a batch.");
    if (!cropData.sowType || !cropData.sowType.trim()) return alert("Validation Error: Sowing Strategy is required.");

    if (editingId) {
      const updatedCrop = { ...cropData, id: editingId };
      dispatch(addCrop(updatedCrop)); // addCrop does array replacement
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedCrop }, meta: { id: Date.now() } }));
    } else {
      const newCrop = { id: `c_${Date.now()}`, ...cropData };
      dispatch(addCrop(newCrop));
      dispatch(queueAction({ type: 'assets/addCrop', payload: newCrop, meta: { id: Date.now() } }));
    }

    setCropData(INIT_CROP);
    setEditingId(null);
  };

  const columns = [
    { key: 'name', header: 'Crop Name' },
    { key: 'variety', header: 'Variety' },
    { key: 'sowType', header: 'Status' },
    {
      key: 'fieldId',
      header: 'Location',
      render: (row) => {
        let name = "Unknown";
        if (row.sowType === 'Nursery') {
          name = nurseries.find(n => n.id === row.fieldId)?.name || row.fieldId;
        } else {
          name = fields.find(f => f.id === row.fieldId)?.name || row.fieldId;
        }
        return name;
      }
    },
    { key: 'expectedHarvest', header: 'Est. Harvest' }
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Crop Details' : 'Sow New Crop Batch'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setCropData(INIT_CROP); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ background: '#f1f8e9', padding: '10px', borderRadius: '4px', border: '1px solid #c5e1a5', marginBottom: 15 }}>
          <label style={{ marginBottom: 8, display: 'block', fontWeight: 'bold' }}>Sowing Strategy</label>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'left', width: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
              <input style={{ width: 'auto' }} type="radio" value="Direct" checked={cropData.sowType === 'Direct'} onChange={() => setCropData({ ...cropData, sowType: 'Direct', fieldId: '' })} />
              <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Direct Field Sow</label>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
              <input style={{ width: 'auto' }} type="radio" value="Nursery" checked={cropData.sowType === 'Nursery'} onChange={() => setCropData({ ...cropData, sowType: 'Nursery', fieldId: '' })} />
              <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Nursery/Greenhouse Start</label>
            </label>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group form-grid-full">
            <label>{cropData.sowType === 'Direct' ? 'Target Destination Field (Optional)' : 'Target Nursery Bed / Tray (Optional)'}</label>
            <select value={cropData.fieldId} onChange={e => setCropData({ ...cropData, fieldId: e.target.value })}>
              <option value="">{cropData.sowType === 'Direct' ? 'Select a physical field...' : 'Select a configured nursery bed...'}</option>
              {cropData.sowType === 'Direct'
                ? [...fields].sort((a,b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name} ({f.year})</option>)
                : [...nurseries].sort((a,b) => a.name.localeCompare(b.name)).map(n => <option key={n.id} value={n.id}>{n.name} (Cap: {n.capacity})</option>)
              }
            </select>
          </div>
          <div className="form-group">
            <label>Crop / Seed Name</label>
            <input type="text" value={cropData.name} onChange={e => setCropData({ ...cropData, name: e.target.value })} placeholder="Tomato" />
          </div>
          <div className="form-group">
            <label>Seed Variety / Cultivar</label>
            <input type="text" value={cropData.variety} onChange={e => setCropData({ ...cropData, variety: e.target.value })} placeholder="Roma VF" />
          </div>
          <div className="form-group">
            <label>{cropData.sowType === 'Direct' ? 'Planting Date' : 'Sowing Date'}</label>
            <input type="date" value={cropData.plantingDate} onChange={e => setCropData({ ...cropData, plantingDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Expected Harvest Target</label>
            <input type="date" value={cropData.expectedHarvest} onChange={e => setCropData({ ...cropData, expectedHarvest: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Seeding Rate {cropData.sowType === 'Nursery' && '(Plugs)'}</label>
            <input type="number" step="0.1" value={cropData.seedingRate} onChange={e => setCropData({ ...cropData, seedingRate: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Target Yield Output</label>
            <input type="text" value={cropData.targetYield} onChange={e => setCropData({ ...cropData, targetYield: e.target.value })} placeholder="e.g. 200 bu" />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          <Leaf size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Crop' : 'Save Crop Data'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable
        data={crops}
        columns={columns}
        onEdit={(row) => { setCropData(row); setEditingId(row.id); }}
        onDelete={(id) => {
          dispatch(deleteCrop(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }}
        itemLabel="Crop"
      />
    </div>
  );
}
