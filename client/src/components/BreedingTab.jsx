import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { savePairing, removePairing } from '../store/breedingSlice';


export default function BreedingTab() {
  const dispatch = useDispatch();
  const pairings = useSelector(state => state.breeding?.pairings) || [];
  const livestock = useSelector(state => state.assets?.livestock) || [];

  const [editingId, setEditingId] = useState(null);
  const [doeId, setDoeId] = useState('');
  const [buckId, setBuckId] = useState('');
  const [pairedDate, setPairedDate] = useState('');
  const [expectedKindling, setExpectedKindling] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('roster');

  const reset = () => {
    setEditingId(null);
    setDoeId(''); setBuckId(''); setPairedDate(''); setExpectedKindling(''); setNotes('');
    setActiveTab('roster');
  };

  const handleSave = () => {
    if (!doeId || !buckId || !pairedDate) {
      alert('Doe, Buck, and Paired Date are required');
      return;
    }
    const data = {
      id: editingId || `pair-${Date.now()}`,
      doeId, buckId, pairedDate, expectedKindling, notes
    };
    dispatch(savePairing(data));
    reset();
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setDoeId(p.doeId || ''); setBuckId(p.buckId || '');
    setPairedDate(p.pairedDate || ''); setExpectedKindling(p.expectedKindling || '');
    setNotes(p.notes || '');
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (confirm('Delete this pairing?')) {
      dispatch(removePairing(id));
      if (editingId === id) reset();
    }
  };

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
            Breeding Pairings
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
            {editingId ? 'Edit Pairing' : 'New Pairing'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <div className="table-scroll-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Doe</th><th>Buck</th><th>Paired</th><th>Expected</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pairings.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 16 }}>No pairings yet</td></tr>}
                  {pairings.map(p => {
                    const doe = livestock.find(l => l.id === p.doeId);
                    const buck = livestock.find(l => l.id === p.buckId);
                    return (
                      <tr key={p.id}>
                        <td>{doe ? (doe.tagNumber || doe.id) : p.doeId}</td>
                        <td>{buck ? (buck.tagNumber || buck.id) : p.buckId}</td>
                        <td>{p.pairedDate}</td>
                        <td>{p.expectedKindling || '-'}</td>
                        <td>{p.notes || '-'}</td>
                        <td>
                          <button className="btn" onClick={() => handleEdit(p)}>Edit</button>
                          <button className="btn" onClick={() => handleDelete(p.id)} style={{ marginLeft: 4 }}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && <button className="btn" onClick={reset}>Cancel</button>}
                <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add'} Pairing</button>
              </div>
              <div style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 15 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Doe (Female)</label>
                  <select value={doeId} onChange={e => setDoeId(e.target.value)}>
                    <option value="">Select Doe (Female)</option>
                    {livestock.filter(l => l.gender === 'Female' || !l.gender).map(l => (
                      <option key={l.id} value={l.id}>{l.tagNumber || l.id} — {l.breed || l.type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Buck (Male)</label>
                  <select value={buckId} onChange={e => setBuckId(e.target.value)}>
                    <option value="">Select Buck (Male)</option>
                    {livestock.filter(l => l.gender === 'Male' || !l.gender).map(l => (
                      <option key={l.id} value={l.id}>{l.tagNumber || l.id} — {l.breed || l.type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Paired Date</label>
                  <input type="date" value={pairedDate} onChange={e => setPairedDate(e.target.value)} placeholder="Paired Date" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Expected Kindling</label>
                  <input type="date" value={expectedKindling} onChange={e => setExpectedKindling(e.target.value)} placeholder="Expected Kindling" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Notes</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
