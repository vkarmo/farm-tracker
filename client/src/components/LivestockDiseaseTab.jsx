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

  const animalTypeOptions = animalTypeOptionsRaw.map(t => ({ value: t, label: t }));

  const handleSubmit = (e) => {
    e.preventDefault();
        if (!formData.name.trim()) return alert("Name is required.");

    const payload = {
      ...formData,
      id: editingId || `ldisease_${Date.now()}`
    };

    dispatch(saveDisease(payload));
    dispatch(queueAction({ type: 'livestockDiseases/saveDisease', payload, meta: { id: Date.now() } }));

    setFormData(INIT_STATE);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this livestock disease entry?")) {
      dispatch(removeDisease(id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
      if (editingId === id) {
        setFormData(INIT_STATE);
        setEditingId(null);
      }
    }
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
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
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{editingId ? 'Edit Livestock Disease' : 'Add Livestock Disease'}</h2>
          {editingId && (
            <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
              <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
            </button>
          )}
        </div>
        
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
          <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
            <Syringe size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
        </form>
      </div>

      <div className="card">
        <CrudTable 
          data={diseases}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          itemLabel="Disease"
          defaultSort={{ key: 'name', direction: 'asc' }}
        />
      </div>
    </div>
  );
}
