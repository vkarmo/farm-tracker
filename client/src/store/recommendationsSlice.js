import { createSlice } from '@reduxjs/toolkit';

export const recommendationsSlice = createSlice({
  name: 'recommendations',
  initialState: {
    data: [], // Each recommendation: { id, name, link, active, createdAt }
  },
  reducers: {
    addRecommendation: (state, action) => {
      const idx = state.data.findIndex(r => r.id === action.payload.id);
      if (idx !== -1) {
        state.data[idx] = action.payload;
      } else {
        state.data.push(action.payload);
      }
    },
    updateRecommendation: (state, action) => {
      const idx = state.data.findIndex(r => r.id === action.payload.id);
      if (idx !== -1) {
        state.data[idx] = { ...state.data[idx], ...action.payload };
      }
    },
    deleteRecommendation: (state, action) => {
      state.data = state.data.filter(r => r.id !== action.payload);
    },
    setRecommendations: (state, action) => {
      state.data = action.payload;
    }
  }
});

export const { addRecommendation, updateRecommendation, deleteRecommendation, setRecommendations } = recommendationsSlice.actions;

export default recommendationsSlice.reducer;
