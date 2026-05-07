import { createSlice } from '@reduxjs/toolkit';

const poiSlice = createSlice({
  name: 'poi',
  initialState: {
    list: []
  },
  reducers: {
    setPoiData(state, action) {
      state.list = action.payload;
    },
    addPoi(state, action) {
      const index = state.list.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    deletePoi(state, action) {
      state.list = state.list.filter(p => p.id !== action.payload);
    }
  }
});

export const { setPoiData, addPoi, deletePoi } = poiSlice.actions;
export default poiSlice.reducer;
