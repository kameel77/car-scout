import { describe, it, expect, vi, beforeEach } from 'vitest';
import { employeeAdminService } from '../employee-admin.service.js';

describe('employeeAdminService URL parameter safety', () => {
  const originalFetch = global.fetch;
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, listings: [], assignments: [], matrixSets: [] })
    });
    global.fetch = fetchMock;
  });

  it('CRITICAL REGRESSION TEST: listAvailableListings MUST pass programId in URL query params', async () => {
    const programId = 'prog-12345';
    await employeeAdminService.listAvailableListings(programId, 'BMW', 'test-token');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/api/admin/employee-programs/available-listings?');
    expect(calledUrl).toContain('programId=prog-12345');
    expect(calledUrl).toContain('search=BMW');
  });

  it('CRITICAL REGRESSION TEST: listAvailableRentalAssignments MUST pass programId in URL query params', async () => {
    const programId = 'prog-67890';
    await employeeAdminService.listAvailableRentalAssignments(programId, 'Audi', 'test-token');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain('/api/admin/employee-programs/available-rental-assignments?');
    expect(calledUrl).toContain('programId=prog-67890');
    expect(calledUrl).toContain('search=Audi');
  });

  it('linkProgramMatrixSet calls POST with matrixSetId in body', async () => {
    const programId = 'prog-123';
    const matrixSetId = 'set-456';
    await employeeAdminService.linkProgramMatrixSet(programId, matrixSetId, 'test-token');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledOpts = fetchMock.mock.calls[0][1];
    expect(calledUrl).toContain(`/api/admin/employee-programs/programs/${programId}/matrix-sets`);
    expect(calledOpts.method).toBe('POST');
    expect(JSON.parse(calledOpts.body)).toEqual({ matrixSetId });
  });

  it('unlinkProgramMatrixSet calls DELETE with matrixSetId in URL path', async () => {
    const programId = 'prog-123';
    const matrixSetId = 'set-456';
    await employeeAdminService.unlinkProgramMatrixSet(programId, matrixSetId, 'test-token');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0];
    const calledOpts = fetchMock.mock.calls[0][1];
    expect(calledUrl).toContain(`/api/admin/employee-programs/programs/${programId}/matrix-sets/${matrixSetId}`);
    expect(calledOpts.method).toBe('DELETE');
  });
});
