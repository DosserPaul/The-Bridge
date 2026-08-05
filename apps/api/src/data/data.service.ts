import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseService } from '../database/database.service';
import {
  backupTables,
  DATA_BACKUP_FORMAT,
  DATA_BACKUP_VERSION,
  type BackupRows,
  type BackupTable,
  type DataBackupDocument,
  type DataStatus,
  type LocalBackup,
  type RestoreResult,
} from './data.types';

const databaseTables: Record<BackupTable, string> = {
  clients: 'clients',
  providerConnections: 'provider_connections',
  projects: 'projects',
  repositories: 'repositories',
  clientContacts: 'client_contacts',
  activityLogs: 'activity_logs',
};

const deletionOrder: BackupTable[] = [
  'activityLogs',
  'clientContacts',
  'repositories',
  'projects',
  'providerConnections',
  'clients',
];

const insertionOrder: BackupTable[] = [
  'clients',
  'providerConnections',
  'projects',
  'repositories',
  'clientContacts',
  'activityLogs',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function backupCounts(rows: BackupRows): Record<BackupTable, number> {
  return Object.fromEntries(
    backupTables.map((table) => [table, rows[table].length]),
  ) as Record<BackupTable, number>;
}

function normalizeRows(table: BackupTable, rows: Record<string, unknown>[]) {
  if (table !== 'clientContacts') return rows;
  return rows.map((row) => ({
    ...row,
    is_primary: Boolean(row.is_primary),
  }));
}

@Injectable()
export class DataService {
  private readonly backupDirectory: string;

  constructor(private readonly database: DatabaseService) {
    this.backupDirectory = join(database.dataDirectory, 'backups');
  }

  async status(): Promise<DataStatus> {
    const document = await this.exportDocument();
    return {
      dialect: this.database.dialect,
      dataDirectory: this.database.dataDirectory,
      counts: backupCounts(document.data),
      credentialNote:
        'Provider tokens remain in the operating-system credential store and are not included.',
    };
  }

  async exportDocument(): Promise<DataBackupDocument> {
    const data = await this.database.connection.transaction((transaction) =>
      this.readRows(transaction),
    );
    return {
      format: DATA_BACKUP_FORMAT,
      version: DATA_BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      source: { dialect: this.database.dialect },
      data,
    };
  }

  async createLocalBackup(): Promise<LocalBackup> {
    const document = await this.exportDocument();
    return this.writeBackup(document);
  }

  async listLocalBackups(): Promise<LocalBackup[]> {
    await mkdir(this.backupDirectory, { recursive: true });
    const entries = await readdir(this.backupDirectory, {
      withFileTypes: true,
    });
    const backups = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          try {
            const id = entry.name.slice(0, -'.json'.length);
            return await this.readBackupMetadata(id);
          } catch {
            return null;
          }
        }),
    );
    return backups
      .filter((backup): backup is LocalBackup => backup !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async restoreDocument(input: unknown): Promise<RestoreResult> {
    const document = this.validateDocument(input);
    return this.restore(document);
  }

  async restoreLocalBackup(backupId: string): Promise<RestoreResult> {
    const document = await this.readBackup(backupId);
    return this.restore(document);
  }

  private async restore(document: DataBackupDocument): Promise<RestoreResult> {
    const safetyBackup = await this.createLocalBackup();
    await this.database.connection.transaction(async (transaction) => {
      for (const table of deletionOrder) {
        await transaction(databaseTables[table]).delete();
      }
      for (const table of insertionOrder) {
        const rows = normalizeRows(table, document.data[table]);
        if (rows.length) await transaction(databaseTables[table]).insert(rows);
      }
    });

    return {
      restoredAt: new Date().toISOString(),
      safetyBackup,
      counts: backupCounts(document.data),
    };
  }

  private async readRows(transaction: Knex.Transaction): Promise<BackupRows> {
    const entries = await Promise.all(
      backupTables.map(async (table) => {
        const rows = (await transaction(databaseTables[table]).select(
          '*',
        )) as Record<string, unknown>[];
        return [table, normalizeRows(table, rows)] as const;
      }),
    );
    return Object.fromEntries(entries) as BackupRows;
  }

  private async writeBackup(
    document: DataBackupDocument,
  ): Promise<LocalBackup> {
    await mkdir(this.backupDirectory, { recursive: true });
    const id = `${document.createdAt.replace(/[:.]/g, '-')}-${randomUUID()}`;
    const destination = join(this.backupDirectory, `${id}.json`);
    const temporary = join(this.backupDirectory, `.${id}.tmp`);
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, destination);
    return this.readBackupMetadata(id);
  }

  private async readBackupMetadata(backupId: string): Promise<LocalBackup> {
    const path = this.backupPath(backupId);
    const [document, file] = await Promise.all([
      this.readBackup(backupId),
      stat(path),
    ]);
    return {
      id: backupId,
      createdAt: document.createdAt,
      sizeBytes: file.size,
      sourceDialect: document.source.dialect,
      counts: backupCounts(document.data),
    };
  }

  private async readBackup(backupId: string): Promise<DataBackupDocument> {
    try {
      const content = await readFile(this.backupPath(backupId), 'utf8');
      return this.validateDocument(JSON.parse(content) as unknown);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new NotFoundException('Sauvegarde locale introuvable.');
    }
  }

  private backupPath(backupId: string): string {
    if (!/^[0-9TZa-f-]+$/i.test(backupId)) {
      throw new BadRequestException('Identifiant de sauvegarde invalide.');
    }
    return join(this.backupDirectory, `${backupId}.json`);
  }

  private validateDocument(input: unknown): DataBackupDocument {
    if (!isRecord(input)) {
      throw new BadRequestException('Le fichier de sauvegarde est invalide.');
    }
    if (
      input.format !== DATA_BACKUP_FORMAT ||
      input.version !== DATA_BACKUP_VERSION ||
      typeof input.createdAt !== 'string' ||
      !isRecord(input.source) ||
      (input.source.dialect !== 'sqlite' &&
        input.source.dialect !== 'postgres') ||
      !isRecord(input.data)
    ) {
      throw new BadRequestException(
        'Le format ou la version de la sauvegarde n’est pas pris en charge.',
      );
    }

    for (const table of backupTables) {
      const rows = input.data[table];
      if (!Array.isArray(rows) || !rows.every(isRecord)) {
        throw new BadRequestException(
          `La table de sauvegarde « ${table} » est invalide.`,
        );
      }
    }
    return input as unknown as DataBackupDocument;
  }
}
