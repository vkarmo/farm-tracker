import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addLivestock, deleteLivestock } from '../store/assetsSlice';
import { Rabbit, X, PlusCircle, Syringe } from 'lucide-react';
import CrudTable from './CrudTable';


const INIT_LIVE = { fieldId: '', type: '', breed: '', birthDate: '', healthStatus: 'Healthy', tagNumber: '', causeOfDeath: '', medicalRecords: [] };

export default function LivestockTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const livestock = useSelector(state => state.assets.livestock) || [];
  const animalTypes = useSelector(state => state.settings?.animalTypes) || [];

  const [liveData, setLiveData] = useState(INIT_LIVE);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');
  
  // Temporary state for the inline medical form
  const [newMedTitle, setNewMedTitle] = useState('');
  const [newMedDate, setNewMedDate] = useState('');

  const resetForm = () => {
    setLiveData(INIT_LIVE);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleEdit = (row) => {
    setLiveData({ ...INIT_LIVE, ...row });
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!liveData.type.trim()) return alert("Validation Error: Species/Type is required.");
    if (!liveData.tagNumber.trim()) return alert("Validation Error: Tag Number/Identifier is required.");
    if (!liveData.type || !liveData.tagNumber) return;

    if (editingId) {
      const updatedLive = { ...liveData, id: editingId };
      dispatch(addLivestock(updatedLive)); 
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedLive }, meta: { id: Date.now() } }));
    } else {
      const newAnimal = { id: `l_${Date.now()}`, ...liveData, medicalRecords: liveData.medicalRecords || [] };
      dispatch(addLivestock(newAnimal));
      dispatch(queueAction({ type: 'assets/addLivestock', payload: newAnimal, meta: { id: Date.now() } }));
    }
    
    resetForm();
  };

  const handleAddMedicalRecord = (e) => {
    e.preventDefault(); // Prevent main form submit
    if (!newMedTitle || !newMedDate) return;
    const rec = { title: newMedTitle, date: newMedDate, id: Date.now() };
    setLiveData(prev => ({
      ...prev,
      medicalRecords: [...(prev.medicalRecords || []), rec]
    }));
    setNewMedTitle('');
    setNewMedDate('');
  };

  const handleRemoveMedicalRecord = (recId) => {
    setLiveData(prev => ({
      ...prev,
      medicalRecords: (prev.medicalRecords || []).filter(r => r.id !== recId)
    }));
  };

  const columns = [
    { key: 'tagNumber', header: 'Tag ID' },
    { key: 'type', header: 'Type' },
    { key: 'breed', header: 'Breed' },
    { 
      key: 'healthStatus', 
      header: 'Health',
      render: (r) => r.healthStatus === 'Deceased' ? <strong style={{color: '#d32f2f'}}>Deceased</strong> : r.healthStatus
    },
    { 
      key: 'fieldId', 
      header: 'Location',
      render: (r) => fields.find(f => f.id === r.fieldId)?.name || 'Unassigned'
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
            Livestock Roster
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
            {editingId ? 'Edit Livestock Record' : 'Register Livestock Tag'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId} 
              data={livestock} 
              columns={columns} 
              onEdit={handleEdit} 
              onDelete={(id) => {
                dispatch(deleteLivestock(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }} 
              itemLabel="Livestock Tag" 
              defaultSort={{ key: 'tagNumber', direction: 'asc' }}
              rowStyle={(row) => row.healthStatus === 'Deceased' ? { opacity: 0.6, background: '#fafafa' } : {}}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Assigned Pasture / Field (Optional)</label>
                  <select value={liveData.fieldId} onChange={e => setLiveData({...liveData, fieldId: e.target.value})}>
                    <option value="">No specific field assignment...</option>
                    {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Animal Type</label>
                  <select value={liveData.type} onChange={e => setLiveData({...liveData, type: e.target.value})}>
                    <option value="">Pick...</option>
                    {animalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Breed</label>
                  <input type="text" value={liveData.breed} onChange={e => setLiveData({...liveData, breed: e.target.value})} placeholder="e.g. Angus"/>
                </div>
                <div className="form-group">
                  <label>Birth / Acquisition Date</label>
                  <input type="date" value={liveData.birthDate} onChange={e => setLiveData({...liveData, birthDate: e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>ID Tag Number</label>
                  <input type="text" value={liveData.tagNumber} onChange={e => setLiveData({...liveData, tagNumber: e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Health Status</label>
                  <select value={liveData.healthStatus} onChange={e => {
                      setLiveData({...liveData, healthStatus: e.target.value});
                      // wipe cause of death if they bring it back to life
                      if (e.target.value !== 'Deceased') {
                          setLiveData(prev => ({...prev, causeOfDeath: ''}));
                      }
                  }}>
                    <option value="Deceased">Deceased</option>
                    <option>Healthy</option>
                    <option>Ill/Injured</option>
                    <option>Quarantined</option>
                    <option>Requires Vet</option>
                    <option>Under Medication</option>
                  </select>
                </div>

                {liveData.healthStatus === 'Deceased' && (
                  <div className="form-group">
                    <label>Cause of Death</label>
                    <input type="text" value={liveData.causeOfDeath || ''} onChange={e => setLiveData({...liveData, causeOfDeath: e.target.value})} placeholder="e.g. Predation, Illness, Age..."/>
                  </div>
                )}
              </div>

              {/* MEDICAL HISTORY WIDGET */}
              <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Syringe size={14} /> Vaccinations & Medical Log</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                  {(liveData.medicalRecords || []).length === 0 ? (
                    <span style={{fontSize: '0.85rem', color: '#888', fontStyle: 'italic'}}>No medical history recorded.</span>
                  ) : (
                    (liveData.medicalRecords || []).map(r => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'white', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.9rem' }}>
                        <span><strong>{r.date}</strong> - {r.title}</span>
                        <button type="button" onClick={() => handleRemoveMedicalRecord(r.id)} style={{ border: 'none', background: 'none', color: '#d32f2f', cursor: 'pointer' }}><X size={14}/></button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Operation / Vaccine Name</label>
                    <input type="text" value={newMedTitle} onChange={e => setNewMedTitle(e.target.value)} placeholder="e.g. Rabies Shot, De-worming" />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label style={{ fontSize: '0.8rem' }}>Date</label>
                    <input type="date" value={newMedDate} onChange={e => setNewMedDate(e.target.value)} />
                  </div>
                  <button type="button" onClick={handleAddMedicalRecord} className="btn" style={{ height: '36px', background: '#e3f2fd', color: '#1565c0' }}>
                    <PlusCircle size={14} /> Add
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <Rabbit size={16} style={{marginRight: 6}}/> {editingId ? 'Update Tag Data' : 'Save Livestock Data'}
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
