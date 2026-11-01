import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MiraProvider } from './lib/store';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <MiraProvider>
      <App />
    </MiraProvider>
  </StrictMode>,
);
