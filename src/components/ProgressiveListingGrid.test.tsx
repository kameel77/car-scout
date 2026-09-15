import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressiveListingGrid } from './ProgressiveListingGrid';

let mobile = true;
let resize: () => void;
let intersect: IntersectionObserverCallback;
const disconnect = vi.fn();
const mounted = vi.fn();
function Card({ id }: { id: number }) { mounted(id); return <a href={`/offer/${id}`}>Oferta {id}</a>; }
const cards = (offset = 0) => Array.from({ length: 10 }, (_, i) => <Card key={i + offset} id={i + offset} />);
const near = () => act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
const tick = () => act(() => { vi.advanceTimersByTime(50); });

beforeEach(() => {
  mobile = true;
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return mobile; }, addEventListener: (_: string, cb: () => void) => { resize = cb; }, removeEventListener: vi.fn() }));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { intersect = cb; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('progressive mobile mount budget', () => {
  it('mounts two initially and only two per scheduled batch', () => {
    render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    expect(mounted).toHaveBeenCalledTimes(2);
    near(); near();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    tick();
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });
  it('mounts all on desktop', () => {
    mobile = false;
    render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    expect(screen.getAllByRole('link')).toHaveLength(10);
  });
  it('falls back to all without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    expect(screen.getAllByRole('link')).toHaveLength(10);
  });
  it('offers a native keyboard-accessible button and loads all in bounded batches', () => {
    render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    const button = screen.getByRole('button', { name: /Pokaż wszystkie/ });
    button.focus(); expect(button).toHaveFocus();
    fireEvent.click(button);
    tick(); expect(screen.getAllByRole('link')).toHaveLength(4);
    tick(); tick(); tick();
    expect(screen.getAllByRole('link')).toHaveLength(10);
  });
  it('resets on changed result keys and retains the budget on data rerender', () => {
    const { rerender } = render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    near(); tick();
    rerender(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    rerender(<ProgressiveListingGrid>{cards(20)}</ProgressiveListingGrid>);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
  it('shows all on desktop resize and for printing', () => {
    render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    act(() => { window.dispatchEvent(new Event('beforeprint')); });
    expect(screen.getAllByRole('link')).toHaveLength(10);
    act(() => { window.dispatchEvent(new Event('afterprint')); });
    expect(screen.getAllByRole('link')).toHaveLength(2);
    mobile = false; act(() => resize());
    expect(screen.getAllByRole('link')).toHaveLength(10);
    mobile = true; act(() => resize());
    expect(screen.getAllByRole('link')).toHaveLength(10);
  });
  it('disconnects and cancels queued work on unmount', () => {
    const { unmount } = render(<ProgressiveListingGrid>{cards()}</ProgressiveListingGrid>);
    near(); unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).toHaveBeenCalled();
  });
});
