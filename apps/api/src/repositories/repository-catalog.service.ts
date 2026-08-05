import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  GitService,
  type RepositoryInspection,
  type RepositoryProvider,
  type RepositoryState,
} from '../projects/git.service';
import { parseGitRemote } from './git-remote';

export interface RepositoryRecord {
  id: string;
  project_id: string;
  connection_id: string | null;
  name: string;
  local_path: string;
  remote_url: string | null;
  provider: RepositoryProvider;
  created_at: string;
  updated_at: string;
}

interface ConnectionRow {
  id: string;
  provider: 'github' | 'gitlab';
  base_url: string;
}

export interface RepositorySnapshot {
  id: string;
  connectionId: string | null;
  name: string;
  localPath: string;
  remoteUrl: string | null;
  provider: RepositoryProvider;
  state: RepositoryState;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RepositoryCatalogService {
  constructor(
    private readonly database: DatabaseService,
    private readonly git: GitService,
  ) {}

  async listProjectSnapshots(
    projectId: string,
    freshInspection?: RepositoryInspection,
  ): Promise<RepositorySnapshot[]> {
    const records = await this.listProjectRecords(projectId);
    return Promise.all(
      records.map((record) =>
        this.observe(
          record,
          freshInspection?.canonicalPath === record.local_path
            ? freshInspection
            : undefined,
        ),
      ),
    );
  }

  async refreshProjectRecords(projectId: string): Promise<RepositoryRecord[]> {
    const records = await this.listProjectRecords(projectId);
    return Promise.all(records.map((record) => this.refreshRecord(record)));
  }

  async getRecord(
    projectId: string,
    repositoryId: string,
  ): Promise<RepositoryRecord> {
    const record = await this.database
      .connection<RepositoryRecord>('repositories')
      .select('*')
      .where({ id: repositoryId, project_id: projectId })
      .first();
    if (!record) throw new NotFoundException('Repository introuvable.');
    return record;
  }

  async validateConnection(
    connectionId: string | null | undefined,
    inspection: Pick<RepositoryInspection, 'remoteUrl' | 'provider'>,
  ): Promise<{ connectionId: string | null; provider: RepositoryProvider }> {
    if (!connectionId) {
      return { connectionId: null, provider: inspection.provider };
    }

    const connection = await this.database
      .connection<ConnectionRow>('provider_connections')
      .select('id', 'provider', 'base_url')
      .where({ id: connectionId })
      .first();
    if (!connection) {
      throw new NotFoundException('Connexion GitHub ou GitLab introuvable.');
    }

    if (
      inspection.provider !== 'unknown' &&
      inspection.provider !== connection.provider
    ) {
      throw new BadRequestException(
        'La connexion sélectionnée ne correspond pas au provider du remote origin.',
      );
    }

    const remote = parseGitRemote(inspection.remoteUrl);
    if (remote) {
      const connectionHostname = new URL(
        connection.base_url,
      ).hostname.toLowerCase();
      if (remote.hostname !== connectionHostname) {
        throw new BadRequestException(
          'La connexion sélectionnée ne correspond pas à l’hôte du remote origin.',
        );
      }
    }

    return { connectionId, provider: connection.provider };
  }

  async associateConnection(
    projectId: string,
    repositoryId: string,
    connectionId: string | null,
  ): Promise<RepositorySnapshot> {
    const record = await this.getRecord(projectId, repositoryId);
    const inspection = await this.inspect(record.local_path);
    const association = await this.validateConnection(connectionId, {
      remoteUrl: inspection?.remoteUrl ?? record.remote_url,
      provider: inspection?.provider ?? record.provider,
    });
    const updatedAt = new Date().toISOString();
    await this.database
      .connection('repositories')
      .where({ id: repositoryId })
      .update({
        connection_id: association.connectionId,
        provider: association.provider,
        updated_at: updatedAt,
      });
    return this.observe(
      {
        ...record,
        connection_id: association.connectionId,
        provider: association.provider,
        updated_at: updatedAt,
      },
      inspection,
    );
  }

  async observe(
    record: RepositoryRecord,
    freshInspection?: RepositoryInspection,
  ): Promise<RepositorySnapshot> {
    const inspection =
      freshInspection ?? (await this.inspect(record.local_path));
    const updatedRecord = inspection
      ? await this.syncMetadata(record, inspection)
      : record;
    return {
      id: updatedRecord.id,
      connectionId: updatedRecord.connection_id,
      name: updatedRecord.name,
      localPath: updatedRecord.local_path,
      remoteUrl: updatedRecord.remote_url,
      provider: updatedRecord.provider,
      state:
        inspection?.state ??
        (await this.git.observeRepository(record.local_path)),
      createdAt: updatedRecord.created_at,
      updatedAt: updatedRecord.updated_at,
    };
  }

  private listProjectRecords(projectId: string): Promise<RepositoryRecord[]> {
    return this.database
      .connection<RepositoryRecord>('repositories')
      .select('*')
      .where('project_id', projectId)
      .orderBy('created_at', 'asc');
  }

  private async refreshRecord(
    record: RepositoryRecord,
  ): Promise<RepositoryRecord> {
    const inspection = await this.inspect(record.local_path);
    return inspection ? this.syncMetadata(record, inspection) : record;
  }

  private async inspect(
    repositoryPath: string,
  ): Promise<RepositoryInspection | undefined> {
    try {
      return await this.git.inspectRepository(repositoryPath);
    } catch {
      return undefined;
    }
  }

  private async syncMetadata(
    record: RepositoryRecord,
    inspection: RepositoryInspection,
  ): Promise<RepositoryRecord> {
    const provider =
      inspection.provider === 'unknown' && record.connection_id
        ? record.provider
        : inspection.provider;
    if (
      record.name === inspection.name &&
      record.remote_url === inspection.remoteUrl &&
      record.provider === provider
    ) {
      return record;
    }

    const updatedAt = new Date().toISOString();
    await this.database
      .connection('repositories')
      .where({ id: record.id })
      .update({
        name: inspection.name,
        remote_url: inspection.remoteUrl,
        provider,
        updated_at: updatedAt,
      });
    return {
      ...record,
      name: inspection.name,
      remote_url: inspection.remoteUrl,
      provider,
      updated_at: updatedAt,
    };
  }
}
