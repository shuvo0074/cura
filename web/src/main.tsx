import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './design/theme-provider';
import { ServicesProvider } from './app/services';
import { App } from './app/App';
import { I18nProvider } from './i18n';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ServicesProvider>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ServicesProvider>
    </ThemeProvider>
  </StrictMode>,
);
