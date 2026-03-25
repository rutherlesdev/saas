import { vi, afterEach } from 'vitest';

afterEach(() => {
  // Clear mock call history without wiping module-level mock implementations.
  // vi.restoreAllMocks() would reset mockResolvedValue/mockReturnValue set in
  // vi.mock() factories, breaking subsequent tests in the same file.
  vi.clearAllMocks();
});

// Silence pino output during tests (overridden by LOG_LEVEL=silent in vitest env)
process.env.LOG_LEVEL = 'silent';
