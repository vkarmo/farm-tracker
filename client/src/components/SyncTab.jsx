import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { flushQueue } from '../store/syncSlice';
import { RefreshCw, Database } from 'lucide-react';

export default function SyncTab() {
  const dispatch = useDispatch();
  const fullState = useSelector(state => state);
  const syncModule = fullState.sync || {};
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
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: '20px' }}>
        This dashboard displays a comprehensive breakdown of what is persisted mathematically inside the application cache across all modules.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px'
      }}>
        {Object.entries(fullState).map(([key, value]) => {
          if (key === '_persist') return null;
          const isArray = Array.isArray(value);
          const isObject = value !== null && typeof value === 'object' && !isArray;
          const itemCount = isArray ? value.length : (isObject ? Object.keys(value).length : 0);

          return (
            <div key={key} style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>
                <h4 style={{ margin: 0, color: 'var(--color-primary)', textTransform: 'capitalize', fontSize: '1.1rem', fontWeight: 600 }}>
                  {key}
                </h4>
                <span style={{
                  background: itemCount > 0 ? '#e3f2fd' : '#f5f5f5',
                  color: itemCount > 0 ? '#1976d2' : '#9e9e9e',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {itemCount} {itemCount === 1 ? 'Entry' : 'Entries'}
                </span>
              </div>

              <div style={{
                background: '#1e1e1e',
                color: '#a6e22e',
                padding: '12px',
                borderRadius: '8px',
                overflowX: 'auto',
                overflowY: 'auto',
                height: '150px',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
              }}>
                <pre style={{ margin: 0 }}>{JSON.stringify(value, null, 2)}</pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
