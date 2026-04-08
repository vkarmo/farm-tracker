import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { flushQueue } from './store/syncSlice';
import App from './App';
import './index.css';

// Component wrapper to handle network listeners securely within Provider
const SyncController = ({ children }) => {
  const dispatch = useDispatch();

  useEffect(() => {
    const handleOnline = () => {
      console.log('App is online. Processing sync queue...');
      dispatch(flushQueue());
    };

    window.addEventListener('online', handleOnline);
    
    // Auto-sync every 3 seconds if there are items in the queue and we're online
    const syncInterval = setInterval(() => {
      if (navigator.onLine) dispatch(flushQueue());
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
    };
  }, [dispatch]);

  return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PersistGate loading={<div>Loading App State...</div>} persistor={persistor}>
      <SyncController>
        <App />
      </SyncController>
    </PersistGate>
  </Provider>
);
