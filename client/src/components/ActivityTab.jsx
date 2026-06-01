import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { queueAction } from '../store/syncSlice';
import { addActivity, deleteActivity } from '../store/activitySlice';
import { ClipboardList, X } from 'lucide-react';
import CrudTable from './CrudTable';


const INIT_ACT = { targetId: '', type: 'Brushing', date: '', plannedDate: '', personResponsible: '', notes: '' };

const ACTIVITY_TYPES = [
  'Brushing', 'Burning', 'Felling', 'Preparing for Planting', 
  'Planting', 'Fertilization', 'Pesticide Application', 'Harvesting', 
  'Other Crop Maintenance'
].sort();

export default function ActivityTab() {
  const dispatch = useDispatch();
  const fields = useSelector(state => state.fields.data) || [];
  const nurseries = useSelector(state => state.nurseries?.beds) || [];
  const crops = useSelector(state => state.assets.crops) || [];
  const logs = useSelector(state => state.activities?.log) || [];

  const [actData, setActData] = useState(INIT_ACT);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setActData(INIT_ACT);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleEdit = (row) => {
    setActData(row);
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!actData.type) return alert("Validation Error: Please select an Activity Type.");
    if (!actData.plannedDate) return alert("Validation Error: Planned Date is required.");
    if (!actData.targetId) return;

    if (editingId) {
      const updatedAct = { ...actData, id: editingId };
      dispatch(addActivity(updatedAct));
      dispatch(queueAction({ type: 'core/updateNode', payload: { id: editingId, properties: updatedAct }, meta: { id: Date.now() } }));
    } else {
      const newAct = { id: `a_${Date.now()}`, ...actData };
      dispatch(addActivity(newAct));
      dispatch(queueAction({ type: 'activities/addActivity', payload: newAct, meta: { id: Date.now() } }));
    }
    
    resetForm();
  };

  const columns = [
    { key: 'plannedDate', header: 'Planned Date' },
    { key: 'date', header: 'Execution Date' },
    { key: 'type', header: 'Task' },
    { key: 'personResponsible', header: 'Responsible' },
    { 
      key: 'targetId', 
      header: 'Target Asset',
      render: (r) => {
        const crop = crops.find(c => c.id === r.targetId);
        if (crop) return `Crop: ${crop.name}`;
        const field = fields.find(f => f.id === r.targetId);
        if (field) return `Field: ${field.name}`;
        const bed = nurseries.find(n => n.id === r.targetId);
        if (bed) return `Nursery: ${bed.name}`;
        return r.targetId;
      }
    },
    { key: 'notes', header: 'Notes' }
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
            Tasks & Activities
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
            {editingId ? 'Edit Activity Details' : 'Record New Activity'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId} 
              data={logs} 
              columns={columns} 
              onEdit={handleEdit} 
              onDelete={(id) => {
                dispatch(deleteActivity(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }} 
              itemLabel="Activity" 
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Target Asset (Where is this passing?)</label>
                  <select value={actData.targetId} onChange={e => setActData({...actData, targetId: e.target.value})}>
                    <option value="">Select Target...</option>
                    <optgroup label="Crops & Seedlings">
                      {[...crops].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name} ({c.variety})</option>)}
                    </optgroup>
                    <optgroup label="Physical Fields">
                      {[...fields].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(f => <option key={f.id} value={f.id}>{f.name} ({f.year})</option>)}
                    </optgroup>
                    <optgroup label="Nursery Beds">
                      {[...nurseries].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="form-group">
                  <label>Task / Activity Type</label>
                  <select value={actData.type} onChange={e => setActData({...actData, type: e.target.value})}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Planned Date</label>
                  <input type="date" value={actData.plannedDate} onChange={e => setActData({...actData, plannedDate: e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Execution Date (Optional until done)</label>
                  <input type="date" value={actData.date} onChange={e => setActData({...actData, date: e.target.value})}/>
                </div>
                <div className="form-group form-grid-full">
                  <label>Person Responsible</label>
                  <input type="text" value={actData.personResponsible} onChange={e => setActData({...actData, personResponsible: e.target.value})} placeholder="e.g. John Doe"/>
                </div>
                <div className="form-group form-grid-full">
                  <label>Notes / Custom Description</label>
                  <textarea rows="2" value={actData.notes} onChange={e => setActData({...actData, notes: e.target.value})} placeholder="Optional details..."></textarea>
                </div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <ClipboardList size={16} style={{marginRight: 6}}/> {editingId ? 'Update Activity' : 'Save Activity Data'}
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
