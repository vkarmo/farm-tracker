<<<<<<< HEAD
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { flushQueue } from '../store/syncSlice';

const SyncTab = () => {
  const dispatch = useDispatch();
  const { offlineActionQueue, isSyncing, lastSynced, backendAvailable, backendFailures } = useSelector((s) => s.sync);

  return (
    <div style={{ padding: 20 }}>
      <h2>Sync Status</h2>
      <p><strong>Backend available:</strong> {backendAvailable ? 'Yes' : 'No'}</p>
      <p><strong>Failed attempts:</strong> {backendFailures}</p>
      <p><strong>Queued actions:</strong> {offlineActionQueue.length}</p>
      <p><strong>Last synced:</strong> {lastSynced || 'Never'}</p>
      <p><strong>Currently syncing:</strong> {isSyncing ? 'Yes' : 'No'}</p>
      <button
        onClick={() => dispatch(flushQueue(true))}
        disabled={isSyncing || offlineActionQueue.length === 0}
        style={{ marginTop: 12, padding: '8px 16px' }}
      >
        Force Sync Now
      </button>
    </div>
  );
};

export default SyncTab;
=======
import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { flushQueue } from '../store/syncSlice';
import { RefreshCw, Database } from 'lucide-react';

export default function SyncTab() {
  const dispatch = useDispatch();
  const syncModule = useSelector(state => state.sync || {});
  const { offlineActionQueue = [], isSyncing = false, lastSynced, backendAvailable = true, backendFailures = 0 } = syncModule;

  const handleForceSync = () => {
    dispatch(flushQueue(true));
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2>System Data Engine & Synchronization</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)', marginBottom: '15px' }}>
            Monitor local Redux storage memory usage, offline action queues, and directly communicate with the external backend APIs.
          </p>
        </div>

        <button
          onClick={handleForceSync}
          disabled={isSyncing || offlineActionQueue.length === 0}
          className="btn btn-primary"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: isSyncing ? '#aaa' : 'var(--color-primary)'
          }}
        >
          {isSyncing ? (
            <RefreshCw size={16} className="spin" />
          ) : (
            <Database size={16} />
          )}
          {isSyncing ? `Pushing Data (${offlineActionQueue.length} actions left)...` : `Force Sync Context Queue (${offlineActionQueue.length} actions)`}
        </button>
      </div>

      {isSyncing && (
        <div style={{ padding: '15px', background: '#fff3e0', borderLeft: '4px solid #ef6c00', borderRadius: '4px', color: '#e65100', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={24} className="spin" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '1rem' }}>Uploading Local Storage Database to Cloud...</strong>
            <span style={{ fontSize: '0.85rem' }}>The application is actively transmitting your locally cached Redux telemetry directly to the specified backend routing node. Please avoid closing the window until fully synchronized.</span>
          </div>
        </div>
      )}

      {(!backendAvailable || backendFailures > 0) && !isSyncing && (
        <div style={{ padding: '10px 15px', background: '#ffebee', borderRadius: '4px', color: '#c62828', marginBottom: '20px', fontSize: '0.9rem' }}>
          <strong>Network Warning:</strong> Experienced {backendFailures} synchronization failures. The backend server might be unreachable or currently sleeping.
        </div>
      )}

      <div style={{ marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
        <div className="status-indicator" style={{ background: '#f5f5f5', color: '#333' }}>
          <strong>Last Synced At:</strong> {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never Synced In Current Session'}
        </div>
        <div className={`status-indicator ${backendAvailable ? 'status-online' : 'status-offline'}`}>
          <strong>Neo4j Connect Node:</strong> {backendAvailable ? 'Reachable' : 'Unreachable'}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '20px 0' }} />

      <h3>Raw Local Redux Memory Diagnostics</h3>
      <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>This terminal displays exactly what is persisted mathematically inside the application cache.</p>

      <div style={{ background: '#1e1e1e', color: '#a6e22e', padding: '15px', borderRadius: '8px', overflowX: 'auto', maxHeight: '550px', fontSize: '0.85rem', fontFamily: 'monospace', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)' }}>
        <pre>{JSON.stringify(syncModule, null, 2)}</pre>
      </div>
    </div>
  );
}
>>>>>>> 1fca21eec85fdf517cd854dac04831ae2b5e97b6
