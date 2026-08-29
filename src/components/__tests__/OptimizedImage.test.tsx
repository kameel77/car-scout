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
      '/uploads/csflow-images/135/0-thumb.webp 600w, /uploads/csflow-images/135/0-md.webp 1200w, /uploads/csflow-images/135/0.webp 1920w',
    );
    expect(container.querySelector('source[type="image/avif"]')).toBeNull();
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
  });
});
