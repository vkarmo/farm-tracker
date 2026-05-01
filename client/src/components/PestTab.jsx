import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { savePest, removePest } from '../store/pestsSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import { Bug, X } from 'lucide-react';

const INIT_STATE = { name: '', type: 'Pest', description: '', treatment: '' };

export default function PestTab() {
  const dispatch = useDispatch();
  const pests = useSelector(state => state.pests?.list) || [];
  
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Name is required.");

    const payload = {
      ...formData,
      id: editingId || `pest_${Date.now()}`
    };

    dispatch(savePest(payload));
    dispatch(queueAction({ type: 'pests/savePest', payload, meta: { id: Date.now() } }));

    setFormData(INIT_STATE);
    setEditingId(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this entry?")) {
      dispatch(removePest(id));
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
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'description', header: 'Description' },
    { key: 'treatment', header: 'Treatment Protocol' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{editingId ? 'Edit Pest / Disease' : 'Add Pest / Disease'}</h2>
          {editingId && (
            <button onClick={() => { setEditingId(null); setFormData(INIT_STATE); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
              <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Aphids, Blight" required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                <option value="Pest">Pest</option>
                <option value="Disease">Disease</option>
              </select>
            </div>
            <div className="form-group form-grid-full">
              <label>Description / Symptoms</label>
              <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Yellowing leaves, spots, etc." />
            </div>
            <div className="form-group form-grid-full">
              <label>Treatment Protocol</label>
              <input type="text" value={formData.treatment} onChange={e => setFormData({ ...formData, treatment: e.target.value })} placeholder="Neem oil application, pruning, etc." />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
            <Bug size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
        </form>
      </div>

      <div className="card">
        <CrudTable 
          data={pests}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          itemLabel="Entry"
          defaultSort={{ key: 'name', direction: 'asc' }}
        />
      </div>
    </div>
  );
}
