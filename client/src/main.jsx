import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { flushQueue } from './store/syncSlice';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon to use inline SVG to be offline-ready and avoid missing assets/crashes
const defaultInlineIcon = L.divIcon({
  html: `<svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0Z" fill="#2563eb"/>
    <circle cx="15" cy="15" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -40],
  className: ''
});

L.Marker.prototype.options.icon = defaultInlineIcon;

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

    // Track input population for CSS styling
    const updatePopulatedState = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.target.type !== 'radio' && e.target.type !== 'checkbox') {
          if (e.target.value) {
            e.target.setAttribute('data-populated', 'true');
          } else {
            e.target.removeAttribute('data-populated');
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('input', updatePopulatedState, true);
    document.addEventListener('change', updatePopulatedState, true);
    document.addEventListener('blur', updatePopulatedState, true);

    // Auto-sync every 3 seconds if there are items in the queue and we're online
    const syncInterval = setInterval(() => {
      if (navigator.onLine) dispatch(flushQueue());
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('input', updatePopulatedState, true);
      document.removeEventListener('change', updatePopulatedState, true);
      document.removeEventListener('blur', updatePopulatedState, true);
      clearInterval(syncInterval);
    };
  }, [dispatch]);

  return <>{children}</>;
};

import { GoogleOAuthProvider } from '@react-oauth/google';

// Injected at build time to guarantee a unique bundle hash per deploy
console.info('Farm Tracker build:', typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev');

import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onRegistered(r) {
    // Check for updates when the app loads and then every hour
    if (r) {
      r.addEventListener('updatefound', () => {
        const newWorker = r.installing;
        if (newWorker) {
           window.dispatchEvent(new Event('pwa-update-downloading'));
        }
      });
      r.update();
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

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
