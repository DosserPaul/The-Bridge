import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AsyncEntry } from '@napi-rs/keyring';

const KEYCHAIN_SERVICE = 'com.claudehub.provider-connections';
const KEYCHAIN_TIMEOUT_MS = 10_000;

@Injectable()
export class KeychainCredentialService {
  async store(account: string, secret: string): Promise<void> {
    this.assertSupported();

    try {
      await this.entry(account).setPassword(
        secret,
        AbortSignal.timeout(KEYCHAIN_TIMEOUT_MS),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Impossible d’enregistrer le token dans le Trousseau macOS.',
      );
    }
  }

  async read(account: string): Promise<string | null> {
    this.assertSupported();

    try {
      return (
        (await this.entry(account).getPassword(
          AbortSignal.timeout(KEYCHAIN_TIMEOUT_MS),
        )) ?? null
      );
    } catch {
      return null;
    }
  }

  async remove(account: string): Promise<void> {
    this.assertSupported();

    try {
      await this.entry(account).deletePassword(
        AbortSignal.timeout(KEYCHAIN_TIMEOUT_MS),
      );
    } catch {
      // Deleting an already-missing credential is idempotent.
    }
  }

  private entry(account: string): AsyncEntry {
    return new AsyncEntry(KEYCHAIN_SERVICE, account);
  }

  private assertSupported(): void {
    if (process.platform !== 'darwin') {
      throw new ServiceUnavailableException(
        'Le stockage sécurisé des connexions nécessite actuellement macOS.',
      );
    }
  }
}
