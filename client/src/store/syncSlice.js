import { createSlice } from '@reduxjs/toolkit';

export const syncSlice = createSlice({
  name: 'sync',
  initialState: {
    offlineActionQueue: [],
    isSyncing: false,
    lastSynced: null,
    backendFailures: 0,
    backendAvailable: true,
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
      state.backendFailures = 0;
      state.backendAvailable = true;
    },
    incrementFailures: (state) => {
      state.backendFailures += 1;
      if (state.backendFailures >= 3) {
        state.backendAvailable = false;
      }
    },
    resetBackend: (state) => {
      state.backendFailures = 0;
      state.backendAvailable = true;
    }
  }
});

export const { queueAction, clearQueue, setSyncing, setLastSynced, incrementFailures, resetBackend } = syncSlice.actions;

export const flushQueue = () => async (dispatch, getState) => {
  const { offlineActionQueue, isSyncing, backendAvailable, backendFailures } = getState().sync;

  if (offlineActionQueue.length === 0) return;
  if (!navigator.onLine) return;
  if (isSyncing) return;

  // If backend has consistently failed, only retry every ~60 attempts (3 min at 3s interval)
  if (!backendAvailable) {
    if (backendFailures % 60 !== 0) {
      dispatch(incrementFailures());
      return;
    }
  }

  dispatch(setSyncing(true));

  try {
    const API_URL = import.meta.env.VITE_API_URL || '';
    if (!API_URL) {
      // No backend configured — stay silent and cache locally
      dispatch(setSyncing(false));
      return;
    }

    const response = await fetch(`${API_URL}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: offlineActionQueue })
    });

    if (response.ok) {
      dispatch(clearQueue());
      dispatch(setLastSynced(new Date().toISOString()));
    } else {
      console.warn('Sync endpoint rejected payload — will retry.');
      dispatch(incrementFailures());
    }
  } catch (error) {
    dispatch(incrementFailures());
    if (backendFailures === 0) {
      console.warn('Backend unreachable — data cached locally until reconnected.');
    }
  } finally {
    dispatch(setSyncing(false));
  }
};

export default syncSlice.reducer;
