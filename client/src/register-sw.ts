export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const existingReg = await navigator.serviceWorker.getRegistration();
        if (existingReg) {
          await existingReg.unregister();
          console.log('Old Service Worker unregistered');
        }
        
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          updateViaCache: 'none'
        });
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
        
        console.log('Service Worker registered successfully:', registration.scope);
      } catch (error) {
        console.log('Service Worker registration failed:', error);
      }
    });
  }
}
