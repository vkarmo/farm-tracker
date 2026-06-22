import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const gpsSlice = createSlice({
  name: 'gps',
  initialState: {
    locations: []
  },
  reducers: {
    setLocations: (state, action) => {
      state.locations = action.payload;
    },
    addLocation: (state, action) => {
      // payload expects { lat, lng, timestamp, userEmail }
      state.locations.push(action.payload);
    },
    clearLocations: (state) => {
      state.locations = [];
    },
    deleteLocations: (state, action) => {
      const ids = action.payload;
      state.locations = state.locations.filter(loc => !ids.includes(loc.id));
    }
  }
});

export const { setLocations, addLocation, clearLocations, deleteLocations } = gpsSlice.actions;

export const deleteGpsLocations = (ids) => (dispatch) => {
  dispatch(deleteLocations(ids));
  ids.forEach(id => {
    dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() + Math.random() } }));
  });
};

export default gpsSlice.reducer;
