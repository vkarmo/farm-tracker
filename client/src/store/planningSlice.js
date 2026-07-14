import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  goals: [],
  objectives: [],
  editingGoalId: null,
  editingObjId: null
};

const planningSlice = createSlice({
  name: 'planning',
  initialState,
  reducers: {
    setGoals: (state, action) => {
      state.goals = action.payload;
    },
    setObjectives: (state, action) => {
      state.objectives = action.payload;
    },
    saveGoal: (state, action) => {
      const index = state.goals.findIndex(g => g.id === action.payload.id);
      if (index !== -1) {
        state.goals[index] = action.payload;
      } else {
        state.goals.push(action.payload);
      }
    },
    removeGoal: (state, action) => {
      state.goals = state.goals.filter(g => g.id !== action.payload);
      // Also remove cascading objectives
      state.objectives = state.objectives.filter(o => o.goalId !== action.payload);
    },
    saveObjective: (state, action) => {
      const index = state.objectives.findIndex(o => o.id === action.payload.id);
      if (index !== -1) {
        state.objectives[index] = action.payload;
      } else {
        state.objectives.push(action.payload);
      }
    },
    removeObjective: (state, action) => {
      state.objectives = state.objectives.filter(o => o.id !== action.payload);
    },
    setEditingGoalIdRedux: (state, action) => {
      state.editingGoalId = action.payload;
    },
    setEditingObjectiveIdRedux: (state, action) => {
      state.editingObjId = action.payload;
    }
  }
});

export const { setGoals, setObjectives, saveGoal, removeGoal, saveObjective, removeObjective, setEditingGoalIdRedux, setEditingObjectiveIdRedux } = planningSlice.actions;
export default planningSlice.reducer;
