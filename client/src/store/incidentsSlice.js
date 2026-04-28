import { createSlice } from '@reduxjs/toolkit';

export const incidentsSlice = createSlice({
  name: 'incidents',
  initialState: {
    list: []
  },
  reducers: {
    setIncidents: (state, action) => {
      state.list = action.payload;
    },
    addIncident: (state, action) => {
      const idx = state.list.findIndex(i => i.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
      else state.list.push(action.payload);
    },
    deleteIncident: (state, action) => {
      state.list = state.list.filter(i => i.id !== action.payload);
    }
  }
});

export const { setIncidents, addIncident, deleteIncident } = incidentsSlice.actions;
export default incidentsSlice.reducer;
