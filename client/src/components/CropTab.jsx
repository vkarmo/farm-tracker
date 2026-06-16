import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addCrop, deleteCrop } from '../store/assetsSlice';
import { Leaf, X } from 'lucide-react';
import Select from 'react-select';
import CrudTable from './CrudTable';


const INIT_CROP = { sowType: 'Direct', fieldId: '', name: '', variety: '', plantingDate: '', expectedHarvest: '', seedingRate: '', targetYield: '', phHi: '', phLo: '', pestIds: [] };

export default function CropTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const pestsList = useSelector(state => state.pests?.list) || [];

  const [cropData, setCropData] = useState(INIT_CROP);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setCropData(INIT_CROP);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleEdit = (row) => {
    setCropData(row);
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

    resetForm();
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

  const pestOptions = pestsList.map(p => ({
    value: p.id,
    label: `${p.name} (${p.type})`
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%', maxWidth: '1520px', margin: '0 auto' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', background: '#f5f7fa' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('roster')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'roster' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'roster' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'roster' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            Sown Crops
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('entry')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'entry' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'entry' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'entry' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            {editingId ? 'Edit Crop Details' : 'Sow New Crop Batch'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId}
              data={crops}
              columns={columns}
              onEdit={handleEdit}
              onDelete={(id) => {
                dispatch(deleteCrop(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }}
              itemLabel="Crop"
              defaultSort={{ key: 'updatedAt', direction: 'desc' }}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Leaf size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Crop' : 'Save Crop Data'}
                </button>
              </div>
              <div className="form-group" style={{ background: '#f1f8e9', padding: '10px', borderRadius: '4px', border: '1px solid #c5e1a5', marginBottom: 15 }}>
                <label style={{ marginBottom: 8, display: 'block', fontWeight: 'bold' }}>Sowing Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'left', width: 'auto' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
                    <input style={{ width: 'auto' }} type="radio" value="Direct" checked={cropData.sowType === 'Direct'} onChange={() => setCropData({ ...cropData, sowType: 'Direct', fieldId: '' })} />
                    <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Direct Field Sow</label>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 'bold', fontSize: '20px', width: 'auto', height: '35px' }}>
                    <input style={{ width: 'auto' }} type="radio" value="Nursery" checked={cropData.sowType === 'Nursery'} onChange={() => setCropData({ ...cropData, sowType: 'Nursery', fieldId: '' })} />
                    <label style={{ marginBottom: '0px', width: 'auto', display: 'flex', alignItems: 'center' }}>Nursery Start</label>
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>{cropData.sowType === 'Direct' ? 'Target Destination Field (Optional)' : 'Target Nursery Bed / Tray (Optional)'}</label>
                  <select value={cropData.fieldId} onChange={e => setCropData({ ...cropData, fieldId: e.target.value })}>
                    <option value="">{cropData.sowType === 'Direct' ? 'Select a physical field...' : 'Select a configured nursery bed...'}</option>
                    {cropData.sowType === 'Direct'
                      ? [...fields].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name} ({f.year})</option>)
                      : [...nurseries].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(n => <option key={n.id} value={n.id}>{n.name} (Cap: {n.capacity})</option>)
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
                <div className="form-group">
                  <label>Optimum pH Low (PhLo)</label>
                  <input type="number" step="0.1" value={cropData.phLo} onChange={e => setCropData({ ...cropData, phLo: e.target.value })} placeholder="e.g. 5.5" />
                </div>
                <div className="form-group">
                  <label>Optimum pH High (PhHi)</label>
                  <input type="number" step="0.1" value={cropData.phHi} onChange={e => setCropData({ ...cropData, phHi: e.target.value })} placeholder="e.g. 6.8" />
                </div>
                <div className="form-group form-grid-full">
                  <label>Susceptible Pests & Diseases</label>
                  <Select
                    isMulti
                    options={pestOptions}
                    value={pestOptions.filter(opt => (cropData.pestIds || []).includes(opt.value))}
                    onChange={(opts) => setCropData({ ...cropData, pestIds: opts ? opts.map(o => o.value) : [] })}
                    placeholder="Search and attach pests..."
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
