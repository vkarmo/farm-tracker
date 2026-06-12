import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addDeadline, deleteDeadline } from '../store/deadlinesSlice';
import { queueAction } from '../store/syncSlice';
import { Calendar, X } from 'lucide-react';
import CrudTable from './CrudTable';


const INIT_DEADLINE = { title: '', type: 'Insurance Registration', dueDate: '', status: 'Pending', personResponsible: '', notes: '' };

const DEADLINE_TYPES = [
  'Insurance Registration', 'Business Registration', 'Truck/Vehicle License',
  'Repair Deadline', 'Utility/Wifi Bill', 'Loan/Lease Payment', 'Contract Renewal', 'Other'
].sort();

export default function DeadlineTab() {
  const dispatch = useDispatch();
  const deadlines = useSelector(state => state.deadlines.list) || [];
  const [formData, setFormData] = useState(INIT_DEADLINE);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('roster');

  const resetForm = () => {
    setFormData(INIT_DEADLINE);
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
    if (!formData.title || !formData.dueDate) return alert("Title and Due Date are required.");

    const newObj = { ...formData, id: editingId || `dl_${Date.now()}` };
    dispatch(addDeadline(newObj));
    dispatch(queueAction({ type: 'deadlines/upsertDeadline', payload: newObj, meta: { id: Date.now() } }));

    resetForm();
  };

  const columns = [
    { key: 'title', header: 'Deadline Title' },
    { key: 'type', header: 'Category' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'status', header: 'Status', render: r => r.status === 'Resolved' ? <strong style={{ color: '#2e7d32' }}>Resolved</strong> : r.status },
    { key: 'personResponsible', header: 'Responsible' },
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
            Deadlines Roster
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
            {editingId ? 'Edit Deadline' : 'Log New Deadline'}
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'roster' ? (
            <CrudTable activeRowId={editingId}
              data={deadlines}
              columns={columns}
              onEdit={handleEdit}
              onDelete={(id) => {
                dispatch(deleteDeadline(id));
                dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
                if (editingId === id) resetForm();
              }}
              itemLabel="Deadline"
              defaultSort={{ key: 'title', direction: 'asc' }}
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'flex-end' }}>
                {editingId && (
                  <button type="button" className="btn" onClick={resetForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Calendar size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Deadline' : 'Save Deadline'}
                </button>
              </div>
              <div className="form-grid">
                <div className="form-group form-grid-full">
                  <label>Title</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Q4 Wifi Bill" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    {DEADLINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="Overdue">Overdue</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Person Responsible</label>
                  <input type="text" value={formData.personResponsible} onChange={e => setFormData({ ...formData, personResponsible: e.target.value })} placeholder="Owner Name" />
                </div>
                <div className="form-group form-grid-full">
                  <label>Notes / Context</label>
                  <textarea rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional details..."></textarea>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
