import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownText } from '../MarkdownText';

describe('MarkdownText', () => {
  it('renders **bold** as a <strong> element', () => {
    const { container } = render(<MarkdownText text="Hello **world**" />);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('world');
  });

  it('renders an <img onerror> payload embedded in the text as literal text, not an element', () => {
    const payload = '<img src=x onerror=1>';
    const { container } = render(<MarkdownText text={payload} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it('does not produce an <a href^="javascript"> for a javascript: link target', () => {
    const { container } = render(<MarkdownText text="[x](javascript:alert(1))" />);
    const anchor = container.querySelector('a');
    expect(anchor).toBeNull();
    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('produces a link for a relative URL', () => {
    const { container } = render(<MarkdownText text="[x](/foo)" />);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/foo');
  });

  it('produces a link for an https URL', () => {
    const { container } = render(<MarkdownText text="[x](https://a.b)" />);
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('https://a.b');
  });
});
