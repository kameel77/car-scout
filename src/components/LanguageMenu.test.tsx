import React from 'react';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LanguageMenu from './LanguageMenu';

const languages = [
  { code: 'pl', label: 'Polski', flag: 'PL' },
  { code: 'en', label: 'English', flag: 'EN' },
];

afterEach(() => { cleanup(); });

describe('LanguageMenu', () => {
  it('moves focus to the first menu item when it opens', async () => {
    render(
      <LanguageMenu languages={languages} current={languages[0]} currentCode="pl" onLanguageChange={vi.fn()} />,
    );
    const items = await waitFor(() => screen.getAllByRole('menuitem'));
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
  });

  it('returns focus to the trigger on Escape', async () => {
    render(
      <LanguageMenu languages={languages} current={languages[0]} currentCode="pl" onLanguageChange={vi.fn()} />,
    );
    const items = await waitFor(() => screen.getAllByRole('menuitem'));
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    const trigger = screen.getByRole('button');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
