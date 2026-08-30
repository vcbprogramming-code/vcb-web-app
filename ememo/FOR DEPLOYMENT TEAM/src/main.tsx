import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { StoreProvider } from './store'
import App from './App'

const el = document.getElementById('root')
if (!el) throw new Error('#root not found')
createRoot(el).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)
