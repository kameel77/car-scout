import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LazyTooltip } from './lazy-tooltip';

afterEach(cleanup);

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver ??= RO;

const setup = () =>
  render(<LazyTooltip trigger={<button data-testid="t">i</button>} content="Hello tip" />);

describe('LazyTooltip', () => {
  it('renders only the trigger before interaction', () => {
    setup();
    expect(screen.getByTestId('t')).toBeTruthy();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.queryByText('Hello tip')).toBeNull();
  });

  it('shows content after pointerenter', async () => {
    setup();
    fireEvent.pointerEnter(screen.getByTestId('t'));
    expect((await screen.findAllByText('Hello tip')).length).toBeGreaterThan(0);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('shows content after focus', async () => {
    setup();
    fireEvent.focus(screen.getByTestId('t'));
    expect((await screen.findAllByText('Hello tip')).length).toBeGreaterThan(0);
  });

  it('shows content after click and prevents default navigation', async () => {
    setup();
    const notPrevented = fireEvent.click(screen.getByTestId('t'));
    expect(notPrevented).toBe(false);
    expect((await screen.findAllByText('Hello tip')).length).toBeGreaterThan(0);
  });
});
