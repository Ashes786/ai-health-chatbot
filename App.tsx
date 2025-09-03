import React from 'react';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';

// Development placeholders (replace with real values or set via secure config)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // WARNING: Do NOT commit real API keys. Use secure storage for production.
  (global as any).__A0_API_KEY = (global as any).__A0_API_KEY || '';
  (global as any).__ASR_API_URL = (global as any).__ASR_API_URL || '';
  (global as any).__FITWELL_API_BASE = (global as any).__FITWELL_API_BASE || '';
  (global as any).__FITWELL_API_KEY = (global as any).__FITWELL_API_KEY || '';
}

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <HomeScreen />
    </>
  );
}