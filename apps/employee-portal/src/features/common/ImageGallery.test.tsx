import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ImageGallery } from './ImageGallery';

describe('ImageGallery Component', () => {
  it('renders fallback when images array is empty', () => {
    render(<ImageGallery images={[]} title="Toyota Corolla" />);
    expect(screen.getByText('Brak zdjęć dla tego pojazdu')).toBeInTheDocument();
  });

  it('renders main image and thumbnail list', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
    render(<ImageGallery images={images} title="Toyota Corolla" />);

    const mainImg = screen.getByAltText('Toyota Corolla - zdjęcie 1');
    expect(mainImg).toHaveAttribute('src', 'https://example.com/1.jpg');

    // Click on second thumbnail
    const thumb2 = screen.getByRole('button', { name: /Miniatura 2/i });
    fireEvent.click(thumb2);

    expect(screen.getByAltText('Toyota Corolla - zdjęcie 2')).toHaveAttribute('src', 'https://example.com/2.jpg');
  });

  it('opens full-screen lightbox when clicking main image and closes on Escape or close button', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
    render(<ImageGallery images={images} title="Toyota Corolla" />);

    // Click main image to open lightbox
    const mainImg = screen.getByAltText('Toyota Corolla - zdjęcie 1');
    fireEvent.click(mainImg);

    // Lightbox modal should be open
    expect(screen.getByRole('dialog', { name: /Galeria zdjęć/i })).toBeInTheDocument();

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: /Zamknij podgląd/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Galeria zdjęć/i })).not.toBeInTheDocument();
  });

  it('navigates lightbox using next and previous buttons', () => {
    const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];
    render(<ImageGallery images={images} title="Toyota Corolla" />);

    // Open lightbox
    const mainImg = screen.getByAltText('Toyota Corolla - zdjęcie 1');
    fireEvent.click(mainImg);

    const nextBtn = screen.getByRole('button', { name: /Następne zdjęcie w galerii/i });
    fireEvent.click(nextBtn);

    expect(screen.getAllByText('2 / 2').length).toBeGreaterThanOrEqual(1);

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Galeria zdjęć/i })).not.toBeInTheDocument();
  });
});
