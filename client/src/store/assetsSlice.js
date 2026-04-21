import { createSlice } from '@reduxjs/toolkit';

export const assetsSlice = createSlice({
  name: 'assets',
  initialState: {
    crops: [], 
    livestock: [],
    harvests: [],
    equipment: []
  },
  reducers: {
    addCrop: (state, action) => {
      const idx = state.crops.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) state.crops[idx] = action.payload;
      else state.crops.push(action.payload);
    },
    updateCrop: (state, action) => {
      const idx = state.crops.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) state.crops[idx] = { ...state.crops[idx], ...action.payload };
    },
    deleteCrop: (state, action) => {
      state.crops = state.crops.filter(c => c.id !== action.payload);
    },
    addLivestock: (state, action) => {
      const idx = state.livestock.findIndex(l => l.id === action.payload.id);
      if (idx !== -1) state.livestock[idx] = action.payload;
      else state.livestock.push(action.payload);
    },
    updateLivestock: (state, action) => {
      const idx = state.livestock.findIndex(l => l.id === action.payload.id);
      if (idx !== -1) state.livestock[idx] = { ...state.livestock[idx], ...action.payload };
    },
    deleteLivestock: (state, action) => {
      state.livestock = state.livestock.filter(l => l.id !== action.payload);
    },
    addHarvest: (state, action) => {
      const idx = state.harvests.findIndex(h => h.id === action.payload.id);
      if (idx !== -1) state.harvests[idx] = action.payload;
      else state.harvests.push(action.payload);
    },
    updateHarvest: (state, action) => {
      const idx = state.harvests.findIndex(h => h.id === action.payload.id);
      if (idx !== -1) state.harvests[idx] = { ...state.harvests[idx], ...action.payload };
    },
    deleteHarvest: (state, action) => {
      state.harvests = state.harvests.filter(h => h.id !== action.payload);
    },
    addEquipment: (state, action) => {
      const idx = state.equipment.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.equipment[idx] = action.payload;
      else state.equipment.push(action.payload);
    },
    updateEquipment: (state, action) => {
      const idx = state.equipment.findIndex(e => e.id === action.payload.id);
      if (idx !== -1) state.equipment[idx] = { ...state.equipment[idx], ...action.payload };
    },
    deleteEquipment: (state, action) => {
      state.equipment = state.equipment.filter(e => e.id !== action.payload);
    },
    setCrops: (state, action) => {
      state.crops = action.payload;
    },
    setLivestock: (state, action) => {
      state.livestock = action.payload;
    },
    setHarvests: (state, action) => {
      state.harvests = action.payload;
    },
    setEquipment: (state, action) => {
      state.equipment = action.payload;
    },
    transplantCrop: (state, action) => {
      // payload = { id: cropId, fieldId: newFieldId, transplantDate: string }
      const idx = state.crops.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) {
        state.crops[idx].fieldId = action.payload.fieldId;
        state.crops[idx].transplantDate = action.payload.transplantDate;
        state.crops[idx].sowType = 'Transplanted';
      }
    }
  }
});

export const { 
  addCrop, updateCrop, deleteCrop, 
  addLivestock, updateLivestock, deleteLivestock, 
  addHarvest, updateHarvest, deleteHarvest, 
  addEquipment, updateEquipment, deleteEquipment,
  setCrops, setLivestock, setHarvests, setEquipment, transplantCrop 
} = assetsSlice.actions;
export default assetsSlice.reducer;
