import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveKit, removeKit } from '../store/breedingSlice';


export default function KitsTab() {
  const dispatch = useDispatch();
  const kits = useSelector(state => state.breeding?.kits) || [];
  const pairings = useSelector(state => state.breeding?.pairings) || [];

  const [editingId, setEditingId] = useState(null);
  const [pairingId, setPairingId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [count, setCount] = useState('');
  const [survivors, setSurvivors] = useState('');
  const [weaningDate, setWeaningDate] = useState('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('roster');

  const reset = () => {
    setEditingId(null);
    setPairingId(''); setBirthDate(''); setCount(''); setSurvivors(''); setWeaningDate(''); setNotes('');
    setActiveTab('roster');
  };

  const handleSave = () => {
    if (!pairingId || !birthDate || !count) {
      alert('Pairing, Birth Date, and Count are required');
      return;
    }
    const data = {
      id: editingId || `kit-${Date.now()}`,
      pairingId, birthDate,
      count: parseInt(count, 10) || 0,
      survivors: parseInt(survivors, 10) || 0,
      weaningDate, notes
    };
    dispatch(saveKit(data));
    reset();
  };

  const handleEdit = (k) => {
    setEditingId(k.id);
    setPairingId(k.pairingId || ''); setBirthDate(k.birthDate || '');
    setCount(String(k.count ?? '')); setSurvivors(String(k.survivors ?? ''));
    setWeaningDate(k.weaningDate || ''); setNotes(k.notes || '');
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (confirm('Delete this kit record?')) {
      dispatch(removeKit(id));
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
            Kit Records
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
            {editingId ? 'Edit Kit Record' : 'New Kit Record'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <div className="table-scroll-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Pairing</th><th>Birth Date</th><th>Born</th><th>Survivors</th><th>Weaning</th><th>Notes</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {kits.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 16 }}>No kit records yet</td></tr>}
                  {kits.map(k => {
                    const pair = pairings.find(p => p.id === k.pairingId);
                    return (
                      <tr key={k.id}>
                        <td>{pair ? `${pair.doeId} × ${pair.buckId}` : k.pairingId}</td>
                        <td>{k.birthDate}</td>
                        <td>{k.count}</td>
                        <td>{k.survivors}</td>
                        <td>{k.weaningDate || '-'}</td>
                        <td>{k.notes || '-'}</td>
                        <td>
                          <button className="btn" onClick={() => handleEdit(k)}>Edit</button>
                          <button className="btn" onClick={() => handleDelete(k.id)} style={{ marginLeft: 4 }}>Delete</button>
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
                <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add'} Kit</button>
              </div>
              <div style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 15 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Pairing</label>
                  <select value={pairingId} onChange={e => setPairingId(e.target.value)}>
                    <option value="">Select Pairing</option>
                    {pairings.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.doeId} × {p.buckId} ({p.pairedDate})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Birth Date</label>
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="Birth Date" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Total Born</label>
                  <input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="Total Born" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Survivors</label>
                  <input type="number" value={survivors} onChange={e => setSurvivors(e.target.value)} placeholder="Survivors" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Weaning Date</label>
                  <input type="date" value={weaningDate} onChange={e => setWeaningDate(e.target.value)} placeholder="Weaning Date" />
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
