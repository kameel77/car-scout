import React from 'react';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ hasDecided: true, loaded: 0, initial: [] as boolean[] }));
vi.mock('@/hooks/useConsent', () => ({ useConsent: () => ({ hasDecided: state.hasDecided }) }));
vi.mock('./ConsentBanner', () => {
  state.loaded += 1;
  return {
    ConsentBanner: ({ initialSettingsOpen }: { initialSettingsOpen?: boolean }) => {
      state.initial.push(Boolean(initialSettingsOpen));
      return <div data-testid="banner">{String(Boolean(initialSettingsOpen))}</div>;
    },
  };
});

import { ConsentGate } from './ConsentGate';
import { openConsentSettings } from '@/lib/consent';

afterEach(() => { cleanup(); });

describe('ConsentGate', () => {
  it('does not load the banner when consent is already stored', () => {
    state.hasDecided = true;
    render(<ConsentGate />);
    expect(screen.queryByTestId('banner')).toBeNull();
    expect(state.loaded).toBe(0);
  });

  it('opens the settings dialog on "open-consent-settings" even when consent is stored', async () => {
    state.hasDecided = true;
    render(<ConsentGate />);
    act(() => { openConsentSettings(); });
    const el = await waitFor(() => screen.getByTestId('banner'));
    expect(el.textContent).toBe('true');
  });

  it('loads the banner for a visitor without consent', async () => {
    state.hasDecided = false;
    render(<ConsentGate />);
    const el = await waitFor(() => screen.getByTestId('banner'));
    expect(el.textContent).toBe('false');
  });
});
