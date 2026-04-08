import { createSlice } from '@reduxjs/toolkit';

export const financialsSlice = createSlice({
  name: 'financials',
  initialState: {
    transactions: [], // Expenses and Sales
  },
  reducers: {
    addTransaction: (state, action) => {
      const idx = state.transactions.findIndex(t => t.id === action.payload.id);
      if (idx !== -1) state.transactions[idx] = action.payload;
      else state.transactions.push(action.payload);
    },
    deleteTransaction: (state, action) => {
      state.transactions = state.transactions.filter(t => t.id !== action.payload);
    },
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    }
  }
});

export const { addTransaction, deleteTransaction, setTransactions } = financialsSlice.actions;
export default financialsSlice.reducer;
