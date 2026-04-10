import { createSlice } from '@reduxjs/toolkit';

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    units: ['lbs', 'kg', 'bushels', 'crates', 'tons'],
    kmlUrls: [], // Array of URLs to fetch and render
    logo: null, // Base64 encoded logo image
    polygonColor: '#ffffff',
    mapCenter: [51.505, -0.09]
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
    }
  }
});

export const { addUnit, removeUnit, addKmlUrl, removeKmlUrl, setLogo, setPolygonColor, setMapCenter } = settingsSlice.actions;
export default settingsSlice.reducer;
