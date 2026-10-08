import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { installGlobalErrorReporting } from './utils/errorReporter'

// Crashes anywhere in the app are logged and emailed to the company address.
installGlobalErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
