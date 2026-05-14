import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import localForage from 'localforage';
import syncReducer from './syncSlice';
import fieldsReducer from './fieldsSlice';
import assetsReducer from './assetsSlice';
import financialsReducer from './financialsSlice';
import settingsReducer from './settingsSlice';
import nurseryReducer from './nurserySlice';
import activityReducer from './activitySlice';
import authReducer from './authSlice';
import budgetReducer from './budgetSlice';
import deadlinesReducer from './deadlinesSlice';
import incidentsReducer from './incidentsSlice';
import assignmentReducer from './assignmentSlice';
import employeeReducer from './employeeSlice';
import auditReducer, { auditMiddleware } from './auditSlice';
import gpsReducer from './gpsSlice';
import breedingReducer from './breedingSlice';
import pestsReducer from './pestsSlice';
import planningReducer from './planningSlice';
import soilTestsReducer from './soilTestsSlice';
import livestockDiseasesReducer from './livestockDiseasesSlice';
import poiReducer from './poiSlice';
import recommendationsReducer from './recommendationsSlice';

const persistConfig = {
  key: 'root',
  storage: localForage,
  whitelist: ['sync', 'fields', 'assets', 'financials', 'settings', 'nurseries', 'activities', 'auth', 'budgets', 'deadlines', 'incidents', 'assignments', 'employees', 'audit', 'gps', 'breeding', 'pests', 'planning', 'soilTests', 'livestockDiseases', 'poi', 'recommendations'] // Store all entity & settings data
};

const rootReducer = combineReducers({
  sync: syncReducer,
  fields: fieldsReducer,
  assets: assetsReducer,
  financials: financialsReducer,
  settings: settingsReducer,
  nurseries: nurseryReducer,
  activities: activityReducer,
  auth: authReducer,
  budgets: budgetReducer,
  deadlines: deadlinesReducer,
  incidents: incidentsReducer,
  assignments: assignmentReducer,
  employees: employeeReducer,
  audit: auditReducer,
  gps: gpsReducer,
  breeding: breedingReducer,
  pests: pestsReducer,
  soilTests: soilTestsReducer,
  livestockDiseases: livestockDiseasesReducer,
  poi: poiReducer,
  planning: planningReducer,
  recommendations: recommendationsReducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const reduxLoggingMiddleware = store => next => action => {
  if (action.type !== 'persist/PERSIST' && action.type !== 'persist/REHYDRATE' && action.type !== 'persist/REGISTER') {
    console.log(`[Redux Sync] SAVING DATA TO REDUX - Action Type: ${action.type}`);
    if (action.payload) {
      console.log(`[Redux Sync] Data Payload:`, action.payload);
    }
  }
  return next(action);
};

const timestampMiddleware = store => next => action => {
  if (action.type && action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)) {
    if (action.type.includes('/add') || action.type.includes('/update')) {
      if (!action.type.startsWith('sync/') && !action.type.startsWith('settings/') && !action.type.startsWith('auth/')) {
        const newAction = {
          ...action,
          payload: {
            ...action.payload,
            updatedAt: action.payload.updatedAt || Date.now()
          }
        };
        return next(newAction);
      }
    }
  }
  return next(action);
};

const injectUserMiddleware = store => next => action => {
  if (action.type === 'sync/queueAction') {
    const currentUser = store.getState().auth?.currentUser;
    if (currentUser?.email) {
      if (action.payload && action.payload.payload) {
        // Create a new action object to avoid mutating the frozen original
        const newAction = {
          ...action,
          payload: {
            ...action.payload,
            payload: {
              ...action.payload.payload,
              lastUpdatedBy: currentUser.email
            }
          }
        };
        return next(newAction);
      }
    }
  }
  return next(action);
};

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER'],
      },
    }).concat(auditMiddleware, timestampMiddleware, injectUserMiddleware, reduxLoggingMiddleware),
});

export const persistor = persistStore(store);
