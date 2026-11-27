import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '../styles/site.css';
import App from './App';
import { I18nProvider } from './i18n';
import { SiteThemeProvider } from './theme';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SiteThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </SiteThemeProvider>
  </React.StrictMode>,
);
