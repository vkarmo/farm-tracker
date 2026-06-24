import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { savePest, removePest } from '../store/pestsSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import { setAiProvider, saveSettings } from '../store/settingsSlice';
import { Bug, X, Sparkles, ShieldAlert } from 'lucide-react';


const INIT_STATE = { name: '', type: 'Pest', description: '', treatment: '' };

export default function PestTab() {
  const dispatch = useDispatch();
  const pests = useSelector(state => state.pests?.list) || [];
  const currentUser = useSelector(state => state.auth?.currentUser);
  const aiProvider = useSelector(state => state.settings?.aiProvider) || 'gemini';
  
  const [formData, setFormData] = useState(INIT_STATE);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');
  const [isRetrieving, setIsRetrieving] = useState(false);

  const resetForm = () => {
    setFormData(INIT_STATE);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleAiRetrieve = async () => {
    setIsRetrieving(true);
    try {
      const activeFarmId = localStorage.getItem('activeFarmId') || 'default_farm';
      const email = currentUser?.email || '';

      const response = await fetch('/api/pests/retrieve-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmId: activeFarmId, email })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to retrieve AI data.');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.added)) {
        if (data.added.length === 0) {
          alert("All pests retrieved by AI already exist in your catalog. No new entries were added.");
        } else {
          data.added.forEach(pest => {
            dispatch(savePest(pest));
          });
          alert(`Successfully retrieved and imported ${data.added.length} new pests/diseases from AI!`);
        }
      } else {
        throw new Error('Invalid response from server.');
      }
    } catch (err) {
      console.error(err);
      alert(`AI Retrieve Error: ${err.message}`);
    } finally {
      setIsRetrieving(false);
    }
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
    { 
      key: 'name', 
      header: 'Name',
      style: { width: '180px', minWidth: '150px', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' },
      render: (row) => (
        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3' }}>
          {row.name}
        </div>
      )
    },
    { 
      key: 'type', 
      header: 'Type',
      style: { width: '80px', textAlign: 'center' },
      render: (row) => {
        const isPest = row.type && row.type.toLowerCase() === 'pest';
        return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} title={row.type}>
            {isPest ? (
              <Bug size={18} color="#e65100" style={{ cursor: 'help' }} />
            ) : (
              <ShieldAlert size={18} color="#d32f2f" style={{ cursor: 'help' }} />
            )}
          </div>
        );
      }
    },
    { 
      key: 'description', 
      header: 'Description',
      style: { whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' },
      render: (row) => (
        <div style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: '1.4' }}>
          {row.description}
        </div>
      )
    },
    { 
      key: 'treatment', 
      header: 'Treatment Protocol',
      style: { whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' },
      render: (row) => (
        <div style={{ whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: '1.4' }}>
          {row.treatment}
        </div>
      )
    }
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
            <>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '15px', 
                flexWrap: 'wrap' 
              }}>
                <select 
                  value={aiProvider} 
                  onChange={(e) => { 
                    dispatch(setAiProvider(e.target.value)); 
                    dispatch(saveSettings()); 
                  }}
                  disabled={currentUser?.role === 'Admin Viewer'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border, #ccc)',
                    fontSize: '0.88rem',
                    background: 'white',
                    minWidth: '160px',
                    height: '36px',
                    outline: 'none',
                    cursor: currentUser?.role === 'Admin Viewer' ? 'not-allowed' : 'pointer'
                  }}
                  className="pest-ai-provider-select"
                >
                  <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                  <option value="claude">Anthropic Claude (claude-3-5-sonnet)</option>
                </select>
                
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAiRetrieve}
                  disabled={isRetrieving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '36px',
                    opacity: isRetrieving ? 0.7 : 1,
                    cursor: isRetrieving ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={15} />
                  {isRetrieving ? 'Retrieving...' : 'AI Retrieve'}
                </button>
              </div>

              <CrudTable activeRowId={editingId} 
                data={pests}
                columns={columns}
                onEdit={handleEdit}
                onDelete={handleDelete}
                itemLabel="Entry"
                defaultSort={{ key: 'name', direction: 'asc' }}
              />
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Bug size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
