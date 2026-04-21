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
