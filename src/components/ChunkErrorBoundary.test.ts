import { describe, expect, it } from 'vitest';
import { claimChunkReload, isChunkLoadError } from './ChunkErrorBoundary';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('ChunkErrorBoundary reload protection', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/page.js',
    'Importing a module script failed',
    'Unable to preload CSS for /assets/page.css',
  ])('recognizes recoverable chunk failure: %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('allows only one automatic reload for the same URL during the cooldown', () => {
    const storage = new MemoryStorage();
    const now = 1_000_000;

    expect(claimChunkReload(storage, '/wynajem-dlugoterminowy/test', now)).toBe(true);
    expect(claimChunkReload(storage, '/wynajem-dlugoterminowy/test', now + 1_000)).toBe(false);
    expect(claimChunkReload(storage, '/wynajem-dlugoterminowy/test', now + 61_000)).toBe(true);
  });
});