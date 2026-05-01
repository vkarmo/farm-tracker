import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addLivestock, updateKit, deleteKit } from '../store/assetsSlice';
import { Layers, ArrowUpCircle, X, Check } from 'lucide-react';
import CrudTable from './CrudTable';

export default function KitsTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields?.data) || [];
  const livestock = useSelector(state => state.assets?.livestock) || [];
  const kits = useSelector(state => state.assets?.kits) || [];

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ numberOfKits: '', healthStatus: '', notes: '' });

  const handleUpdateKit = (e) => {
    e.preventDefault();
    if (!editingId) return;

    const originalKit = kits.find(k => k.id === editingId);
    if (!originalKit) return;

    const updatedKit = {
      ...originalKit,
      numberOfKits: parseInt(editForm.numberOfKits, 10),
      healthStatus: editForm.healthStatus,
      notes: editForm.notes
    };

    dispatch(updateKit(updatedKit));
    dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedKit }, meta: { id: Date.now() } }));

    setEditingId(null);
    setEditForm({ numberOfKits: '', healthStatus: '', notes: '' });
  };

  const handlePromoteKit = (kit) => {
    if (window.confirm(`Promote all ${kit.numberOfKits} remaining kits in this litter to individual Livestock profiles? This will archive the Kit record.`)) {
      for (let i = 0; i < kit.numberOfKits; i++) {
        const mother = livestock.find(l => l.id === kit.motherId);
        const motherTag = mother ? mother.tagNumber : 'Unknown Mother';
        
        const newAnimal = {
          id: `l_promoted_${Date.now()}_${i}`,
          fieldId: kit.fieldId,
          type: kit.type,
          breed: kit.breed,
          birthDate: kit.birthDate,
          tagNumber: `Pending Tag (from ${motherTag}) - ${i+1}`,
          healthStatus: kit.healthStatus,
          causeOfDeath: '',
          medicalRecords: []
        };
        
        dispatch(addLivestock(newAnimal));
        dispatch(queueAction({ type: 'assets/addLivestock', payload: newAnimal, meta: { id: Date.now() + i } }));
      }
      
      // Delete the Kit record
      dispatch(deleteKit(kit.id));
      dispatch(queueAction({ type: 'core/deleteNode', payload: { id: kit.id }, meta: { id: Date.now() + 100 } }));

      alert(`Successfully promoted ${kit.numberOfKits} animals! Visit the Livestock tab to assign permanent Tag numbers.`);
    }
  };

  const columns = [
    { key: 'birthDate', header: 'Birth Date' },
    { 
      key: 'motherId', 
      header: 'Mother (Tag)',
      render: (r) => livestock.find(l => l.id === r.motherId)?.tagNumber || 'Unknown'
    },
    { key: 'type', header: 'Species / Breed', render: (r) => `${r.type} (${r.breed})` },
    { key: 'numberOfKits', header: 'Surviving Count', render: (r) => <strong style={{fontSize: '1.1rem'}}>{r.numberOfKits}</strong> },
    { 
      key: 'healthStatus', 
      header: 'Status',
      render: (r) => {
        if (r.healthStatus === 'Healthy') return <span style={{ color: '#2e7d32', fontWeight: 500 }}>{r.healthStatus}</span>;
        if (r.healthStatus === 'Needs Vet') return <span style={{ color: '#c62828', fontWeight: 500 }}>{r.healthStatus}</span>;
        return <span style={{ color: '#ef6c00', fontWeight: 500 }}>{r.healthStatus}</span>;
      }
    },
    {
      key: 'actions',
      header: 'Promote',
      render: (r) => (
        <button 
          onClick={(e) => { e.stopPropagation(); handlePromoteKit(r); }}
          className="btn" 
          style={{ padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <ArrowUpCircle size={14} /> Promote
        </button>
      )
    }
  ];

  return (
    <div className="card">
      <h2>Livestock Kits & Litters</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Track newborn litters as a group before they mature enough to be individually tagged.
      </p>

      {editingId && (
        <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', border: '1px solid #ffe0b2', marginBottom: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#e65100' }}>Update Kit Status</h3>
            <button onClick={() => setEditingId(null)} className="btn" style={{ background: 'transparent', color: '#333', padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
          
          <form onSubmit={handleUpdateKit} className="form-grid">
            <div className="form-group">
              <label>Surviving Count</label>
              <input type="number" min="0" value={editForm.numberOfKits} onChange={e => setEditForm({...editForm, numberOfKits: e.target.value})} />
              <span style={{ fontSize: '0.8rem', color: '#666' }}>Reduce this number if a kit is lost.</span>
            </div>
            
            <div className="form-group">
              <label>Overall Health Status</label>
              <select value={editForm.healthStatus} onChange={e => setEditForm({...editForm, healthStatus: e.target.value})}>
                <option value="Healthy">Healthy</option>
                <option value="Under Observation">Under Observation</option>
                <option value="Needs Vet">Needs Vet</option>
              </select>
            </div>

            <div className="form-group form-grid-full">
              <label>Notes</label>
              <textarea rows="2" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder="Log deaths, treatments, or observations..."></textarea>
            </div>

            <div className="form-group form-grid-full">
              <button type="submit" className="btn btn-primary" style={{ background: '#ef6c00' }}>
                <Check size={16} style={{ marginRight: '6px' }} /> Save Updates
              </button>
            </div>
          </form>
        </div>
      )}

      <CrudTable 
        data={kits} 
        columns={columns} 
        onEdit={(row) => { 
          setEditingId(row.id); 
          setEditForm({ numberOfKits: row.numberOfKits, healthStatus: row.healthStatus, notes: row.notes || '' });
        }} 
        onDelete={(id) => {
          if (window.confirm("Permanently delete this kit record?")) {
            dispatch(deleteKit(id));
            dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
          }
        }} 
        itemLabel="Kit" 
        defaultSort={{ key: 'birthDate', direction: 'desc' }}
      />
    </div>
  );
}
