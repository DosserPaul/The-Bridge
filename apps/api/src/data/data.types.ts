import type { DatabaseDialect } from '../database/database.service';

export const DATA_BACKUP_FORMAT = 'the-bridge-backup';
export const DATA_BACKUP_VERSION = 4;

export const backupTables = [
  'clients',
  'providerConnections',
  'projects',
  'repositories',
  'projectMilestones',
  'projectDecisions',
  'projectDocuments',
  'projectFinances',
  'projectTimeEntries',
  'localActionRuns',
  'todayFocusItems',
  'clientContacts',
  'activityLogs',
] as const;

export type BackupTable = (typeof backupTables)[number];
export type BackupRows = Record<BackupTable, Record<string, unknown>[]>;

export interface DataBackupDocument {
  format: typeof DATA_BACKUP_FORMAT;
  version: typeof DATA_BACKUP_VERSION;
  createdAt: string;
  source: {
    dialect: DatabaseDialect;
  };
  data: BackupRows;
}

export interface LocalBackup {
  id: string;
  createdAt: string;
  sizeBytes: number;
  sourceDialect: DatabaseDialect;
  counts: Record<BackupTable, number>;
}

export interface DataStatus {
  dialect: DatabaseDialect;
  dataDirectory: string;
  counts: Record<BackupTable, number>;
  credentialNote: string;
}

export interface RestoreResult {
  restoredAt: string;
  safetyBackup: LocalBackup;
  counts: Record<BackupTable, number>;
}
