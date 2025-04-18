
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add error handling for the entire app with timeout safety
const renderApp = () => {
  try {
    console.log('Starting app rendering...');
    
    // Set a timeout to detect if app is stuck
    const renderTimeout = setTimeout(() => {
      console.error('App rendering timed out');
      
      // Create a fallback error UI if the app appears stuck
      const rootElement = document.getElementById('root');
      if (rootElement) {
        const errorDiv = document.createElement('div');
        errorDiv.style.padding = '20px';
        errorDiv.style.margin = '20px';
        errorDiv.style.backgroundColor = '#ffebee';
        errorDiv.style.border = '1px solid #ef5350';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.fontFamily = 'sans-serif';
        
        errorDiv.innerHTML = `
          <h2>Loading Timeout</h2>
          <p>The application is taking longer than expected to load.</p>
          <button onclick="window.location.reload()" style="padding: 8px 16px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Reload App
          </button>
          <p style="margin-top: 10px; font-size: 14px; color: #666;">
            If the problem persists, try clearing your browser cache or using incognito mode.
          </p>
        `;
        
        // Only insert error UI if the app hasn't rendered anything meaningful yet
        if (rootElement.children.length === 0 || 
            (rootElement.children.length === 1 && rootElement.children[0].tagName === 'DIV' && rootElement.children[0].children.length === 0)) {
          rootElement.innerHTML = '';
          rootElement.appendChild(errorDiv);
        }
      }
    }, 15000); // 15 second timeout
    
    // Render the app
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);
    
    // Clear the timeout once rendering begins
    clearTimeout(renderTimeout);
    
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

// Check for the required script tag
const checkRequiredScripts = () => {
  const gptEngScriptExists = document.querySelector('script[src*="gptengineer.js"]') !== null;
  
  if (!gptEngScriptExists) {
    console.error('Required GPT Engineer script is missing');
    
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const errorDiv = document.createElement('div');
      errorDiv.style.padding = '20px';
      errorDiv.style.margin = '20px';
      errorDiv.style.backgroundColor = '#ffebee';
      errorDiv.style.border = '1px solid #ef5350';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.fontFamily = 'sans-serif';
      
      errorDiv.innerHTML = `
        <h2>Missing Required Script</h2>
        <p>The application cannot load because a required script is missing.</p>
        <button onclick="window.location.reload()" style="padding: 8px 16px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload App
        </button>
      `;
      
      rootElement.innerHTML = '';
      rootElement.appendChild(errorDiv);
      return false;
    }
  }
  
  return true;
}

// Check for required scripts before rendering
if (checkRequiredScripts()) {
  renderApp();
}
