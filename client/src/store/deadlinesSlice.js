import { createSlice } from '@reduxjs/toolkit';

export const deadlinesSlice = createSlice({
  name: 'deadlines',
  initialState: {
    list: []
  },
  reducers: {
    addDeadline: (state, action) => {
      const idx = state.list.findIndex(d => d.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
      else state.list.push(action.payload);
    },
    deleteDeadline: (state, action) => {
      state.list = state.list.filter(d => d.id !== action.payload);
    }
  }
});

export const { addDeadline, deleteDeadline } = deadlinesSlice.actions;
export default deadlinesSlice.reducer;
