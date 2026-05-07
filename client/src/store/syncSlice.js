import { createSlice } from '@reduxjs/toolkit';
import { setFields } from './fieldsSlice';
import { setBeds as setNurseries } from './nurserySlice';
import { setCrops, setLivestock, setEquipment, setHarvests } from './assetsSlice';
import { setEmployees } from './employeeSlice';
import { setAssignments } from './assignmentSlice';
import { setTransactions as setFinancials } from './financialsSlice';
import { setBudgets } from './budgetSlice';
import { setIncidents } from './incidentsSlice';
import { setDeadlines } from './deadlinesSlice';
import { setLocations } from './gpsSlice';
import { setLogs } from './auditSlice';
import { setUsersList } from './authSlice';
import { setAllSettings } from './settingsSlice';
import { setPoiData } from './poiSlice';

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

export const flushQueue = (forceSync = false) => async (dispatch, getState) => {
  const { offlineActionQueue, isSyncing, backendAvailable, backendFailures } = getState().sync;

  if (offlineActionQueue.length === 0) return;
  if (!navigator.onLine) return;
  if (isSyncing) return;

  // If backend has consistently failed, only retry every ~60 attempts (3 min at 3s interval) unless explicitly overridden
  if (!forceSync && !backendAvailable) {
    if (backendFailures % 60 !== 0) {
      dispatch(incrementFailures());
      return;
    }
  }

  dispatch(setSyncing(true));

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue: offlineActionQueue })
    });

    if (response.ok) {
      dispatch(clearQueue());
      dispatch(resetBackend());
      dispatch(setLastSynced(new Date().toISOString()));
    } else {
      const errText = await response.text();
      console.error('Remote DB Sync Exception:', errText);
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

export const fetchInitialData = () => async (dispatch, getState) => {
  const { offlineActionQueue } = getState().sync;
  // Conflict Resolution: Only pull if online and no pending offline actions
  if (!navigator.onLine || offlineActionQueue.length > 0) return;

  try {
    const response = await fetch('/api/all-data', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch initial data');
    const data = await response.json();
    
    if (data.fields) dispatch(setFields(data.fields));
    if (data.nurseries) dispatch(setNurseries(data.nurseries));
    if (data.crops) dispatch(setCrops(data.crops));
    if (data.livestock) dispatch(setLivestock(data.livestock));
    if (data.harvests) dispatch(setHarvests(data.harvests));
    if (data.equipment) dispatch(setEquipment(data.equipment));
    if (data.employees) dispatch(setEmployees(data.employees));
    if (data.assignments) dispatch(setAssignments(data.assignments));
    if (data.financials) dispatch(setFinancials(data.financials));
    if (data.budgets) dispatch(setBudgets(data.budgets));
    if (data.incidents) dispatch(setIncidents(data.incidents));
    if (data.deadlines) dispatch(setDeadlines(data.deadlines));
    if (data.gps) dispatch(setLocations(data.gps));
    if (data.audit) dispatch(setLogs(data.audit));
    if (data.users) dispatch(setUsersList(data.users));
    if (data.settings && data.settings.length > 0) dispatch(setAllSettings(data.settings[0]));
    if (data.poi) dispatch(setPoiData(data.poi));

  } catch (err) {
    console.error('Failed to load initial data from backend', err);
  }
};

export default syncSlice.reducer;
