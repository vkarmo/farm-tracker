import { createSlice } from '@reduxjs/toolkit';

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    units: ['lbs', 'kg', 'bushels', 'crates', 'tons'],
    kmlUrls: [],
    logo: null,
    polygonColor: '#2e7d32',
    mapCenter: [51.505, -0.09],
    mapZoom: 13,
    gpsDistanceThreshold: 10,
    jobTitles: ['Foreman', 'Harvester', 'Tractor Operator', 'Security', 'Manager'],
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
  }
});

export const { addUnit, removeUnit, addJobTitle, removeJobTitle, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter, setMapZoom, setGpsDistanceThreshold } = settingsSlice.actions;
export default settingsSlice.reducer;
