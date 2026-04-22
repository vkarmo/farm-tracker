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
<<<<<<< HEAD
=======
import auditReducer, { auditMiddleware } from './auditSlice';
>>>>>>> main

// Persist config that uses IndexedDB via localforage
const persistConfig = {
  key: 'root',
  storage: localForage,
<<<<<<< HEAD
  whitelist: ['sync', 'fields', 'assets', 'financials', 'settings', 'nurseries', 'activities', 'auth', 'budgets', 'deadlines', 'incidents', 'assignments', 'employees'] // Store all entity & settings data
=======
  whitelist: ['sync', 'fields', 'assets', 'financials', 'settings', 'nurseries', 'activities', 'auth', 'budgets', 'deadlines', 'incidents', 'assignments', 'employees', 'audit'] // Store all entity & settings data
>>>>>>> main
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
<<<<<<< HEAD
  employees: employeeReducer
=======
  employees: employeeReducer,
  audit: auditReducer
>>>>>>> main
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER'],
      },
    }).concat(auditMiddleware),
});

export const persistor = persistStore(store);
