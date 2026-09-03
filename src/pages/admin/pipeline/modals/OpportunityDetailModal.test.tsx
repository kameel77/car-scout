import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpportunityDetailModal } from './OpportunityDetailModal';

vi.mock('../api/usePipeline', () => ({
  useOpportunityDetails: () => ({
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('Sprawa nie została znaleziona'),
    refetch: vi.fn(),
  }),
  usePipelineMutations: () => ({ patchOpportunity: { mutateAsync: vi.fn() } }),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('OpportunityDetailModal', () => {
  it('shows an error instead of an endless loader when a deep-linked opportunity is unavailable', () => {
    render(
      <OpportunityDetailModal
        opportunityId="missing-opportunity"
        users={[]}
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Nie udało się otworzyć sprawy')).toBeInTheDocument();
    expect(screen.getByText('Sprawa nie została znaleziona')).toBeInTheDocument();
  });
});