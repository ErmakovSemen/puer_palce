/**
 * Determines the correct API base URL based on the platform
 * - Web/PWA: Uses relative paths (same origin)
 * - Native (Android/iOS): Uses production server URL
 */
export function getApiBaseUrl(): string {
  // Safely check if running in native Capacitor app
  try {
    // Dynamic import to avoid errors in web builds
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      const { Capacitor } = (window as any);
      if (Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
        console.log('[API Config] Running on NATIVE platform (Android/iOS)');
        
        // Use production URL from environment variable
        const productionUrl = import.meta.env.VITE_API_URL;
        
        if (!productionUrl) {
          const errorMsg = 'КРИТИЧЕСКАЯ ОШИБКА: VITE_API_URL не установлен!\n\nПриложение не может подключиться к серверу.\n\nПроверьте что при сборке APK был установлен секрет VITE_API_URL в GitHub Actions.';
          console.error(errorMsg);
          alert(errorMsg);
          return '';
        }
        
        console.log('[API Config] API URL установлен:', productionUrl);
        return productionUrl;
      }
    }
  } catch (e) {
    // Capacitor not available, continue with web mode
    console.log('[API Config] Running in WEB mode (not Capacitor)');
  }
  
  // Web/PWA: use relative paths (same origin)
  console.log('[API Config] Using relative paths (web/PWA mode)');
  return '';
}

/**
 * Constructs a full API URL from a path
 * @param path - API path (e.g., '/api/products')
 * @returns Full URL for the API request
 */
export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // If no base URL (web/PWA), return path as-is
  if (!baseUrl) {
    console.log(`[API] Request: ${path} (relative)`);
    return path;
  }
  
  // For native platforms, combine base URL with path
  // Remove trailing slash from baseUrl and leading slash from path if needed
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  const fullUrl = `${normalizedBase}${normalizedPath}`;
  console.log(`[API] Request: ${fullUrl}`);
  return fullUrl;
}
