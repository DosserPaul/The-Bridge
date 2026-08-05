import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { ConnectGitHubDto } from './dto/connect-github.dto';
import type { ConnectGitLabDto } from './dto/connect-gitlab.dto';
import {
  GitHubClientService,
  type GitHubAccount,
} from './github-client.service';
import {
  GitLabClientService,
  normalizeGitLabBaseUrl,
  type GitLabAccount,
} from './gitlab-client.service';
import type {
  GitHubConnectionView,
  GitLabConnectionView,
} from './integrations.types';
import { KeychainCredentialService } from './keychain-credential.service';

export type Provider = 'github' | 'gitlab';

export interface ProviderConnectionRecord {
  id: string;
  provider: Provider;
  baseUrl: string;
  credentialAccount: string;
  accountId: string;
  accountUsername: string;
  accountName: string;
  accountAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GitLabConnectionRecord extends ProviderConnectionRecord {
  provider: 'gitlab';
}

export interface GitHubConnectionRecord extends ProviderConnectionRecord {
  provider: 'github';
}

interface ProviderConnectionRow {
  id: string;
  provider: Provider;
  base_url: string;
  credential_account: string;
  account_id: string;
  account_username: string;
  account_name: string;
  account_avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

type ProviderAccount = GitHubAccount | GitLabAccount;
type ProviderConnectionView = GitHubConnectionView | GitLabConnectionView;

const GITHUB_BASE_URL = 'https://github.com';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly credentials: KeychainCredentialService,
    private readonly gitlab: GitLabClientService,
    private readonly github: GitHubClientService,
  ) {}

  async connectGitLab(input: ConnectGitLabDto): Promise<GitLabConnectionView> {
    const baseUrl = normalizeGitLabBaseUrl(input.baseUrl);
    const account = await this.gitlab.validateConnection(baseUrl, input.token);
    const record = await this.saveConnection(
      'gitlab',
      baseUrl,
      input.token,
      account,
    );
    const view = this.toView(record, true);
    if (view.provider !== 'gitlab') {
      throw new NotFoundException('Connexion GitLab introuvable.');
    }
    return view;
  }

  async connectGitHub(input: ConnectGitHubDto): Promise<GitHubConnectionView> {
    const account = await this.github.validateConnection(input.token);
    const record = await this.saveConnection(
      'github',
      GITHUB_BASE_URL,
      input.token,
      account,
    );
    const view = this.toView(record, true);
    if (view.provider !== 'github') {
      throw new NotFoundException('Connexion GitHub introuvable.');
    }
    return view;
  }

  async listGitLabConnections(): Promise<GitLabConnectionView[]> {
    const views = await this.listConnections('gitlab');
    return views.filter(
      (view): view is GitLabConnectionView => view.provider === 'gitlab',
    );
  }

  async listGitHubConnections(): Promise<GitHubConnectionView[]> {
    const views = await this.listConnections('github');
    return views.filter(
      (view): view is GitHubConnectionView => view.provider === 'github',
    );
  }

  disconnectGitLab(connectionId: string): Promise<void> {
    return this.disconnect('gitlab', connectionId);
  }

  disconnectGitHub(connectionId: string): Promise<void> {
    return this.disconnect('github', connectionId);
  }

  findAllGitLabRecords(): GitLabConnectionRecord[] {
    return this.findAllRecords('gitlab').filter(
      (record): record is GitLabConnectionRecord =>
        record.provider === 'gitlab',
    );
  }

  findAllGitHubRecords(): GitHubConnectionRecord[] {
    return this.findAllRecords('github').filter(
      (record): record is GitHubConnectionRecord =>
        record.provider === 'github',
    );
  }

  readToken(record: ProviderConnectionRecord): Promise<string | null> {
    return this.credentials.read(record.credentialAccount);
  }

  getConnectionRecord(
    provider: Provider,
    connectionId: string,
  ): ProviderConnectionRecord {
    const record = this.findRecordById(provider, connectionId);
    if (!record) {
      throw new NotFoundException(`Connexion ${provider} introuvable.`);
    }
    return record;
  }

  private async saveConnection(
    provider: Provider,
    baseUrl: string,
    token: string,
    account: ProviderAccount,
  ): Promise<ProviderConnectionRecord> {
    const existing = this.findRecordByBaseUrl(provider, baseUrl);
    const connectionId = existing?.id ?? randomUUID();
    const credentialAccount =
      existing?.credentialAccount ?? `${provider}:${connectionId}`;
    const now = new Date().toISOString();

    await this.credentials.store(credentialAccount, token);

    try {
      if (existing) {
        this.database.connection
          .prepare(
            `UPDATE provider_connections
             SET account_id = ?, account_username = ?, account_name = ?,
                 account_avatar_url = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            account.id,
            account.username,
            account.name,
            account.avatarUrl,
            now,
            connectionId,
          );
      } else {
        this.database.connection
          .prepare(
            `INSERT INTO provider_connections (
               id, provider, base_url, credential_account, account_id,
               account_username, account_name, account_avatar_url,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            connectionId,
            provider,
            baseUrl,
            credentialAccount,
            account.id,
            account.username,
            account.name,
            account.avatarUrl,
            now,
            now,
          );
      }
    } catch (error) {
      if (!existing) await this.credentials.remove(credentialAccount);
      throw error;
    }

    const record = this.findRecordById(provider, connectionId);
    if (!record) {
      throw new NotFoundException(`Connexion ${provider} introuvable.`);
    }
    return record;
  }

  private async listConnections(
    provider: Provider,
  ): Promise<ProviderConnectionView[]> {
    const records = this.findAllRecords(provider);
    return Promise.all(
      records.map(async (record) =>
        this.toView(
          record,
          (await this.credentials.read(record.credentialAccount)) !== null,
        ),
      ),
    );
  }

  private async disconnect(
    provider: Provider,
    connectionId: string,
  ): Promise<void> {
    const record = this.findRecordById(provider, connectionId);
    if (!record) {
      throw new NotFoundException(`Connexion ${provider} introuvable.`);
    }

    await this.credentials.remove(record.credentialAccount);
    this.database.connection
      .prepare('DELETE FROM provider_connections WHERE id = ?')
      .run(connectionId);
  }

  private findAllRecords(provider: Provider): ProviderConnectionRecord[] {
    const rows = this.database.connection
      .prepare(
        `SELECT
           id, provider, base_url, credential_account, account_id,
           account_username, account_name, account_avatar_url,
           created_at, updated_at
         FROM provider_connections
         WHERE provider = ?
         ORDER BY created_at ASC`,
      )
      .all(provider) as ProviderConnectionRow[];

    return rows.map((row) => this.toRecord(row));
  }

  private findRecordByBaseUrl(
    provider: Provider,
    baseUrl: string,
  ): ProviderConnectionRecord | undefined {
    const row = this.database.connection
      .prepare(
        `SELECT
           id, provider, base_url, credential_account, account_id,
           account_username, account_name, account_avatar_url,
           created_at, updated_at
         FROM provider_connections
         WHERE provider = ? AND base_url = ?`,
      )
      .get(provider, baseUrl) as ProviderConnectionRow | undefined;

    return row ? this.toRecord(row) : undefined;
  }

  private findRecordById(
    provider: Provider,
    connectionId: string,
  ): ProviderConnectionRecord | undefined {
    const row = this.database.connection
      .prepare(
        `SELECT
           id, provider, base_url, credential_account, account_id,
           account_username, account_name, account_avatar_url,
           created_at, updated_at
         FROM provider_connections
         WHERE provider = ? AND id = ?`,
      )
      .get(provider, connectionId) as ProviderConnectionRow | undefined;

    return row ? this.toRecord(row) : undefined;
  }

  private toRecord(row: ProviderConnectionRow): ProviderConnectionRecord {
    return {
      id: row.id,
      provider: row.provider,
      baseUrl: row.base_url,
      credentialAccount: row.credential_account,
      accountId: row.account_id,
      accountUsername: row.account_username,
      accountName: row.account_name,
      accountAvatarUrl: row.account_avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toView(
    record: ProviderConnectionRecord,
    credentialAvailable: boolean,
  ): ProviderConnectionView {
    const common = {
      id: record.id,
      baseUrl: record.baseUrl,
      account: {
        id: record.accountId,
        username: record.accountUsername,
        name: record.accountName,
        avatarUrl: record.accountAvatarUrl,
      },
      credentialState: credentialAvailable
        ? ('available' as const)
        : ('missing' as const),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    return record.provider === 'github'
      ? { ...common, provider: 'github' }
      : { ...common, provider: 'gitlab' };
  }
}
