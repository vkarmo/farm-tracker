import { createSlice } from '@reduxjs/toolkit';

export const activitySlice = createSlice({
  name: 'activities',
  initialState: {
    log: []
  },
  reducers: {
    addActivity: (state, action) => {
      const idx = state.log.findIndex(a => a.id === action.payload.id);
      if (idx !== -1) state.log[idx] = action.payload;
      else state.log.push(action.payload);
    },
    deleteActivity: (state, action) => {
      state.log = state.log.filter(a => a.id !== action.payload);
    },
    setActivities: (state, action) => {
      state.log = action.payload;
    }
  }
});

export const { addActivity, deleteActivity, setActivities } = activitySlice.actions;
export default activitySlice.reducer;
