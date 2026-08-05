const mockSetPassword = jest.fn();
const mockGetPassword = jest.fn();
const mockDeletePassword = jest.fn();
const mockAsyncEntry = jest.fn(() => ({
  setPassword: mockSetPassword,
  getPassword: mockGetPassword,
  deletePassword: mockDeletePassword,
}));
const mockSpawn = jest.fn(() => ({
  once: jest.fn(),
  stdin: { end: jest.fn() },
}));

jest.mock('@napi-rs/keyring', () => ({ AsyncEntry: mockAsyncEntry }));
jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
  spawn: mockSpawn,
}));

import { KeychainCredentialService } from './keychain-credential.service';

describe('KeychainCredentialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetPassword.mockResolvedValue(undefined);
    mockGetPassword.mockResolvedValue('glpat-secret');
    mockDeletePassword.mockResolvedValue(true);
  });

  it('stores a credential without waiting for an interactive security prompt', async () => {
    const credentials = new KeychainCredentialService();
    const outcome = await Promise.race([
      credentials.store('gitlab:test', 'glpat-secret').then(() => 'stored'),
      new Promise<'timed-out'>((resolve) =>
        setTimeout(() => resolve('timed-out'), 50),
      ),
    ]);

    expect(outcome).toBe('stored');
    expect(mockSetPassword).toHaveBeenCalledWith(
      'glpat-secret',
      expect.any(AbortSignal),
    );
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('reads and removes a credential through the native keyring', async () => {
    const credentials = new KeychainCredentialService();

    await expect(credentials.read('gitlab:test')).resolves.toBe('glpat-secret');
    await expect(credentials.remove('gitlab:test')).resolves.toBeUndefined();

    expect(mockGetPassword).toHaveBeenCalledTimes(1);
    expect(mockDeletePassword).toHaveBeenCalledTimes(1);
  });
});
