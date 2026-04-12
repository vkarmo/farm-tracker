import { createSlice } from '@reduxjs/toolkit';

export const fieldsSlice = createSlice({
  name: 'fields',
  initialState: {
    data: [], // Each field: { id, name, area, status }
  },
  reducers: {
    addField: (state, action) => {
      // Look for update
      const idx = state.data.findIndex(f => f.id === action.payload.id);
      if (idx !== -1) {
        state.data[idx] = action.payload;
      } else {
        state.data.push(action.payload);
      }
    },
    updateField: (state, action) => {
      const idx = state.data.findIndex(f => f.id === action.payload.id);
      if (idx !== -1) state.data[idx] = { ...state.data[idx], ...action.payload };
    },
    deleteField: (state, action) => {
      state.data = state.data.filter(f => f.id !== action.payload);
    },
    setFields: (state, action) => {
      state.data = action.payload;
    }
  }
});

export const { addField, updateField, deleteField, setFields } = fieldsSlice.actions;

export const fetchFields = () => async (dispatch) => {
  // PWA Standalone Mode: Backend dismantled. 
  // Serving local IndexedDB storage.
  return;
};

export default fieldsSlice.reducer;
