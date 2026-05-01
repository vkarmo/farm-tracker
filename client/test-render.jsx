import React from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AssignmentTab from './src/components/AssignmentTab.jsx';

const store = configureStore({
  reducer: {
    assignments: (state = { list: [
      { id: 1, fieldId: 1, task: 'Test', assignmentDate: '2026-05-01' },
      { id: 2, workerIds: [1,2], workerCount: undefined }
    ] }) => state,
    fields: (state = { data: [
      { id: 1, name: undefined, area: undefined }
    ] }) => state,
    employees: (state = { list: [
      { id: 1, jobTitle: undefined, lastName: undefined },
      { id: 2, jobTitle: 123 }
    ] }) => state,
    nurseries: (state = { beds: [
      { id: 1 }
    ] }) => state,
    assets: (state = { crops: [
      { id: 1 }
    ] }) => state,
    planning: (state = { goals: [ { id: 1 } ], objectives: [ { id: 1, goalId: 1 } ] }) => state,
    settings: (state = {}) => state
  }
});

try {
  const html = renderToString(
    <Provider store={store}>
      <AssignmentTab />
    </Provider>
  );
  console.log("RENDER SUCCESS!");
} catch (e) {
  console.error("RENDER FAILED:", e.message);
  console.error(e.stack);
}
