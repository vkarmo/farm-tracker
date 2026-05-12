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
    
    setActData(INIT_ACT);
    setEditingId(null);
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
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Activity Log' : 'Create Farm Task Activity'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setActData(INIT_ACT); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

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
        <button type="submit" className="btn btn-primary" style={{marginTop: 10}}>
          <ClipboardList size={16} style={{marginRight: 6}}/> {editingId ? 'Update Activity' : 'Save Activity Data'}
        </button>
      </form>

      <hr style={{border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0'}} />

      <CrudTable activeRowId={editingId} 
        data={logs} 
        columns={columns} 
        onEdit={(row) => { setActData(row); setEditingId(row.id); }} 
        onDelete={(id) => {
          dispatch(deleteActivity(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }} 
        itemLabel="Activity" 
      />
    </div>
  );
}
