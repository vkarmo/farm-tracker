import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addDeadline, deleteDeadline } from '../store/deadlinesSlice';
import { Calendar, X } from 'lucide-react';
import CrudTable from './CrudTable';

const INIT_DEADLINE = { title: '', type: 'Insurance Registration', dueDate: '', status: 'Pending', personResponsible: '', notes: '' };

const DEADLINE_TYPES = [
  'Insurance Registration', 'Business Registration', 'Truck/Vehicle License',
  'Repair Deadline', 'Utility/Wifi Bill', 'Loan/Lease Payment', 'Contract Renewal', 'Other'
];

export default function DeadlineTab() {
  const dispatch = useDispatch();
  const deadlines = useSelector(state => state.deadlines.list) || [];
  const [formData, setFormData] = useState(INIT_DEADLINE);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.dueDate) return alert("Title and Due Date are required.");

    const newObj = { ...formData, id: editingId || `dl_${Date.now()}` };
    dispatch(addDeadline(newObj));

    setFormData(INIT_DEADLINE);
    setEditingId(null);
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
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{editingId ? 'Edit Deadline' : 'Log New Deadline'}</h2>
        {editingId && (
          <button onClick={() => { setEditingId(null); setFormData(INIT_DEADLINE); }} className="btn" style={{ background: '#f5f5f5', color: '#333' }}>
            <X size={14} style={{ marginRight: 4 }} /> Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
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
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
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
        <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
          <Calendar size={16} style={{ marginRight: 6 }} /> {editingId ? 'Update Deadline' : 'Save Deadline'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '30px 0' }} />

      <CrudTable
        data={deadlines.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))}
        columns={columns}
        onEdit={(row) => { setFormData(row); setEditingId(row.id); }}
        onDelete={(id) => dispatch(deleteDeadline(id))}
        itemLabel="Deadline"
      />
    </div>
  );
}
