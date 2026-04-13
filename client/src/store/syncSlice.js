import { createSlice } from '@reduxjs/toolkit';

export const syncSlice = createSlice({
  name: 'sync',
  initialState: {
    offlineActionQueue: [],
    isSyncing: false,
    lastSynced: null,
  },
  reducers: {
    queueAction: (state, action) => {
      state.offlineActionQueue.push(action.payload);
    },
    clearQueue: (state) => {
      state.offlineActionQueue = [];
    },
    setSyncing: (state, action) => {
      state.isSyncing = action.payload;
    },
    setLastSynced: (state, action) => {
      state.lastSynced = action.payload;
    }
  }
});

export const { queueAction, clearQueue, setSyncing, setLastSynced } = syncSlice.actions;

export const flushQueue = () => async (dispatch, getState) => {
  const { offlineActionQueue } = getState().sync;
  
  if (offlineActionQueue.length === 0) return;
  
  // Basic check for online status
  if (!navigator.onLine) return;

  dispatch(setSyncing(true));
  
  // Restoring full REST telemetry for Live Backend Connectivity
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // Relay exact array of actions sequentially to backend sync engine
    const response = await fetch(`${API_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queue: offlineActionQueue })
    });

    if (response.ok) {
      dispatch(clearQueue());
      dispatch(setLastSynced(new Date().toISOString()));
    } else {
      console.warn("Sync Endpoint Rejected Payload. Wait for offline mode bypass.");
    }
  } catch (error) {
    console.error("Critical Sync Failure - Backend Offline - Reverting to caching.", error);
  } finally {
    dispatch(setSyncing(false));
  }
};

export default syncSlice.reducer;
