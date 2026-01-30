import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './App.css'

const ReactDOM = { createRoot }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
