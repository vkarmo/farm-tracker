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
import { setGoals, setObjectives } from './planningSlice';
import { setRecommendations } from './recommendationsSlice';
import { setPests } from './pestsSlice';
import { setDiseases } from './livestockDiseasesSlice';
import { setPayrolls } from './payrollSlice';
import { setSoilTests } from './soilTestsSlice';
import { setCharcoalAlerts } from './charcoalSlice';

export const syncSlice = createSlice({
  name: 'sync',
  initialState: {
    offlineActionQueue: [],
    isSyncing: false,
    lastSynced: null,
    backendFailures: 0,
    backendAvailable: true,
    totalActionsQueued: 0,
  },
  reducers: {
    queueAction: (state, action) => {
      const activeFarmId = localStorage.getItem('activeFarmId') || (import.meta.env.DEV ? 'dev_farm' : 'default_farm');
      const actionPayload = action.payload || {};
      const actionWithFarm = {
        ...actionPayload,
        farmId: actionPayload.farmId || activeFarmId
      };
      state.offlineActionQueue.push(actionWithFarm);
      
      // Do not trigger the "Saved Successfully" UI toast for automated background actions
      const type = actionPayload.type || '';
      const isAutomated = type.startsWith('gps/') || type.startsWith('audit/') || type === 'core/logAction';
      
      if (!isAutomated) {
        state.totalActionsQueued = (state.totalActionsQueued || 0) + 1;
      }
    },
    clearQueue: (state, action) => {
      const idsToRemove = action.payload || [];
      state.offlineActionQueue = state.offlineActionQueue.filter(
        a => !a.meta?.id || !idsToRemove.includes(a.meta.id)
      );
    },
    clearAllQueue: (state) => {
      state.offlineActionQueue = [];
      state.totalActionsQueued = 0;
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

export const { queueAction, clearQueue, clearAllQueue, setSyncing, setLastSynced, incrementFailures, resetBackend } = syncSlice.actions;

let currentSyncAbortController = null;

export const abortSync = () => (dispatch) => {
  if (currentSyncAbortController) {
    currentSyncAbortController.abort();
    currentSyncAbortController = null;
  }
  dispatch(setSyncing(false));
};

export const clearAllData = () => ({
  type: 'sync/clearAllData'
});

export const flushQueue = (forceSync = false) => async (dispatch, getState) => {
  const { offlineActionQueue, isSyncing, backendAvailable, backendFailures } = getState().sync;

  if (offlineActionQueue.length === 0) return;
  if (!navigator.onLine) return;
  if (isSyncing) return;

  const activeFarmId = localStorage.getItem('activeFarmId') || (import.meta.env.DEV ? 'dev_farm' : 'default_farm');
  const farmActions = offlineActionQueue.filter(a => !a.farmId || a.farmId === activeFarmId);

  if (farmActions.length === 0) return;

  // If backend has consistently failed, only retry every ~60 attempts (3 min at 3s interval) unless explicitly overridden
  if (!forceSync && !backendAvailable) {
    if (backendFailures % 60 !== 0) {
      dispatch(incrementFailures());
      return;
    }
  }

  // Abort any existing controller just in case, and create a new one
  if (currentSyncAbortController) {
    currentSyncAbortController.abort();
  }
  currentSyncAbortController = new AbortController();
  const signal = currentSyncAbortController.signal;

  dispatch(setSyncing(true));

  try {
    const currentUser = getState().auth?.currentUser;
    const email = currentUser ? currentUser.email : '';
    
    // Process all pending farm actions concurrently/in parallel
    const syncPromises = farmActions.map(async (action) => {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queue: [action], farmId: activeFarmId, email }),
          signal
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.error === 'DATABASE_UNAVAILABLE' || data.ok === false) {
            return false;
          }
          const id = action.meta?.id;
          if (id) {
            dispatch(clearQueue([id]));
          }
          return true;
        } else {
          return false;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Sync fetch aborted for action:', action.type);
        } else {
          console.error('Error syncing individual action:', err);
        }
        return false;
      }
    });

    const results = await Promise.all(syncPromises);
    const successCount = results.filter(Boolean).length;

    if (successCount > 0) {
      dispatch(resetBackend());
      dispatch(setLastSynced(new Date().toISOString()));
    } else if (farmActions.length > 0 && !signal.aborted) {
      dispatch(incrementFailures());
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      dispatch(incrementFailures());
      if (backendFailures === 0) {
        console.warn('Backend unreachable — data cached locally until reconnected.');
      }
    }
  } finally {
    if (!signal.aborted) {
      dispatch(setSyncing(false));
    }
  }
};

export const fetchInitialData = () => async (dispatch, getState) => {
  try {
    const activeFarmId = localStorage.getItem('activeFarmId') || (import.meta.env.DEV ? 'dev_farm' : 'default_farm');
    const currentUser = getState().auth?.currentUser;
    const emailParam = currentUser ? `&email=${encodeURIComponent(currentUser.email)}` : '';
    const response = await fetch(`/api/all-data?farmId=${activeFarmId}${emailParam}&t=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (!response.ok) {
      console.warn(`Initial data sync skipped: Backend returned status ${response.status}. Using local cache.`);
      return;
    }
    
    const data = await response.json();
    
    if (data.error === 'DATABASE_UNAVAILABLE' || data.ok === false) {
      console.warn('Initial data sync skipped: Backend database is unavailable. Using local cache.', data.details || '');
      return;
    }
    
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
    if (data.settings && data.settings.length > 0) {
      dispatch(setAllSettings(data.settings[0]));
    } else {
      dispatch(setAllSettings({}));
    }
    if (data.poi) dispatch(setPoiData(data.poi));
    if (data.goals) dispatch(setGoals(data.goals));
    if (data.objectives) dispatch(setObjectives(data.objectives));
    if (data.recommendations) dispatch(setRecommendations(data.recommendations));
    if (data.pests) dispatch(setPests(data.pests));
    if (data.livestockDiseases) dispatch(setDiseases(data.livestockDiseases));
    if (data.soilTests) dispatch(setSoilTests(data.soilTests));
    if (data.payroll) {
      console.log('[Sync] Payroll records received from API:', data.payroll.length);
      const parsedPayrolls = [];
      data.payroll.forEach(p => {
        try {
          parsedPayrolls.push({
            ...p,
            attendance: typeof p.attendance === 'string' ? JSON.parse(p.attendance) : p.attendance || {},
            pulledEmployees: typeof p.pulledEmployees === 'string' ? JSON.parse(p.pulledEmployees) : p.pulledEmployees || [],
            customRates: typeof p.customRates === 'string' ? JSON.parse(p.customRates) : p.customRates || {},
            totals: typeof p.totals === 'string' ? JSON.parse(p.totals) : p.totals || {}
          });
          console.log(`[Sync] Successfully parsed payroll node: ${p.id}`);
        } catch (e) {
          console.error(`[Sync] Error parsing individual payroll node ${p.id}:`, e.message);
        }
      });
      console.log('[Sync] Dispatching parsed payrolls to store. Count:', parsedPayrolls.length);
      dispatch(setPayrolls(parsedPayrolls));
    }
    if (data.charcoalAlerts) {
      dispatch(setCharcoalAlerts(data.charcoalAlerts));
    }

  } catch (err) {
    console.error('Backend unreachable or initial data sync failed:', err.stack || err.message || err);
  }
};

export default syncSlice.reducer;
