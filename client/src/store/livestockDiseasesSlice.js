import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  list: []
};

const livestockDiseasesSlice = createSlice({
  name: 'livestockDiseases',
  initialState,
  reducers: {
    saveDisease: (state, action) => {
      const index = state.list.findIndex(d => d.id === action.payload.id);
      if (index !== -1) {
        state.list[index] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    removeDisease: (state, action) => {
      state.list = state.list.filter(d => d.id !== action.payload);
    }
  }
});

export const { saveDisease, removeDisease } = livestockDiseasesSlice.actions;
export default livestockDiseasesSlice.reducer;
