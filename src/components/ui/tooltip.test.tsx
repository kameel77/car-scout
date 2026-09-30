import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => { cleanup(); });
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

describe('Tooltip without an explicit provider', () => {
  it('renders its content when open', () => {
    render(
      <Tooltip open>
        <TooltipTrigger>trigger</TooltipTrigger>
        <TooltipContent>tip text</TooltipContent>
      </Tooltip>,
    );
    expect(screen.getByText('trigger')).toBeTruthy();
    expect(screen.getAllByText('tip text').length).toBeGreaterThan(0);
  });
});

describe('Tooltip delayDuration', () => {
  const hover = (delayDuration?: number) => {
    render(
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger>trigger</TooltipTrigger>
        <TooltipContent>hover tip</TooltipContent>
      </Tooltip>,
    );
    fireEvent.pointerMove(screen.getByText('trigger'), { pointerType: 'mouse' });
  };

  it('opens without delay by default', async () => {
    hover();
    await waitFor(() => expect(screen.queryAllByText('hover tip').length).toBeGreaterThan(0));
  });

  it('respects a non-zero delayDuration prop', async () => {
    hover(300);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryAllByText('hover tip').length).toBe(0);
    await waitFor(() => expect(screen.queryAllByText('hover tip').length).toBeGreaterThan(0), { timeout: 1000 });
  });
});
