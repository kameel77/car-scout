import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useTrackedUrl } from '../useTrackedUrl';

const wrapper = (initial: string) =>
  ({ children }: { children: React.ReactNode }) =>
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;

describe('useTrackedUrl', () => {
  it('returns clean URL when not in print mode', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw-x5'), {
      wrapper: wrapper('/dla-firm'),
    });
    expect(result.current).toBe('/oferta/bmw-x5');
  });

  it('appends UTM params when print=1', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw-x5'), {
      wrapper: wrapper('/dla-firm?print=1'),
    });
    expect(result.current).toContain('utm_source=partner_mailing');
    expect(result.current).toContain('utm_medium=pdf');
    expect(result.current).toContain('utm_campaign=link4');
  });

  it('preserves existing query params', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw?ref=abc'), {
      wrapper: wrapper('/dla-firm?print=1'),
    });
    expect(result.current).toContain('ref=abc');
    expect(result.current).toContain('utm_source=partner_mailing');
  });
});
