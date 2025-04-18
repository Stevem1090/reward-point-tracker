
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add error handling for the entire app
const renderApp = () => {
  try {
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (error) {
    console.error('Failed to render app:', error);
    
    // Create a fallback error UI if the app fails to render
    const errorDiv = document.createElement('div');
    errorDiv.style.padding = '20px';
    errorDiv.style.margin = '20px';
    errorDiv.style.backgroundColor = '#ffebee';
    errorDiv.style.border = '1px solid #ef5350';
    errorDiv.style.borderRadius = '4px';
    errorDiv.style.fontFamily = 'sans-serif';
    
    errorDiv.innerHTML = `
      <h2>App Error</h2>
      <p>Sorry, there was a problem loading the application.</p>
      <button onclick="window.location.reload()" style="padding: 8px 16px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Reload App
      </button>
      <p style="margin-top: 10px; font-size: 14px; color: #666;">
        If the problem persists, try clearing your browser cache or using incognito mode.
      </p>
    `;
    
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = '';
      rootElement.appendChild(errorDiv);
    }
  }
};

renderApp();
