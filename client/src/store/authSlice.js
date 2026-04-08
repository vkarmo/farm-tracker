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
    }
  }
});

export const { login, logout, setUsersList, removeUserOffline } = authSlice.actions;

// Thunk to fetch users list for Admin
export const fetchAllUsers = () => async (dispatch) => {
  try {
    const response = await fetch('http://localhost:3001/api/users');
    if (response.ok) {
      const users = await response.json();
      dispatch(setUsersList(users));
    }
  } catch (err) {
    console.error('Failed to fetch users', err);
  }
};

export default authSlice.reducer;
