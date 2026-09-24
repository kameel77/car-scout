import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RateRangeFilter } from './RateRangeFilter';

describe('RateRangeFilter Component', () => {
  it('renders inputs and presets', () => {
    const onChange = vi.fn();
    render(<RateRangeFilter minRate="" maxRate="" onChange={onChange} />);

    expect(screen.getByText('Rata miesięczna (zł brutto)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('od')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '< 1500' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1500 - 2500' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2500 - 3500' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3500+' })).toBeInTheDocument();
  });

  it('calls onChange when clicking a preset', () => {
    const onChange = vi.fn();
    render(<RateRangeFilter minRate="" maxRate="" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '1500 - 2500' }));
    expect(onChange).toHaveBeenCalledWith(1500, 2500);
  });

  it('clears filter when clicking already active preset', () => {
    const onChange = vi.fn();
    render(<RateRangeFilter minRate={1500} maxRate={2500} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '1500 - 2500' }));
    expect(onChange).toHaveBeenCalledWith('', '');
  });

  it('calls onChange when typing in min and max inputs', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RateRangeFilter minRate="" maxRate="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('od'), { target: { value: '1200' } });
    expect(onChange).toHaveBeenCalledWith(1200, '');

    rerender(<RateRangeFilter minRate={1200} maxRate="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('do'), { target: { value: '3000' } });
    expect(onChange).toHaveBeenCalledWith(1200, 3000);
  });

  it('calls onBlur when inputs lose focus', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<RateRangeFilter minRate="" maxRate="" onChange={onChange} onBlur={onBlur} />);

    fireEvent.blur(screen.getByPlaceholderText('od'));
    expect(onBlur).toHaveBeenCalledTimes(1);

    fireEvent.blur(screen.getByPlaceholderText('do'));
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
});
