import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { saveDisease, removeDisease } from '../store/livestockDiseasesSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import Select from 'react-select';
import { Syringe, X } from 'lucide-react';


const INIT_STATE = { name: '', description: '', treatment: '', animalTypes: [] };

export default function LivestockDiseaseTab() {
  const dispatch = useDispatch();
  const diseases = useSelector(state => state.livestockDiseases?.list) || [];
  const animalTypeOptionsRaw = useSelector(state => state.settings?.animalTypes) || [];
  
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const animalTypeOptions = animalTypeOptionsRaw.map(t => ({ value: t, label: t }));

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Name is required.");

    const payload = {
      ...formData,
      id: editingId || `ldisease_${Date.now()}`
    };

    dispatch(saveDisease(payload));
    dispatch(queueAction({ type: 'livestockDiseases/saveDisease', payload, meta: { id: Date.now() } }));

    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this livestock disease entry?")) {
      dispatch(removeDisease(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) resetForm();
    }
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const columns = [
    { key: 'name', header: 'Disease Name' },
    { key: 'description', header: 'Description' },
    { key: 'treatment', header: 'Treatment Protocol' },
    { key: 'animalTypes', header: 'Susceptible Types', render: (r) => (r.animalTypes || []).join(', ') }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
            Disease Catalog
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
            {editingId ? 'Edit Livestock Disease' : 'Add Livestock Disease'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId} 
              data={diseases}
              columns={columns}
              onEdit={handleEdit}
              onDelete={handleDelete}
              itemLabel="Disease"
              defaultSort={{ key: 'name', direction: 'asc' }}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Foot and Mouth Disease, Mastitis" required />
                </div>
                <div className="form-group form-grid-full">
                  <label>Description / Symptoms</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Fever, blisters, lameness, etc." />
                </div>
                <div className="form-group form-grid-full">
                  <label>Treatment Protocol</label>
                  <input type="text" value={formData.treatment} onChange={e => setFormData({ ...formData, treatment: e.target.value })} placeholder="Quarantine, vaccination, antibiotics, etc." />
                </div>
                <div className="form-group form-grid-full">
                  <label>Susceptible Animal Types</label>
                  <Select
                    isMulti
                    options={animalTypeOptions}
                    value={animalTypeOptions.filter(opt => (formData.animalTypes || []).includes(opt.value))}
                    onChange={(opts) => setFormData({ ...formData, animalTypes: opts ? opts.map(o => o.value) : [] })}
                    placeholder="Select affected types..."
                  />
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Syringe size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Entry' : 'Save Entry'}
                </button>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
