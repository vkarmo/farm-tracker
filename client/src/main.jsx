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

import { GoogleOAuthProvider } from '@react-oauth/google';

// Injected at build time to guarantee a unique bundle hash per deploy
console.info('Farm Tracker build:', typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev');

// Force-reload when a new service worker takes control so users always get the latest build
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement._reactRoot) {
  rootElement._reactRoot = ReactDOM.createRoot(rootElement);
}

rootElement._reactRoot.render(
  <Provider store={store}>
    <PersistGate loading={<div>Loading App State...</div>} persistor={persistor}>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "95276392841-r1cogm3i20a6vp6v0953dk63ikkvh3g9.apps.googleusercontent.com"}>
        <SyncController>
          <App />
        </SyncController>
      </GoogleOAuthProvider>
    </PersistGate>
  </Provider>
);
