import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferUntilVisible } from './DeferUntilVisible';

describe('DeferUntilVisible', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders placeholder until the observer reports intersection, then children', () => {
    let callback: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    class MockIO {
      constructor(cb: IntersectionObserverCallback) { callback = cb; }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', MockIO);

    render(<DeferUntilVisible placeholderClassName="min-h-[24rem]"><span>content</span></DeferUntilVisible>);
    expect(screen.queryByText('content')).toBeNull();

    act(() => callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.queryByText('content')).toBeNull();

    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('content')).toBeTruthy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('does not start observing before the window load event', () => {
    const observe = vi.fn();
    class MockIO {
      constructor(_cb: IntersectionObserverCallback) {}
      observe = observe;
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', MockIO);
    const rs = vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');

    render(<DeferUntilVisible><span>content</span></DeferUntilVisible>);
    expect(observe).not.toHaveBeenCalled();

    act(() => { window.dispatchEvent(new Event('load')); });
    expect(observe).toHaveBeenCalledTimes(1);
    rs.mockRestore();
  });

  it('renders children immediately without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<DeferUntilVisible><span>content</span></DeferUntilVisible>);
    expect(screen.getByText('content')).toBeTruthy();
  });
});
