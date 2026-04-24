import { createSlice } from '@reduxjs/toolkit';

export const gpsSlice = createSlice({
  name: 'gps',
  initialState: {
    locations: []
  },
  reducers: {
    addLocation: (state, action) => {
      // payload expects { lat, lng, timestamp, userEmail }
      state.locations.push(action.payload);
    },
    clearLocations: (state) => {
      state.locations = [];
    }
  }
});

export const { addLocation, clearLocations } = gpsSlice.actions;
export default gpsSlice.reducer;
