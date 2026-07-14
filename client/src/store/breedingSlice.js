import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const breedingSlice = createSlice({
  name: 'breeding',
  initialState: {
    pairings: [],
    kits: []
  },
  reducers: {
    setPairings: (state, action) => {
      state.pairings = action.payload;
    },
    upsertPairing: (state, action) => {
      const i = state.pairings.findIndex(p => p.id === action.payload.id);
      if (i >= 0) state.pairings[i] = action.payload;
      else state.pairings.push(action.payload);
    },
    deletePairing: (state, action) => {
      state.pairings = state.pairings.filter(p => p.id !== action.payload);
    },
    setKits: (state, action) => {
      state.kits = action.payload;
    },
    upsertKit: (state, action) => {
      const i = state.kits.findIndex(k => k.id === action.payload.id);
      if (i >= 0) state.kits[i] = action.payload;
      else state.kits.push(action.payload);
    },
    deleteKit: (state, action) => {
      state.kits = state.kits.filter(k => k.id !== action.payload);
    }
  }
});

export const {
  setPairings, upsertPairing, deletePairing,
  setKits, upsertKit, deleteKit
} = breedingSlice.actions;

export const savePairing = (data) => (dispatch) => {
  dispatch(upsertPairing(data));
  dispatch(queueAction({ type: 'breeding/upsertPairing', payload: data, meta: { id: Date.now() } }));
};

export const removePairing = (id) => (dispatch) => {
  dispatch(deletePairing(id));
  dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
};

export const saveKit = (data) => (dispatch) => {
  dispatch(upsertKit(data));
  dispatch(queueAction({ type: 'breeding/upsertKit', payload: data, meta: { id: Date.now() } }));
};

export const removeKit = (id) => (dispatch) => {
  dispatch(deleteKit(id));
  dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() } }));
};

export default breedingSlice.reducer;
