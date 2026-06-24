import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: []
};

const pestsSlice = createSlice({
  name: 'pests',
  initialState,
  reducers: {
    setPests: (state, action) => {
      state.list = action.payload || [];
    },
    savePest: (state, action) => {
      const index = state.list.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    removePest: (state, action) => {
      state.list = state.list.filter(p => p.id !== action.payload);
    }
  }
});

export const { setPests, savePest, removePest } = pestsSlice.actions;
export default pestsSlice.reducer;
