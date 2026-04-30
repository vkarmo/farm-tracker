import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    appName: '',
    units: ['lbs', 'kg', 'bushels', 'crates', 'tons'],
    kmlUrls: [],
    logo: null,
    polygonColor: '#2e7d32',
    mapCenter: [51.505, -0.09],
    mapZoom: 13,
    gpsDistanceThreshold: 10,
    jobTitles: ['Foreman', 'Harvester', 'Tractor Operator', 'Security', 'Manager'],
    expenseCategories: ['Equipment Maintenance', 'Fertilizer', 'Fuel', 'Labor', 'Seed'],
    incomeCategories: ['Crop Sale', 'Livestock Sale', 'Subsidy'],
  },
  reducers: {
    addUnit: (state, action) => {
      if (!state.units.includes(action.payload)) {
        state.units.push(action.payload);
      }
    },
    removeUnit: (state, action) => {
      state.units = state.units.filter(u => u !== action.payload);
    },
    addJobTitle: (state, action) => {
      if (!state.jobTitles) state.jobTitles = [];
      if (!state.jobTitles.includes(action.payload)) {
        state.jobTitles.push(action.payload);
      }
    },
    removeJobTitle: (state, action) => {
      if (!state.jobTitles) state.jobTitles = [];
      state.jobTitles = state.jobTitles.filter(t => t !== action.payload);
    },
    addExpenseCategory: (state, action) => {
      if (!state.expenseCategories) state.expenseCategories = [];
      if (!state.expenseCategories.includes(action.payload)) {
        state.expenseCategories.push(action.payload);
      }
    },
    removeExpenseCategory: (state, action) => {
      if (!state.expenseCategories) state.expenseCategories = [];
      state.expenseCategories = state.expenseCategories.filter(c => c !== action.payload);
    },
    addIncomeCategory: (state, action) => {
      if (!state.incomeCategories) state.incomeCategories = [];
      if (!state.incomeCategories.includes(action.payload)) {
        state.incomeCategories.push(action.payload);
      }
    },
    removeIncomeCategory: (state, action) => {
      if (!state.incomeCategories) state.incomeCategories = [];
      state.incomeCategories = state.incomeCategories.filter(c => c !== action.payload);
    },
    addKmlUrl: (state, action) => {
      if (!state.kmlUrls) state.kmlUrls = [];
      if (!state.kmlUrls.includes(action.payload)) {
        state.kmlUrls.push(action.payload);
      }
    },
    removeKmlUrl: (state, action) => {
      if (!state.kmlUrls) state.kmlUrls = [];
      state.kmlUrls = state.kmlUrls.filter(u => u !== action.payload);
    },
    setLogo: (state, action) => {
      state.logo = action.payload;
    },
    setPolygonColor: (state, action) => {
      state.polygonColor = action.payload;
    },
    setMapCenter: (state, action) => {
      state.mapCenter = action.payload;
    },
    setMapZoom: (state, action) => {
      state.mapZoom = action.payload;
    },
    setGpsDistanceThreshold: (state, action) => {
      state.gpsDistanceThreshold = action.payload;
    },
    setAppName: (state, action) => {
      state.appName = action.payload;
    },
    setAllSettings: (state, action) => {
      return { ...state, ...action.payload };
    }
  }
});

export const { addUnit, removeUnit, addJobTitle, removeJobTitle, addExpenseCategory, removeExpenseCategory, addIncomeCategory, removeIncomeCategory, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold, setAppName, setAllSettings } = settingsSlice.actions;

export const saveSettings = () => (dispatch, getState) => {
  const settings = getState().settings;
  dispatch(queueAction({ type: 'settings/updateGlobal', payload: settings, meta: { id: Date.now() } }));
};

export default settingsSlice.reducer;
