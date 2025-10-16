import { Capacitor } from '@capacitor/core';

/**
 * Determines the correct API base URL based on the platform
 * - Web/PWA: Uses relative paths (same origin)
 * - Native (Android/iOS): Uses production server URL
 */
export function getApiBaseUrl(): string {
  // Check if running in native Capacitor app
  if (Capacitor.isNativePlatform()) {
    // Use production URL from environment variable
    const productionUrl = import.meta.env.VITE_API_URL;
    
    if (!productionUrl) {
      console.error('VITE_API_URL not set for native platform!');
      // Fallback to empty string will cause requests to fail visibly
      return '';
    }
    
    return productionUrl;
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
