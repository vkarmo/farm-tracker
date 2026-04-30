import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addIncident, deleteIncident } from '../store/incidentsSlice';
import { queueAction } from '../store/syncSlice';
import { AlertTriangle, X } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_INCIDENT = { title: '', type: 'Asset Breakdown', date: '', severity: 'Medium', associatedAsset: '', resolutionStatus: 'Open', notes: '' };

const INCIDENT_TYPES = [
  'Asset Breakdown', 'Hardware/Vehicle Repair', 'Livestock Health Issue', 'Other', 'Theft/Loss', 'Weather Event'
].sort();

export default function IncidentTab() {
  const dispatch = useDispatch();
  const incidents = useSelector(state => state.incidents.list) || [];
  const [formData, setFormData] = useState(INIT_INCIDENT);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return alert("Title and Incident Date are required.");

    const newObj = { ...formData, id: editingId || `inc_${Date.now()}` };
    dispatch(addIncident(newObj));
    dispatch(queueAction({ type: 'incidents/upsertIncident', payload: newObj, meta: { id: Date.now() } }));

    setFormData(INIT_INCIDENT);
    setEditingId(null);
  };

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'title', header: 'Incident Title' },
    { key: 'type', header: 'Type' },
    { key: 'severity', header: 'Severity' },
    { key: 'resolutionStatus', header: 'Status', render: r => r.resolutionStatus === 'Resolved' ? <strong style={{ color: '#2e7d32' }}>Resolved</strong> : r.resolutionStatus },
    { key: 'associatedAsset', header: 'Affected Asset' },
    { key: 'notes', header: 'Notes' }
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Incident' : 'Report New Incident'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_INCIDENT); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-grid-full">
            <label>Title</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Tractor Engine Failure" />
          </div>
          <div className="form-group">
            <label>Incident Type</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Incident Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Severity</label>
            <select value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
              <option value="High">High (Critical Stop)</option>
              <option value="Low">Low (No Immediate Impact)</option>
              <option value="Medium">Medium (Operational Delay)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Resolution Status</label>
            <select value={formData.resolutionStatus} onChange={e => setFormData({ ...formData, resolutionStatus: e.target.value })}>
              <option value="In Progress">In Progress (Repairing)</option>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div className="form-group">
            <label>Associated Asset</label>
            <input type="text" value={formData.associatedAsset} onChange={e => setFormData({ ...formData, associatedAsset: e.target.value })} placeholder="e.g. Primary Truck" />
          </div>
          <div className="form-group form-grid-full">
            <label>Detailed Notes</label>
            <textarea rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Explain what happened and action items..."></textarea>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          <AlertTriangle size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Incident' : 'Report Incident'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable
        data={incidents}
        columns={columns}
        onEdit={(row) => { setFormData(row); setEditingId(row.id); }}
        onDelete={(id) => {
          dispatch(deleteIncident(id));
          dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
        }}
        itemLabel="Incident Report"
        defaultSort={{ key: 'date', direction: 'desc' }}
      />
    </div>
  );
}
