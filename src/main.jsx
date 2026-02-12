import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'

// Обработка глобальных ошибок
window.addEventListener('error', (event) => {
  console.error('❌ [GLOBAL ERROR]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [UNHANDLED PROMISE REJECTION]', event.reason);
});

const rootElement = document.getElementById('root')
if (!rootElement) {
  console.error('❌ [FATAL] Элемент #root не найден в DOM!')
  throw new Error('Элемент #root не найден в DOM')
}

const root = createRoot(rootElement)

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error('❌ [FATAL] Ошибка рендеринга приложения:', error)
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: Arial; color: #f44336;">
      <h1>Ошибка загрузки приложения</h1>
      <p>${error.message}</p>
      <p>Проверьте консоль браузера (F12) для подробностей.</p>
    </div>
  `
}
