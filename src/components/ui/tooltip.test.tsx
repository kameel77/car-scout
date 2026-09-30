import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
