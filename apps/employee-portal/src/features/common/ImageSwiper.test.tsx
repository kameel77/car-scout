import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ImageSwiper } from './ImageSwiper';

describe('ImageSwiper Component', () => {
  it('renders fallback when no images provided', () => {
    render(<ImageSwiper images={[]} alt="Test Car" />);
    expect(screen.getByText('Brak zdjęcia')).toBeInTheDocument();
  });

  it('renders single image without navigation buttons or counter', () => {
    render(<ImageSwiper images={['https://example.com/car.jpg']} alt="Toyota Corolla" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/car.jpg');
    expect(screen.queryByRole('button', { name: /Poprzednie zdjęcie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Następne zdjęcie/i })).not.toBeInTheDocument();
  });

  it('renders navigation buttons and advances on click when multiple images provided', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'];
    render(<ImageSwiper images={images} alt="Toyota Corolla" />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/1.jpg');

    const nextBtn = screen.getByRole('button', { name: /Następne zdjęcie/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/2.jpg');

    const prevBtn = screen.getByRole('button', { name: /Poprzednie zdjęcie/i });
    fireEvent.click(prevBtn);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/1.jpg');
  });

  it('stops event propagation on navigation buttons to avoid clicking card links', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
    let cardClicked = false;

    render(
      <div onClick={() => { cardClicked = true; }}>
        <ImageSwiper images={images} alt="Toyota Corolla" />
      </div>
    );

    const nextBtn = screen.getByRole('button', { name: /Następne zdjęcie/i });
    fireEvent.click(nextBtn);

    expect(cardClicked).toBe(false);
  });
});
