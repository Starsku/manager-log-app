import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// 1. AJOUTE CETTE LIGNE D'IMPORT :
import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. OUVRE LA BALISE ICI : */}
    <HelmetProvider>
      
      <App />
      
    {/* 3. FERME LA BALISE ICI : */}
    </HelmetProvider>
  </React.StrictMode>,
)