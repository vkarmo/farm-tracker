import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearLogs } from '../store/auditSlice';
import { Trash2 } from 'lucide-react';
import CrudTable from './CrudTable';


export default function AuditTab() {
  const dispatch = useDispatch();
  const logs = useSelector(state => state.audit?.logs) || [];
  const [filterDate, setFilterDate] = useState('All');
  const [filterUser, setFilterUser] = useState('All');
  const [filterAction, setFilterAction] = useState('All');

  const uniqueDates = Array.from(new Set(logs.map(l => new Date(l.timestamp).toLocaleDateString()))).sort((a, b) => (a || '').localeCompare(b || ''));
  const uniqueUsers = Array.from(new Set(logs.map(l => l.userEmail))).sort((a, b) => (a || '').localeCompare(b || ''));
  const uniqueActions = Array.from(new Set(logs.map(l => l.actionType))).sort((a, b) => (a || '').localeCompare(b || ''));

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all audit logs?')) {
      dispatch(clearLogs());
    }
  };

  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toLocaleDateString();
    const dateMatch = filterDate === 'All' || logDate === filterDate;
    const userMatch = filterUser === 'All' || log.userEmail === filterUser;
    const actionMatch = filterAction === 'All' || log.actionType === filterAction;
    
    return dateMatch && userMatch && actionMatch;
  }).reverse(); // Show newest first

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>System Audit Logs</h2>
        <button onClick={handleClear} className="btn" style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trash2 size={16} /> Clear Logs
        </button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Date:</label>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="btn" style={{ padding: '6px' }}>
            <option value="All">All</option>
            {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>User:</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="btn" style={{ padding: '6px' }}>
            <option value="All">All</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Action:</label>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="btn" style={{ padding: '6px' }}>
            <option value="All">All</option>
            {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <CrudTable 
        data={filteredLogs}
        columns={[
          { key: 'timestamp', header: 'Timestamp', render: (r) => new Date(r.timestamp).toLocaleString() },
          { key: 'userEmail', header: 'User' },
          { key: 'actionType', header: 'Action Type', render: (r) => (
            <span className="status-indicator" style={{ 
              background: r.actionType === 'DELETE' ? '#ffebee' : r.actionType === 'SAVE' ? '#e8f5e9' : r.actionType === 'EDIT' ? '#fff8e1' : '#e3f2fd',
              color: r.actionType === 'DELETE' ? '#c62828' : r.actionType === 'SAVE' ? '#2e7d32' : r.actionType === 'EDIT' ? '#f57f17' : '#1565c0'
            }}>
              {r.actionType}
            </span>
          )},
          { key: 'details', header: 'Details' }
        ]}
        itemLabel="Audit Log"
        customTitle="Audit Logs"
      />
    </div>
  );
}
