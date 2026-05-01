import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addBreedingEvent, deleteBreedingEvent } from '../store/breedingSlice';
import { addKit } from '../store/assetsSlice';
import { Baby, X, Check, Save } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_EVENT = { 
  motherId: '', 
  fatherId: '', 
  matingDate: '', 
  expectedDueDate: '', 
  status: 'Gestating', 
  offspringCount: '', 
  notes: '' 
};

export default function BreedingTab() {
  const dispatch = useDispatch();
  const livestock = useSelector(state => state.assets.livestock) || [];
  const events = useSelector(state => state.breeding?.events) || [];

  const [eventData, setEventData] = useState(INIT_EVENT);
  const [editingId, setEditingId] = useState(null);

  // Get eligible females and males
  const females = livestock.filter(l => ['Cattle', 'Goat', 'Sheep', 'Swine'].includes(l.type) && l.healthStatus !== 'Deceased');
  const males = livestock.filter(l => ['Cattle', 'Goat', 'Sheep', 'Swine'].includes(l.type) && l.healthStatus !== 'Deceased');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!eventData.motherId) return alert("Mother Tag ID is required.");
    if (!eventData.matingDate) return alert("Mating Date is required.");

    const payload = {
      ...eventData,
      offspringCount: eventData.offspringCount ? parseInt(eventData.offspringCount, 10) : 0
    };

    if (editingId) {
      payload.id = editingId;
      dispatch(addBreedingEvent(payload));
      dispatch(queueAction({ type: 'breeding/updateEvent', payload, meta: { id: Date.now() } }));
    } else {
      payload.id = `br_${Date.now()}`;
      dispatch(addBreedingEvent(payload));
      dispatch(queueAction({ type: 'breeding/addEvent', payload, meta: { id: Date.now() } }));
    }

    setEventData(INIT_EVENT);
    setEditingId(null);
  };

  const handleRegisterOffspring = (event) => {
    if (!event.offspringCount || event.offspringCount <= 0) return alert("No offspring recorded.");
    
    const mother = livestock.find(l => l.id === event.motherId);
    if (!mother) return alert("Mother record no longer exists. Cannot inherit breed/type.");

    if (window.confirm(`Log ${event.offspringCount} new offspring into a Livestock Kit?`)) {
      const newKit = {
        id: `kit_${Date.now()}`,
        motherId: mother.id,
        birthDate: new Date().toISOString().split('T')[0],
        type: mother.type,
        breed: mother.breed,
        fieldId: mother.fieldId,
        numberOfKits: event.offspringCount,
        healthStatus: 'Healthy',
        notes: ''
      };
      
      dispatch(addKit(newKit));
      dispatch(queueAction({ type: 'assets/addKit', payload: newKit, meta: { id: Date.now() } }));
      
      // Mark event as fully registered so they don't click it again
      const updatedEvent = { ...event, status: 'Offspring Registered' };
      dispatch(addBreedingEvent(updatedEvent));
      dispatch(queueAction({ type: 'breeding/updateEvent', payload: updatedEvent, meta: { id: Date.now() + 100 } }));

      alert(`Litter successfully created! Visit the Kits tab to track their growth.`);
    }
  };

  const columns = [
    { key: 'matingDate', header: 'Mating Date' },
    { 
      key: 'motherId', 
      header: 'Mother (Tag)',
      render: (r) => livestock.find(l => l.id === r.motherId)?.tagNumber || 'Unknown'
    },
    { key: 'expectedDueDate', header: 'Est. Due Date' },
    { 
      key: 'status', 
      header: 'Status',
      render: (r) => {
        if (r.status === 'Gestating') return <span style={{ color: '#0277bd', fontWeight: 'bold' }}>{r.status}</span>;
        if (r.status === 'Delivered') return <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>{r.status} ({r.offspringCount})</span>;
        if (r.status === 'Failed') return <span style={{ color: '#c62828', fontWeight: 'bold' }}>{r.status}</span>;
        return <span style={{ color: '#555', fontWeight: 'bold' }}>{r.status}</span>;
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => r.status === 'Delivered' && r.offspringCount > 0 ? (
        <button 
          onClick={(e) => { e.stopPropagation(); handleRegisterOffspring(r); }}
          className="btn" 
          style={{ padding: '6px 12px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', fontSize: '0.8rem' }}
        >
          Create Kit/Litter
        </button>
      ) : null
    }
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Breeding Event' : 'Log Breeding Event'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setEventData(INIT_EVENT); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group">
            <label>Mother (Tag ID)</label>
            <select value={eventData.motherId} onChange={e => setEventData({...eventData, motherId: e.target.value})}>
              <option value="">Select Mother...</option>
              {females.map(f => <option key={f.id} value={f.id}>{f.type} - {f.tagNumber}</option>)}
            </select>
          </div>
          
          <div className="form-group">
            <label>Father (Tag ID) - Optional</label>
            <select value={eventData.fatherId} onChange={e => setEventData({...eventData, fatherId: e.target.value})}>
              <option value="">Select Sire...</option>
              {males.map(m => <option key={m.id} value={m.id}>{m.type} - {m.tagNumber}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Mating Date</label>
            <input type="date" value={eventData.matingDate} onChange={e => setEventData({...eventData, matingDate: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Est. Due Date (Gestation)</label>
            <input type="date" value={eventData.expectedDueDate} onChange={e => setEventData({...eventData, expectedDueDate: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Current Status</label>
            <select value={eventData.status} onChange={e => setEventData({...eventData, status: e.target.value})}>
              <option value="Gestating">Gestating</option>
              <option value="Delivered">Delivered</option>
              <option value="Failed">Failed / Miscarried</option>
              <option value="Offspring Registered" disabled>Offspring Registered</option>
            </select>
          </div>

          {eventData.status === 'Delivered' && (
            <div className="form-group" style={{ background: '#e8f5e9', padding: '10px', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
              <label style={{ color: '#2e7d32' }}>Number of Offspring Generated</label>
              <input type="number" min="1" value={eventData.offspringCount} onChange={e => setEventData({...eventData, offspringCount: e.target.value})} placeholder="e.g. 1" />
            </div>
          )}

          <div className="form-group form-grid-full">
            <label>Notes</label>
            <textarea rows="2" value={eventData.notes} onChange={e => setEventData({...eventData, notes: e.target.value})} placeholder="Health notes, AI semen details..."></textarea>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
          <Save size={16} style={{ marginRight: 6 }} /> 
          {editingId ? 'Update Breeding Event' : 'Log Breeding Event'}
        </button>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <CrudTable 
        data={events} 
        columns={columns} 
        onEdit={(row) => { setEventData(row); setEditingId(row.id); }} 
        onDelete={(id) => {
          dispatch(deleteBreedingEvent(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Breeding Event" 
        defaultSort={{ key: 'matingDate', direction: 'desc' }}
      />
    </div>
  );
}
