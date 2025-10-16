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
        // Use production URL from environment variable
        const productionUrl = import.meta.env.VITE_API_URL;
        
        if (!productionUrl) {
          console.error('VITE_API_URL not set for native platform!');
          // Fallback to empty string will cause requests to fail visibly
          return '';
        }
        
        return productionUrl;
      }
    }
  } catch (e) {
    // Capacitor not available, continue with web mode
    console.debug('Running in web mode');
  }
  
  // Web/PWA: use relative paths (same origin)
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
    return path;
  }
  
  // For native platforms, combine base URL with path
  // Remove trailing slash from baseUrl and leading slash from path if needed
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${normalizedBase}${normalizedPath}`;
}
