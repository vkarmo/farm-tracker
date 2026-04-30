import { createSlice } from '@reduxjs/toolkit';

export const authSlice = createSlice({
  name: 'auth',
  initialState: {
    currentUser: null,
    usersList: [] // For admin view cache
  },
  reducers: {
    login: (state, action) => {
      state.currentUser = action.payload;
    },
    logout: (state) => {
      state.currentUser = null;
    },
    setUsersList: (state, action) => {
      state.usersList = action.payload;
    },
    removeUserOffline: (state, action) => {
      state.usersList = state.usersList.filter(u => u.email !== action.payload);
    },
    updateUserAccess: (state, action) => {
      const idx = state.usersList.findIndex(u => u.email === action.payload.email);
      if (idx !== -1) {
        state.usersList[idx].allowedTabs = action.payload.allowedTabs;
      }
    },
    updateUserRole: (state, action) => {
      const idx = state.usersList.findIndex(u => u.email === action.payload.email);
      if (idx !== -1) {
        state.usersList[idx].role = action.payload.role;
      }
    }
  }
});

export const { login, logout, setUsersList, removeUserOffline, updateUserAccess, updateUserRole } = authSlice.actions;

// Thunk to fetch users list for Admin
export const fetchAllUsers = () => async (dispatch) => {
  if (!navigator.onLine) return;
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const users = await res.json();
      dispatch(setUsersList(users));
    }
  } catch (err) {
    console.error('Failed to fetch users from backend', err);
  }
};

export default authSlice.reducer;
