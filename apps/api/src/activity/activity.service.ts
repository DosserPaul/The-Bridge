import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  ActivityCategory,
  ActivityDetail,
  ActivityListItem,
  ActivityListResult,
  ActivityQuery,
  ActivityRecordInput,
  ActivityStatus,
} from './activity.types';

const MAX_PAYLOAD_CHARACTERS = 64 * 1024;
const MAX_STRING_CHARACTERS = 4_000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_DEPTH = 8;
const RETENTION_DAYS = 90;
const MAX_ROWS = 50_000;

const sensitiveKeyPattern =
  /^(?:authorization|cookie|set-cookie|token|accessToken|refreshToken|password|secret|credential|apiKey|privateKey)$/i;

const actionLabels: Record<string, string> = {
  'client.created': 'Client créé',
  'client.listed': 'Liste des clients consultée',
  'client.viewed': 'Fiche client consultée',
  'client.updated': 'Client modifié',
  'project.created': 'Projet créé',
  'project.listed': 'Liste des projets consultée',
  'project.viewed': 'Projet consulté',
  'project.pipelines.viewed': 'Pipelines du projet consultés',
  'integration.gitlab.listed': 'Connexions GitLab consultées',
  'integration.gitlab.connected': 'Connexion GitLab ajoutée',
  'integration.gitlab.disconnected': 'Connexion GitLab supprimée',
  'integration.github.listed': 'Connexions GitHub consultées',
  'integration.github.connected': 'Connexion GitHub ajoutée',
  'integration.github.disconnected': 'Connexion GitHub supprimée',
  'integration.github.repositories.listed': 'Repositories GitHub consultés',
  'integration.gitlab.repositories.listed': 'Repositories GitLab consultés',
};

interface ActivityRow {
  id: string;
  request_id: string;
  category: ActivityCategory;
  action: string;
  status: ActivityStatus;
  method: string;
  route: string;
  subject_type: string | null;
  subject_id: string | null;
  summary: string;
  request_json?: string | null;
  response_json?: string | null;
  error_json?: string | null;
  http_status: number;
  duration_ms: number;
  created_at: string;
}

interface ActivityCursor {
  createdAt: string;
  id: string;
}

function sanitizeValue(
  value: unknown,
  key: string | null,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (key && sensitiveKeyPattern.test(key)) return '[REDACTED]';
  if (value === null || value === undefined) return value ?? null;

  if (typeof value === 'string') {
    const imageMatch = value.match(
      /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/s,
    );
    if (imageMatch) {
      return {
        type: 'image',
        mimeType: imageMatch[1],
        approximateBytes: Math.floor((imageMatch[2].length * 3) / 4),
        omitted: true,
      };
    }

    if (value.length > MAX_STRING_CHARACTERS) {
      return `${value.slice(0, MAX_STRING_CHARACTERS)}… [truncated ${value.length - MAX_STRING_CHARACTERS} chars]`;
    }

    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol' || typeof value === 'function') {
    return `[${typeof value}]`;
  }

  if (depth >= MAX_DEPTH) return '[MAX_DEPTH_REACHED]';

  if (value instanceof Error) {
    return sanitizeValue(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      key,
      depth + 1,
      seen,
    );
  }

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) {
    return { type: 'buffer', bytes: value.byteLength, omitted: true };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);

    if (Array.isArray(value)) {
      const items = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => sanitizeValue(item, null, depth + 1, seen));
      if (value.length > MAX_ARRAY_ITEMS) {
        items.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
      }
      return items;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized = Object.fromEntries(
      entries
        .slice(0, MAX_OBJECT_KEYS)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeValue(entryValue, entryKey, depth + 1, seen),
        ]),
    );
    if (entries.length > MAX_OBJECT_KEYS) {
      sanitized._truncatedKeys = entries.length - MAX_OBJECT_KEYS;
    }
    return sanitized;
  }

  return '[UNSUPPORTED]';
}

export function serializeActivityPayload(value: unknown): string | null {
  if (value === undefined) return null;

  const sanitized = sanitizeValue(value, null, 0, new WeakSet());
  const serialized = JSON.stringify(sanitized);
  if (serialized.length <= MAX_PAYLOAD_CHARACTERS) return serialized;

  return JSON.stringify({
    truncated: true,
    originalCharacters: serialized.length,
    preview: serialized.slice(0, MAX_PAYLOAD_CHARACTERS - 200),
  });
}

function parsePayload(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { unreadable: true };
  }
}

function encodeCursor(row: ActivityListItem): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt, id: row.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): ActivityCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<ActivityCursor>;
    if (!decoded.createdAt || !decoded.id) throw new Error('Invalid cursor');
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    throw new BadRequestException('Le curseur Activity est invalide.');
  }
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private lastPrunedAt = 0;

  constructor(private readonly database: DatabaseService) {}

  record(input: ActivityRecordInput): void {
    const createdAt = new Date().toISOString();

    try {
      this.database.connection
        .prepare(
          `INSERT INTO activity_logs (
             id, request_id, category, action, status, method, route,
             subject_type, subject_id, summary, request_json, response_json,
             error_json, http_status, duration_ms, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          input.requestId,
          input.category,
          input.action,
          input.status,
          input.method,
          input.route,
          input.subjectType ?? null,
          input.subjectId ?? null,
          this.summarize(input),
          serializeActivityPayload(input.request),
          serializeActivityPayload(input.response),
          serializeActivityPayload(input.error),
          input.httpStatus,
          Math.max(0, Math.round(input.durationMs)),
          createdAt,
        );

      this.pruneIfNeeded();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Activity log skipped: ${message}`);
    }
  }

  list(query: ActivityQuery): ActivityListResult {
    const filters = this.buildFilters(query);
    const cursorFilters = [...filters.clauses];
    const cursorParameters = [...filters.parameters];

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      cursorFilters.push('(created_at < ? OR (created_at = ? AND id < ?))');
      cursorParameters.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }

    const where = cursorFilters.length
      ? `WHERE ${cursorFilters.join(' AND ')}`
      : '';
    const rows = this.database.connection
      .prepare(
        `SELECT
           id, request_id, category, action, status, method, route,
           subject_type, subject_id, summary, http_status, duration_ms,
           created_at
         FROM activity_logs
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(...cursorParameters, query.limit + 1) as ActivityRow[];

    const items = rows.slice(0, query.limit).map((row) => this.toListItem(row));
    const baseWhere = filters.clauses.length
      ? `WHERE ${filters.clauses.join(' AND ')}`
      : '';
    const counts = this.database.connection
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
           SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error
         FROM activity_logs
         ${baseWhere}`,
      )
      .get(...filters.parameters) as {
      total: number;
      success: number | null;
      error: number | null;
    };

    return {
      items,
      nextCursor:
        rows.length > query.limit && items.length
          ? encodeCursor(items[items.length - 1])
          : null,
      total: counts.total,
      counts: {
        success: counts.success ?? 0,
        error: counts.error ?? 0,
      },
    };
  }

  findOne(activityId: string): ActivityDetail {
    const row = this.database.connection
      .prepare(
        `SELECT
           id, request_id, category, action, status, method, route,
           subject_type, subject_id, summary, request_json, response_json,
           error_json, http_status, duration_ms, created_at
         FROM activity_logs
         WHERE id = ?`,
      )
      .get(activityId) as ActivityRow | undefined;

    if (!row) throw new NotFoundException('Événement Activity introuvable.');

    return {
      ...this.toListItem(row),
      request: parsePayload(row.request_json),
      response: parsePayload(row.response_json),
      error: parsePayload(row.error_json),
    };
  }

  private summarize(input: ActivityRecordInput): string {
    const label = actionLabels[input.action] ?? input.action;
    const subject = input.subjectLabel?.trim();
    const suffix = subject
      ? ` · ${subject}`
      : input.subjectId
        ? ` · ${input.subjectId}`
        : '';
    return `${label}${suffix}`;
  }

  private buildFilters(query: ActivityQuery): {
    clauses: string[];
    parameters: Array<string>;
  } {
    const clauses: string[] = [];
    const parameters: string[] = [];

    if (query.category) {
      clauses.push('category = ?');
      parameters.push(query.category);
    }
    if (query.status) {
      clauses.push('status = ?');
      parameters.push(query.status);
    }
    if (query.from) {
      clauses.push('created_at >= ?');
      parameters.push(query.from);
    }
    if (query.to) {
      clauses.push('created_at <= ?');
      parameters.push(query.to);
    }
    if (query.search) {
      clauses.push(
        `(summary LIKE ? COLLATE NOCASE
          OR action LIKE ? COLLATE NOCASE
          OR route LIKE ? COLLATE NOCASE
          OR subject_id LIKE ? COLLATE NOCASE)`,
      );
      const search = `%${query.search}%`;
      parameters.push(search, search, search, search);
    }

    return { clauses, parameters };
  }

  private toListItem(row: ActivityRow): ActivityListItem {
    return {
      id: row.id,
      requestId: row.request_id,
      category: row.category,
      action: row.action,
      status: row.status,
      method: row.method,
      route: row.route,
      subject: row.subject_type
        ? { type: row.subject_type, id: row.subject_id }
        : null,
      summary: row.summary,
      httpStatus: row.http_status,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    };
  }

  private pruneIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastPrunedAt < 60 * 60 * 1_000) return;
    this.lastPrunedAt = now;

    const cutoff = new Date(
      now - RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    ).toISOString();
    this.database.connection
      .prepare('DELETE FROM activity_logs WHERE created_at < ?')
      .run(cutoff);

    const count = this.database.connection
      .prepare('SELECT COUNT(*) AS count FROM activity_logs')
      .get() as { count: number };
    const overflow = count.count - MAX_ROWS;
    if (overflow <= 0) return;

    this.database.connection
      .prepare(
        `DELETE FROM activity_logs
         WHERE id IN (
           SELECT id FROM activity_logs
           ORDER BY created_at ASC, id ASC
           LIMIT ?
         )`,
      )
      .run(overflow);
  }
}
