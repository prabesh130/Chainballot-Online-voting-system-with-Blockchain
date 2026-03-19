/**
 * API Configuration Utility
 * This file provides dynamic API base URL based on environment variables
 */

export const getApiBaseUrl = (): string => {
  const env = import.meta.env.VITE_ENV || "dev";
  
  if (env === "production") {
    return import.meta.env.VITE_REAL_API_BASE_URL || "https://chainballot-backend.vercel.app";
  }
  
  return import.meta.env.VITE_DEV_API_BASE_URL || "http://127.0.0.1:8000";
};

/**
 * Construct full API endpoint URL
 * @param endpoint - The API endpoint path (e.g., "/voter/register/")
 * @returns Full API URL
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};
