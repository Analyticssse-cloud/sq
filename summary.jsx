// globals.js — runs FIRST (imported before any component file in main.jsx).
// The ported files were written for a browser that loaded React/ReactDOM as <script> globals
// and shared components via `window`. We reproduce that here so those files run unmodified.
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

window.React = React;
window.ReactDOM = ReactDOMClient; // app.jsx calls ReactDOM.createRoot(...)
