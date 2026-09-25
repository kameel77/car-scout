import { useCallback } from 'react';
import { useBrandConfig } from '../../config/BrandContext';
import { trackEvent } from './analytics';

/** Shorthand for trackEvent bound to the current runtime config (apiUrl, analyticsEnabled). */
export function useTrack() {
  const { config } = useBrandConfig();
  return useCallback(
    (eventName: string, metadata?: Record<string, unknown>) =>
      trackEvent(eventName, metadata, config.apiUrl, config.analyticsEnabled),
    [config.apiUrl, config.analyticsEnabled]
  );
}
