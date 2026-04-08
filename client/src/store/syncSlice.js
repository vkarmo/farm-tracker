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
  
  try {
    const response = await fetch('http://localhost:3001/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: offlineActionQueue })
    });
    
    if (response.ok) {
      dispatch(clearQueue());
      dispatch(setLastSynced(new Date().toISOString()));
    } else {
      console.error('Failed to sync', await response.text());
    }
  } catch (err) {
    console.error('Sync error:', err);
  } finally {
    dispatch(setSyncing(false));
  }
};

export default syncSlice.reducer;
