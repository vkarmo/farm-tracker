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
  const [activeTab, setActiveTab] = useState('roster');

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
      id: editingId || `pest_${Date.now()}`
    };

    dispatch(savePest(payload));
    dispatch(queueAction({ type: 'pests/savePest', payload, meta: { id: Date.now() } }));

    resetForm();
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this entry?")) {
      dispatch(removePest(id));
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
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'description', header: 'Description' },
    { key: 'treatment', header: 'Treatment Protocol' }
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
            Pests & Diseases Catalog
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
            {editingId ? 'Edit Pest / Disease' : 'Add Pest / Disease'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId} 
              data={pests}
              columns={columns}
              onEdit={handleEdit}
              onDelete={handleDelete}
              itemLabel="Entry"
              defaultSort={{ key: 'name', direction: 'asc' }}
            />
          ) : (
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
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Bug size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Entry' : 'Save Entry'}
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
