import { describe, it, expect, beforeEach, vi } from 'vitest';
import { offlineCache, resetOfflineDbCacheForTests } from '../services/offlineCache';

const mockIDBFactory = {
  open: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIDBFactory,
});

Object.defineProperty(window, 'crypto', {
  writable: true,
  value: {
    randomUUID: vi.fn(() => 'mock-uuid'),
  },
});

function flushIndexedDbSuccess(request: { onsuccess?: ((ev: Event) => void) | null }) {
  queueMicrotask(() => {
    request.onsuccess?.({} as Event);
  });
}

describe('offlineCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOfflineDbCacheForTests();
  });

  it('should save pending data', async () => {
    const addRequest: { onsuccess?: () => void; onerror?: () => void } = {};
    const mockStore = {
      add: vi.fn(() => {
        flushIndexedDbSuccess(addRequest);
        return addRequest;
      }),
    };
    const mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockStore),
    };
    const mockDB = {
      transaction: vi.fn().mockReturnValue(mockTransaction),
    };
    const openRequest: { onsuccess?: () => void; onerror?: () => void; result: typeof mockDB } = {
      result: mockDB,
    };
    mockIDBFactory.open.mockReturnValue(openRequest);
    flushIndexedDbSuccess(openRequest);

    const data = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      region: 'Región',
      distrito: 'Distrito',
      barrio: 'Barrio',
      nombre: 'Prueba',
      documento: '12345678',
      fecha_nacimiento: '2020-01-01',
      sexo: 'M',
      estado_vacuna: 'no_vacunado' as const,
      latitud: null as number | null,
      longitud: null as number | null,
    };

    await offlineCache.savePending(data as Record<string, unknown>);

    expect(mockIDBFactory.open).toHaveBeenCalledWith('mrv_offline', 1);
    expect(mockStore.add).toHaveBeenCalled();
  });

  it('should get pending data', async () => {
    const getAllRequest: { onsuccess?: () => void; result?: unknown[] } = { result: [] };
    const mockStore = {
      getAll: vi.fn(() => {
        flushIndexedDbSuccess(getAllRequest);
        return getAllRequest;
      }),
    };
    const mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockStore),
    };
    const mockDB = {
      transaction: vi.fn().mockReturnValue(mockTransaction),
    };
    const openRequest: { onsuccess?: () => void; result: typeof mockDB } = {
      result: mockDB,
    };
    mockIDBFactory.open.mockReturnValue(openRequest);
    flushIndexedDbSuccess(openRequest);

    const result = await offlineCache.getPending();
    expect(result).toEqual([]);
  });
});
