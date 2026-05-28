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

  const reset = () => {
    setEditingId(null);
    setDoeId(''); setBuckId(''); setPairedDate(''); setExpectedKindling(''); setNotes('');
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
  };

  const handleDelete = (id) => {
    if (confirm('Delete this pairing?')) dispatch(removePairing(id));
  };

  return (
    <div>
      <h2>Breeding Pairings</h2>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3>{editingId ? 'Edit Pairing' : 'New Pairing'}</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <select value={doeId} onChange={e => setDoeId(e.target.value)}>
            <option value="">Select Doe (Female)</option>
            {livestock.filter(l => l.gender === 'Female' || !l.gender).map(l => (
              <option key={l.id} value={l.id}>{l.tagNumber || l.id} — {l.breed || l.type}</option>
            ))}
          </select>
          <select value={buckId} onChange={e => setBuckId(e.target.value)}>
            <option value="">Select Buck (Male)</option>
            {livestock.filter(l => l.gender === 'Male' || !l.gender).map(l => (
              <option key={l.id} value={l.id}>{l.tagNumber || l.id} — {l.breed || l.type}</option>
            ))}
          </select>
          <input type="date" value={pairedDate} onChange={e => setPairedDate(e.target.value)} placeholder="Paired Date" />
          <input type="date" value={expectedKindling} onChange={e => setExpectedKindling(e.target.value)} placeholder="Expected Kindling" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add'} Pairing</button>
          {editingId && <button className="btn" onClick={reset}>Cancel</button>}
        </div>
      </div>

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
    </div>
  );
}
