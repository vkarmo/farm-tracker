import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { savePest, removePest } from '../store/pestsSlice';
import { queueAction } from '../store/syncSlice';
import CrudTable from './CrudTable';
import { setAiProvider, saveSettings } from '../store/settingsSlice';
import { Bug, X, Sparkles, ShieldAlert, Search, HeartHandshake, Sprout } from 'lucide-react';


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

  const [matrixData, setMatrixData] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixError, setMatrixError] = useState(null);
  const [matrixSearch, setMatrixSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'matrix') {
      setLoadingMatrix(true);
      setMatrixError(null);
      fetch('/api/pests/relationships')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch treatment matrix');
          return res.json();
        })
        .then(data => {
          setMatrixData(data);
          setLoadingMatrix(false);
        })
        .catch(err => {
          console.error(err);
          setMatrixError(err.message);
          setLoadingMatrix(false);
        });
    }
  }, [activeTab]);

  const filteredMatrix = (matrixData || []).filter(item => {
    if (!item) return false;
    const q = (matrixSearch || '').toLowerCase();
    const pestName = (item.pestName || '').toLowerCase();
    const remedies = Array.isArray(item.remedies) ? item.remedies : [];
    const crops = Array.isArray(item.crops) ? item.crops : [];
    
    return (
      pestName.includes(q) ||
      remedies.some(r => r && r.toLowerCase().includes(q)) ||
      crops.some(c => c && c.toLowerCase().includes(q))
    );
  });

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
            onClick={() => setActiveTab('matrix')} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              border: 'none', 
              background: activeTab === 'matrix' ? 'white' : 'transparent', 
              borderBottom: activeTab === 'matrix' ? '3px solid var(--color-primary)' : 'none',
              color: activeTab === 'matrix' ? 'var(--color-primary)' : 'var(--color-text-light)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.95rem'
            }}
          >
            Treatment Matrix
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
          {activeTab === 'roster' && (
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
          )}

          {activeTab === 'matrix' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--color-border, #ccc)' }}>
                <Search size={16} color="#666" />
                <input
                  type="text"
                  placeholder="Search by pest, crop, or remedy..."
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  style={{ border: 'none', width: '100%', outline: 'none', fontSize: '0.9rem' }}
                />
                {matrixSearch && (
                  <button type="button" onClick={() => setMatrixSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                    <X size={16} />
                  </button>
                )}
              </div>

              {loadingMatrix ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  Loading treatment relationships...
                </div>
              ) : matrixError ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#c62828', background: '#ffebee', borderRadius: '6px' }}>
                  Error loading treatment matrix: {matrixError}
                </div>
              ) : filteredMatrix.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  No relationship mapping found matching your search.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {filteredMatrix.map((item, idx) => (
                    <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                        <Bug size={18} color="#e65100" />
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{item.pestName}</h4>
                      </div>
                      
                      {/* Crops Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sprout size={12} /> Affected Crops
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                          {item.crops && item.crops.length > 0 ? (
                            item.crops.map((c, i) => (
                              <span key={i} style={{ background: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>{c}</span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#94a3b8' }}>None linked</span>
                          )}
                        </div>
                      </div>

                      {/* Remedies Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <HeartHandshake size={12} /> Target Remedies
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                          {item.remedies && item.remedies.length > 0 ? (
                            item.remedies.map((r, i) => (
                              <span key={i} style={{ background: '#fff3e0', color: '#e65100', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600 }}>{r}</span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#94a3b8' }}>None linked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'entry' && (
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
