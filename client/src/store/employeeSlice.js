import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const employeeSlice = createSlice({
  name: 'employees',
  initialState: {
    list: []
  },
  reducers: {
    setEmployees: (state, action) => {
      state.list = action.payload;
    },
    upsertEmployee: (state, action) => {
      const index = state.list.findIndex(e => e.id === action.payload.id);
      if (index >= 0) {
        state.list[index] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    deleteEmployee: (state, action) => {
      state.list = state.list.filter(e => e.id !== action.payload);
    }
  }
});

export const { setEmployees, upsertEmployee, deleteEmployee } = employeeSlice.actions;

export const saveEmployee = (employeeData) => (dispatch) => {
  dispatch(upsertEmployee(employeeData));
  dispatch(queueAction({ type: 'employees/upsertEmployee', payload: employeeData, meta: { id: Date.now() } }));
};

export const removeEmployee = (id) => (dispatch) => {
  dispatch(deleteEmployee(id));
  dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
};

export default employeeSlice.reducer;
