import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { ProgressProvider } from './hooks/ProgressContext.jsx';
import './index.css';

const theme = localStorage.getItem('hl-theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ProgressProvider>
          <App />
        </ProgressProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
