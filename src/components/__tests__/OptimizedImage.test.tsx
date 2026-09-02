import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OptimizedImage } from '../OptimizedImage';

describe('OptimizedImage', () => {
  it('uses existing responsive WebP variants without advertising AVIF', () => {
    const { container } = render(
      <OptimizedImage
        src="/uploads/csflow-images/135/0.webp"
        alt="Citroen C3"
        priority
        sizes="100vw"
      />,
    );

    const source = container.querySelector('source');
    const image = container.querySelector('img');

    expect(source).toHaveAttribute('type', 'image/webp');
    expect(source).toHaveAttribute(
      'srcset',
      '/uploads/csflow-images/135/0-thumb.webp 600w, /uploads/csflow-images/135/0-md.webp 900w, /uploads/csflow-images/135/0-lg.webp 1400w, /uploads/csflow-images/135/0.webp 1920w',
    );
    expect(container.querySelector('source[type="image/avif"]')).toBeNull();
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });

  it('card ladder stops at 1400w and never offers the master', () => {
    // Karta ma sizes=100vw; przy DPR >= 2,4 potrzeba ~1081 px. Dopóki w srcset
    // był kandydat 1920w, telefon przeskakiwał ponad wariant 900w prosto na
    // mastera (~128 KB zamiast ~77 KB) — patrz OptimizedImage.ladder.
    const { container } = render(
      <OptimizedImage
        src="/uploads/csflow-images/135/0.webp"
        alt="Citroen C3"
        ladder="card"
        sizes="100vw"
      />,
    );

    expect(container.querySelector('source')).toHaveAttribute(
      'srcset',
      '/uploads/csflow-images/135/0-thumb.webp 600w, /uploads/csflow-images/135/0-md.webp 900w, /uploads/csflow-images/135/0-lg.webp 1400w',
    );
    expect(container.querySelector('source')!.getAttribute('srcset')).not.toContain('1920w');
  });
});
