import { createSlice } from '@reduxjs/toolkit';

export const breedingSlice = createSlice({
  name: 'breeding',
  initialState: {
    events: []
  },
  reducers: {
    addBreedingEvent: (state, action) => {
      const idx = state.events.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.events[idx] = action.payload;
      else state.events.push(action.payload);
    },
    updateBreedingEvent: (state, action) => {
      const idx = state.events.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.events[idx] = { ...state.events[idx], ...action.payload };
    },
    deleteBreedingEvent: (state, action) => {
      state.events = state.events.filter(e => e.id !== action.payload);
    },
    setBreedingEvents: (state, action) => {
      state.events = action.payload;
    }
  }
});

export const { 
  addBreedingEvent, updateBreedingEvent, deleteBreedingEvent, setBreedingEvents
} = breedingSlice.actions;

export default breedingSlice.reducer;
