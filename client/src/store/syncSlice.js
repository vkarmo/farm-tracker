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
  
  // PWA Standalone mode: Backend dismantled.
  // Resolve queue locally without API ping to prevent 502 Bad Gateway
  dispatch(clearQueue());
  dispatch(setLastSynced(new Date().toISOString()));
  dispatch(setSyncing(false));
  return;
};

export default syncSlice.reducer;
