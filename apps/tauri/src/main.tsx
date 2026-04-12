// Tauri entry point — renders the same React app with Tauri-specific API
import React from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import App from '../../src/App.tsx';
import '../../src/index.css';

// Start the file watcher on mount
invoke('watch_project').catch((err) => {
  console.warn('[tauri] Failed to start watcher:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
