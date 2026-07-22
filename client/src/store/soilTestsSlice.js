import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  tests: []
};

const soilTestsSlice = createSlice({
  name: 'soilTests',
  initialState,
  reducers: {
    saveSoilTest: (state, action) => {
      const index = state.tests.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.tests[index] = action.payload;
      } else {
        state.tests.push(action.payload);
      }
    },
    removeSoilTest: (state, action) => {
      state.tests = state.tests.filter(t => t.id !== action.payload);
    },
    setSoilTests: (state, action) => {
      state.tests = action.payload || [];
    }
  }
});

export const { saveSoilTest, removeSoilTest, setSoilTests } = soilTestsSlice.actions;
export default soilTestsSlice.reducer;
