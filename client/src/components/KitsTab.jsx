import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { saveKit, removeKit } from '../store/breedingSlice';

let isSubmitting = false;

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

  const reset = () => {
    setEditingId(null);
    setPairingId(''); setBirthDate(''); setCount(''); setSurvivors(''); setWeaningDate(''); setNotes('');
  };

  const handleSave = () => {
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
    if (isSubmitting) return;
    isSubmitting = true;
    setTimeout(() => { isSubmitting = false; }, 1000);
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
  };

  const handleDelete = (id) => {
    if (confirm('Delete this kit record?')) dispatch(removeKit(id));
  };

  return (
    <div>
      <h2>Kit Records</h2>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h3>{editingId ? 'Edit Kit Record' : 'New Kit Record'}</h3>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <select value={pairingId} onChange={e => setPairingId(e.target.value)}>
            <option value="">Select Pairing</option>
            {pairings.map(p => (
              <option key={p.id} value={p.id}>
                {p.doeId} × {p.buckId} ({p.pairedDate})
              </option>
            ))}
          </select>
          <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="Birth Date" />
          <input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="Total Born" />
          <input type="number" value={survivors} onChange={e => setSurvivors(e.target.value)} placeholder="Survivors" />
          <input type="date" value={weaningDate} onChange={e => setWeaningDate(e.target.value)} placeholder="Weaning Date" />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add'} Kit</button>
          {editingId && <button className="btn" onClick={reset}>Cancel</button>}
        </div>
      </div>

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
  );
}
