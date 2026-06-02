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
  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setFormData(INIT_INCIDENT);
    setEditingId(null);
    setActiveTab('roster');
  };

  const handleEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    setActiveTab('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return alert("Title and Incident Date are required.");

    const newObj = { ...formData, id: editingId || `inc_${Date.now()}` };
    dispatch(addIncident(newObj));
    dispatch(queueAction({ type: 'incidents/upsertIncident', payload: newObj, meta: { id: Date.now() } }));

    resetForm();
  };

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'title', header: 'Incident Title', style: { whiteSpace: 'nowrap' } },
    { key: 'type', header: 'Type', style: { whiteSpace: 'nowrap' } },
    { key: 'severity', header: 'Severity', style: { whiteSpace: 'nowrap' } },
    { key: 'resolutionStatus', header: 'Status', render: r => r.resolutionStatus === 'Resolved' ? <strong style={{ color: '#2e7d32' }}>Resolved</strong> : r.resolutionStatus, style: { whiteSpace: 'nowrap' } },
    { key: 'associatedAsset', header: 'Affected Asset', style: { whiteSpace: 'nowrap' } },
    { key: 'notes', header: 'Notes', style: { width: '250px', minWidth: '150px', maxWidth: '250px', wordBreak: 'break-word', whiteSpace: 'normal' } }
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
            Incidents Log
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
            {editingId ? 'Edit Incident' : 'Report New Incident'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId}
              data={incidents}
              columns={columns}
              onEdit={handleEdit}
              onDelete={(id) => {
                dispatch(deleteIncident(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }}
              itemLabel="Incident Report"
              defaultSort={{ key: 'date', direction: 'desc' }}
            />
          ) : (
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
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  <AlertTriangle size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Incident' : 'Report Incident'}
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
