import { createSlice } from '@reduxjs/toolkit';
import { queueAction } from './syncSlice';

export const auditSlice = createSlice({
  name: 'audit',
  initialState: {
    logs: [] // { id, timestamp, userEmail, actionType, details, tab }
  },
  reducers: {
    setLogs: (state, action) => {
      state.logs = action.payload;
    },
    logAction: (state, action) => {
      // Limit to last 500 actions to avoid massive state bloat over time
      if (state.logs.length >= 500) {
        state.logs.shift();
      }
      state.logs.push(action.payload);
    },
    clearLogs: (state) => {
      state.logs = [];
    },
    deleteLogs: (state, action) => {
      const ids = action.payload;
      state.logs = state.logs.filter(log => !ids.includes(log.id));
    }
  }
});

export const { setLogs, logAction, clearLogs, deleteLogs } = auditSlice.actions;

export const deleteAuditLogs = (ids) => (dispatch) => {
  dispatch(deleteLogs(ids));
  ids.forEach(id => {
    dispatch(queueAction({ type: 'core/deleteNode', payload: { id }, meta: { id: Date.now() + Math.random() } }));
  });
};

// Redux Middleware to automatically capture CRUD operations
export const auditMiddleware = storeAPI => next => action => {
  // Let the action pass through to update state first, or before? 
  // We can do it before.
  const result = next(action);

  // We don't want to log audit events themselves or sync/persist noise
  if (
    action.type.startsWith('audit/') ||
    action.type.startsWith('persist/') ||
    action.type.startsWith('sync/')
  ) {
    return result;
  }

  // Detect CRUD actions
  const type = action.type.toLowerCase();
  
  let actionType = '';
  let details = action.type; // Default to the action signature

  if (type.includes('add')) {
    actionType = 'SAVE';
  } else if (type.includes('update') || type.includes('edit')) {
    actionType = 'EDIT';
  } else if (type.includes('delete') || type.includes('remove')) {
    actionType = 'DELETE';
    details = `Deleted record ID/Name: ${action.payload}`;
  } else if (type.includes('login')) {
    actionType = 'LOGIN';
  } else if (type.includes('logout')) {
    actionType = 'LOGOUT';
  }

  // If this is an action we want to track
  if (actionType) {
    const state = storeAPI.getState();
    const currentUser = state.auth?.currentUser;
    
    // Only track if user is logged in (keeps anonymous login attempts from crashing)
    if (currentUser) {
      // Format details nicely if payload is an object
      let formattedDetails = details;
      if (actionType !== 'DELETE' && typeof action.payload === 'object' && action.payload !== null) {
         const nameIdent = action.payload.name || action.payload.id || action.payload.title || 'a record';
         formattedDetails = `${action.type.split('/')[1] || 'modified'} on ${nameIdent}`;
      }

      storeAPI.dispatch(auditSlice.actions.logAction({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        timestamp: new Date().toISOString(),
        userEmail: currentUser.email || currentUser.name || 'Unknown User',
        actionType,
        details: formattedDetails
      }));
    }
  }

  return result;
};

export default auditSlice.reducer;
