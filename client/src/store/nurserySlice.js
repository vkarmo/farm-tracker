import { createSlice } from '@reduxjs/toolkit';

export const nurserySlice = createSlice({
  name: 'nurseries',
  initialState: {
    beds: []
  },
  reducers: {
    addBed: (state, action) => {
      const idx = state.beds.findIndex(b => b.id === action.payload.id);
      if (idx !== -1) state.beds[idx] = action.payload;
      else state.beds.push(action.payload);
    },
    deleteBed: (state, action) => {
      state.beds = state.beds.filter(b => b.id !== action.payload);
    },
    setBeds: (state, action) => {
      state.beds = action.payload;
    }
  }
});

export const { addBed, deleteBed, setBeds } = nurserySlice.actions;
export default nurserySlice.reducer;
