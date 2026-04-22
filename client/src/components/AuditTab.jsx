import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearLogs } from '../store/auditSlice';
import { Search, Trash2 } from 'lucide-react';

export default function AuditTab() {
  const dispatch = useDispatch();
  const logs = useSelector(state => state.audit?.logs) || [];
  const [searchTerm, setSearchTerm] = useState('');

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all audit logs?')) {
      dispatch(clearLogs());
    }
  };

  const filteredLogs = logs.filter(log => 
    log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actionType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  ).reverse(); // Show newest first

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>System Audit Logs</h2>
        <button onClick={handleClear} className="btn" style={{ background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Trash2 size={16} /> Clear Logs
        </button>
      </div>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
          <input 
            type="text" 
            placeholder="Search logs by user, action, or details..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action Type</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.userEmail}</td>
                  <td>
                    <span className="status-indicator" style={{ 
                      background: log.actionType === 'DELETE' ? '#ffebee' : log.actionType === 'SAVE' ? '#e8f5e9' : log.actionType === 'EDIT' ? '#fff8e1' : '#e3f2fd',
                      color: log.actionType === 'DELETE' ? '#c62828' : log.actionType === 'SAVE' ? '#2e7d32' : log.actionType === 'EDIT' ? '#f57f17' : '#1565c0'
                    }}>
                      {log.actionType}
                    </span>
                  </td>
                  <td>{log.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-light)' }}>
                  No audit logs found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
