import { createSlice } from '@reduxjs/toolkit';

const sortFieldsList = (list) => {
  return [...list].sort((a, b) => {
    const isOverallA = a.isOverallMap === true || a.isOverallMap === 'true' || a.name === 'NMK Property';
    const isOverallB = b.isOverallMap === true || b.isOverallMap === 'true' || b.name === 'NMK Property';
    
    if (isOverallA && !isOverallB) return -1;
    if (!isOverallA && isOverallB) return 1;
    
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
};

export const fieldsSlice = createSlice({
  name: 'fields',
  initialState: {
    data: [], // Each field: { id, name, area, status }
  },
  reducers: {
    addField: (state, action) => {
      const field = action.payload;
      const isNmk = field && field.name && (field.name === 'NMK Property' || field.name.includes('NMK Property'));
      const sanitizedField = {
        ...field,
        isOverallMap: field && field.isOverallMap !== undefined
          ? (field.isOverallMap === true || field.isOverallMap === 'true')
          : !!isNmk
      };
      const idx = state.data.findIndex(f => f.id === sanitizedField.id);
      if (idx !== -1) {
        state.data[idx] = sanitizedField;
      } else {
        state.data.push(sanitizedField);
      }
      state.data = sortFieldsList(state.data);
    },
    updateField: (state, action) => {
      const idx = state.data.findIndex(f => f.id === action.payload.id);
      if (idx !== -1) {
        const updated = { ...state.data[idx], ...action.payload };
        const isNmk = updated.name && (updated.name === 'NMK Property' || updated.name.includes('NMK Property'));
        state.data[idx] = {
          ...updated,
          isOverallMap: updated.isOverallMap !== undefined
            ? (updated.isOverallMap === true || updated.isOverallMap === 'true')
            : !!isNmk
        };
      }
      state.data = sortFieldsList(state.data);
    },
    deleteField: (state, action) => {
      state.data = sortFieldsList(state.data.filter(f => f.id !== action.payload));
    },
    setFields: (state, action) => {
      const mapped = (action.payload || []).map(f => {
        const isNmk = f.name && (f.name === 'NMK Property' || f.name.includes('NMK Property'));
        return {
          ...f,
          isOverallMap: f.isOverallMap !== undefined
            ? (f.isOverallMap === true || f.isOverallMap === 'true')
            : !!isNmk
        };
      });
      state.data = sortFieldsList(mapped);
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
