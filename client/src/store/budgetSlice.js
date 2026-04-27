import { createSlice } from '@reduxjs/toolkit';

export const budgetSlice = createSlice({
  name: 'budgets',
  initialState: {
    list: []
  },
  reducers: {
    setBudgets: (state, action) => {
      state.list = action.payload;
    },
    addBudget: (state, action) => {
      const existing = state.list.findIndex(b => b.id === action.payload.id);
      if (existing >= 0) state.list[existing] = action.payload;
      else state.list.push(action.payload);
    },
    deleteBudget: (state, action) => {
      state.list = state.list.filter(b => b.id !== action.payload);
    },
    addBudgetItem: (state, action) => {
      const { budgetId, item } = action.payload;
      const budget = state.list.find(b => b.id === budgetId);
      if (budget) {
        if (!budget.items) budget.items = [];
        const existing = budget.items.findIndex(i => i.id === item.id);
        if (existing >= 0) budget.items[existing] = item;
        else budget.items.push(item);
      }
    },
    deleteBudgetItem: (state, action) => {
      const { budgetId, itemId } = action.payload;
      const budget = state.list.find(b => b.id === budgetId);
      if (budget && budget.items) {
        budget.items = budget.items.filter(i => i.id !== itemId);
      }
    }
  }
});

export const { setBudgets, addBudget, deleteBudget, addBudgetItem, deleteBudgetItem } = budgetSlice.actions;
export default budgetSlice.reducer;
