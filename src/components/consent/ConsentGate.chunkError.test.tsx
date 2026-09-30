import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useConsent', () => ({ useConsent: () => ({ hasDecided: false }) }));
vi.mock('./ConsentBanner', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

import { ConsentGate } from './ConsentGate';

class Catcher extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div data-testid="crashed" /> : this.props.children; }
}

afterEach(() => { cleanup(); });

describe('ConsentGate chunk failure', () => {
  it('renders nothing and does not throw when the banner chunk fails to load', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, queryByTestId } = render(<Catcher><ConsentGate /></Catcher>);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(queryByTestId('crashed')).toBeNull();
    expect(container.innerHTML).toBe('');
    spy.mockRestore();
  });
});
