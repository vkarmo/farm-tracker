import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const assignmentSlice = createSlice({
  name: 'assignments',
  initialState: {
    list: [],
    editingId: null
  },
  reducers: {
    setAssignments: (state, action) => {
      state.list = action.payload;
    },
    upsertAssignment: (state, action) => {
      const index = state.list.findIndex(a => a.id === action.payload.id);
      if (index >= 0) {
        state.list[index] = action.payload;
      } else {
        state.list.push(action.payload);
      }
    },
    deleteAssignment: (state, action) => {
      state.list = state.list.filter(a => a.id !== action.payload);
    },
    setEditingAssignmentId: (state, action) => {
      state.editingId = action.payload;
    }
  }
});

export const { setAssignments, upsertAssignment, deleteAssignment, setEditingAssignmentId } = assignmentSlice.actions;

// Async Thunks wrapped into syncQueue mechanics for standalone mode compatibility
export const saveAssignment = (assignmentData) => (dispatch) => {
  dispatch(upsertAssignment(assignmentData));
  dispatch(queueAction({ type: 'assignments/upsertAssignment', payload: assignmentData, meta: { id: Date.now() } }));
};

export const removeAssignment = (id) => (dispatch) => {
  dispatch(deleteAssignment(id));
  dispatch(queueAction({ type: 'assignments/deleteAssignment', payload: id, meta: { id: Date.now() } }));
};

export default assignmentSlice.reducer;
