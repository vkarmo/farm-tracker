import { createSlice } from '@reduxjs/toolkit';

export const payrollSlice = createSlice({
  name: 'payroll',
  initialState: {
    list: []
  },
  reducers: {
    setPayrolls: (state, action) => {
      state.list = action.payload || [];
    },
    savePayroll: (state, action) => {
      const idx = state.list.findIndex(p => p.id === action.payload.id);
      if (idx >= 0) {
        state.list[idx] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    deletePayroll: (state, action) => {
      state.list = state.list.filter(p => p.id !== action.payload);
    }
  }
});

export const { setPayrolls, savePayroll, deletePayroll } = payrollSlice.actions;
export default payrollSlice.reducer;
