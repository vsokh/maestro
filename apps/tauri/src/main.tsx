// Tauri entry point — renders the same React app with Tauri-specific API
import React from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import { App } from '../../../src/App.tsx';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary.tsx';
import '../../../src/styles.css';
import '../../../src/components.css';

// Start the file watcher on mount
invoke('watch_project').catch((err) => {
  console.warn('[tauri] Failed to start watcher:', err);
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
