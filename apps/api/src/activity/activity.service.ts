import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
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
  'today.focus.created': 'Priorité ajoutée au Focus',
  'today.focus.updated': 'Priorité Focus modifiée',
  'today.focus.deleted': 'Priorité retirée du Focus',
  'project.created': 'Projet créé',
  'project.updated': 'Projet modifié',
  'project.archived': 'Projet archivé',
  'project.listed': 'Liste des projets consultée',
  'project.viewed': 'Projet consulté',
  'project.issue.viewed': 'Détail d’une issue consulté',
  'project.issues.viewed': 'Issues du projet consultées',
  'project.pull_requests.viewed': 'Pull requests du projet consultées',
  'project.pull_request.viewed': 'Détail d’une pull request consulté',
  'project.environments.viewed': 'Environnements du projet consultés',
  'project.pipelines.viewed': 'CI / CD du projet consultée',
  'project.milestones.viewed': 'Roadmap du projet consultée',
  'project.milestone.created': 'Jalon créé',
  'project.milestone.updated': 'Jalon modifié',
  'project.milestone.deleted': 'Jalon supprimé',
  'project.decisions.viewed': 'Décisions du projet consultées',
  'project.decision.created': 'Décision créée',
  'project.decision.updated': 'Décision modifiée',
  'project.decision.deleted': 'Décision supprimée',
  'project.documents.viewed': 'Documents du projet consultés',
  'project.document.previewed': 'Document prévisualisé',
  'project.document.created': 'Document ajouté',
  'project.document.updated': 'Document modifié',
  'project.document.deleted': 'Document retiré',
  'project.commercial.viewed': 'Temps et budget consultés',
  'project.finance.updated': 'Paramètres financiers modifiés',
  'project.time.created': 'Saisie de temps ajoutée',
  'project.time.updated': 'Saisie de temps modifiée',
  'project.time.deleted': 'Saisie de temps supprimée',
  'project.local_actions.viewed': 'Actions locales consultées',
  'project.local_action.launched': 'Action locale lancée',
  'project.local_action.stopped': 'Action locale arrêtée',
  'project.health.viewed': 'Santé technique consultée',
  'repository.added': 'Repository ajouté au projet',
  'repository.removed': 'Repository retiré du projet',
  'repository.connection_updated': 'Connexion du repository modifiée',
  'agent.listed': 'Registre des agents consulté',
  'agent.viewed': 'Fiche agent consultée',
  'agent.created': 'Agent créé',
  'agent.updated': 'Agent modifié',
  'agent.archived': 'Agent archivé',
  'agent_team.listed': 'Équipes d’agents consultées',
  'agent_team.viewed': 'Équipe d’agents consultée',
  'agent_team.created': 'Équipe d’agents créée',
  'agent_team.updated': 'Équipe d’agents modifiée',
  'agent_team.hierarchy_updated': 'Hiérarchie de l’équipe modifiée',
  'agent_team.archived': 'Équipe d’agents archivée',
  'data.status_viewed': 'État des données consulté',
  'data.exported': 'Données exportées',
  'data.backups_listed': 'Sauvegardes locales consultées',
  'data.backup_created': 'Sauvegarde locale créée',
  'data.restored': 'Données restaurées depuis un export',
  'data.backup_restored': 'Sauvegarde locale restaurée',
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

  async record(input: ActivityRecordInput): Promise<void> {
    const createdAt = new Date().toISOString();

    try {
      await this.database.connection('activity_logs').insert({
        id: randomUUID(),
        request_id: input.requestId,
        category: input.category,
        action: input.action,
        status: input.status,
        method: input.method,
        route: input.route,
        subject_type: input.subjectType ?? null,
        subject_id: input.subjectId ?? null,
        summary: this.summarize(input),
        request_json: serializeActivityPayload(input.request),
        response_json: serializeActivityPayload(input.response),
        error_json: serializeActivityPayload(input.error),
        http_status: input.httpStatus,
        duration_ms: Math.max(0, Math.round(input.durationMs)),
        created_at: createdAt,
      });

      await this.pruneIfNeeded();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Activity log skipped: ${message}`);
    }
  }

  async list(query: ActivityQuery): Promise<ActivityListResult> {
    const rowsQuery = this.applyFilters(
      this.database
        .connection<ActivityRow>('activity_logs')
        .select(
          'id',
          'request_id',
          'category',
          'action',
          'status',
          'method',
          'route',
          'subject_type',
          'subject_id',
          'summary',
          'http_status',
          'duration_ms',
          'created_at',
        ),
      query,
    );
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      rowsQuery.andWhere((builder) => {
        builder
          .where('created_at', '<', cursor.createdAt)
          .orWhere((sameTimestamp) => {
            sameTimestamp
              .where('created_at', cursor.createdAt)
              .andWhere('id', '<', cursor.id);
          });
      });
    }

    const rows = await rowsQuery
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.limit + 1);

    const items = rows.slice(0, query.limit).map((row) => this.toListItem(row));
    const counts = (await this.applyFilters(
      this.database.connection('activity_logs'),
      query,
    )
      .select(
        this.database.connection.raw('COUNT(*) AS total'),
        this.database.connection.raw(
          "SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success",
        ),
        this.database.connection.raw(
          "SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error",
        ),
      )
      .first()) as {
      total: number | string;
      success: number | string | null;
      error: number | string | null;
    };

    return {
      items,
      nextCursor:
        rows.length > query.limit && items.length
          ? encodeCursor(items[items.length - 1])
          : null,
      total: Number(counts.total),
      counts: {
        success: Number(counts.success ?? 0),
        error: Number(counts.error ?? 0),
      },
    };
  }

  async findOne(activityId: string): Promise<ActivityDetail> {
    const row = await this.database
      .connection<ActivityRow>('activity_logs')
      .select('*')
      .where({ id: activityId })
      .first();

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

  private applyFilters<Query extends Knex.QueryBuilder>(
    builder: Query,
    query: ActivityQuery,
  ): Query {
    if (query.category) {
      builder.where('category', query.category);
    }
    if (query.status) {
      builder.where('status', query.status);
    }
    if (query.from) {
      builder.where('created_at', '>=', query.from);
    }
    if (query.to) {
      builder.where('created_at', '<=', query.to);
    }
    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      builder.whereRaw(
        `(LOWER(summary) LIKE ?
          OR LOWER(action) LIKE ?
          OR LOWER(route) LIKE ?
          OR LOWER(subject_id) LIKE ?)`,
        [search, search, search, search],
      );
    }
    return builder;
  }

  private toListItem(row: ActivityRow): ActivityListItem {
    const summary =
      row.action === 'project.pipelines.viewed'
        ? row.summary.replace(
            /^Pipelines du projet consultés/,
            'CI / CD du projet consultée',
          )
        : row.summary;
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
      summary,
      httpStatus: row.http_status,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    };
  }

  private async pruneIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPrunedAt < 60 * 60 * 1_000) return;
    this.lastPrunedAt = now;

    const cutoff = new Date(
      now - RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    ).toISOString();
    await this.database
      .connection('activity_logs')
      .where('created_at', '<', cutoff)
      .delete();

    const count = (await this.database
      .connection('activity_logs')
      .count({ count: '*' })
      .first()) as { count: number | string };
    const overflow = Number(count.count) - MAX_ROWS;
    if (overflow <= 0) return;

    const oldestIds = this.database
      .connection('activity_logs')
      .select('id')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(overflow);
    await this.database
      .connection('activity_logs')
      .whereIn('id', oldestIds)
      .delete();
  }
}
