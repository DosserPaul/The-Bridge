import { randomUUID } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { basename, extname, relative, resolve, sep } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  RepositoryCatalogService,
  type RepositoryRecord,
} from '../repositories/repository-catalog.service';
import type {
  CreateTimeEntryDto,
  UpdateProjectFinanceDto,
  UpdateTimeEntryDto,
} from './dto/project-commercial.dto';
import type {
  CreateProjectDocumentDto,
  UpdateProjectDocumentDto,
} from './dto/project-document.dto';
import type {
  DocumentCategory,
  DocumentKind,
  DocumentPreview,
  ProjectCommercialView,
  ProjectDocument,
  ProjectFinance,
  ProjectTimeEntry,
} from './project-workspace.types';

interface DocumentRow {
  id: string;
  project_id: string;
  repository_id: string | null;
  repository_name: string | null;
  kind: DocumentKind;
  category: DocumentCategory;
  title: string;
  location: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceRow {
  project_id: string;
  daily_rate_cents: number | null;
  budget_cents: number | null;
  currency: string;
  next_invoice_date: string | null;
  updated_at: string;
}

interface TimeEntryRow {
  id: string;
  project_id: string;
  date: string;
  duration_minutes: number;
  description: string;
  billable: boolean | number;
  created_at: string;
  updated_at: string;
}

const markdownExtensions = new Set(['.md', '.mdx', '.txt']);
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

function assertDate(value: string | null | undefined, label: string) {
  if (value == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException(
      `${label} doit utiliser le format AAAA-MM-JJ.`,
    );
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException(`${label} est invalide.`);
}

@Injectable()
export class ProjectWorkspaceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repositories: RepositoryCatalogService,
  ) {}

  async listDocuments(projectId: string): Promise<ProjectDocument[]> {
    await this.requireProject(projectId);
    const rows = (await this.database
      .connection<DocumentRow>('project_documents as documents')
      .leftJoin('repositories', 'repositories.id', 'documents.repository_id')
      .select('documents.*', 'repositories.name as repository_name')
      .where('documents.project_id', projectId)
      .orderBy('documents.created_at', 'desc')) as DocumentRow[];
    const managed = rows.map((row) => this.toDocument(row));
    const records = await this.database
      .connection<RepositoryRecord>('repositories')
      .where({ project_id: projectId })
      .orderBy('created_at', 'asc');
    const discovered = (
      await Promise.all(records.map((record) => this.discoverDocuments(record)))
    ).flat();
    const managedKeys = new Set(
      managed
        .filter(({ kind, repositoryId }) => kind === 'file' && repositoryId)
        .map(({ repositoryId, location }) => `${repositoryId}:${location}`),
    );
    return [
      ...managed,
      ...discovered.filter(
        (document) =>
          !managedKeys.has(`${document.repositoryId}:${document.location}`),
      ),
    ];
  }

  async createDocument(
    projectId: string,
    input: CreateProjectDocumentDto,
  ): Promise<ProjectDocument> {
    await this.requireProject(projectId);
    await this.validateDocumentLocation(
      projectId,
      input.kind,
      input.repositoryId ?? null,
      input.location,
    );
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.connection('project_documents').insert({
      id,
      project_id: projectId,
      repository_id: input.repositoryId ?? null,
      kind: input.kind,
      category: input.category,
      title: input.title,
      location: input.location,
      description: input.description ?? null,
      created_at: now,
      updated_at: now,
    });
    await this.touchProject(projectId, now);
    return this.findDocument(projectId, id);
  }

  async updateDocument(
    projectId: string,
    documentId: string,
    input: UpdateProjectDocumentDto,
  ): Promise<ProjectDocument> {
    const current = await this.findDocumentRow(projectId, documentId);
    const kind = input.kind ?? current.kind;
    const repositoryId =
      input.repositoryId === undefined
        ? current.repository_id
        : input.repositoryId;
    const location = input.location ?? current.location;
    await this.validateDocumentLocation(
      projectId,
      kind,
      repositoryId,
      location,
    );
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (input.repositoryId !== undefined)
      patch.repository_id = input.repositoryId;
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.category !== undefined) patch.category = input.category;
    if (input.title !== undefined) patch.title = input.title;
    if (input.location !== undefined) patch.location = input.location;
    if (input.description !== undefined) patch.description = input.description;
    await this.database
      .connection('project_documents')
      .where({ id: documentId, project_id: projectId })
      .update(patch);
    await this.touchProject(projectId, now);
    return this.findDocument(projectId, documentId);
  }

  async removeDocument(projectId: string, documentId: string): Promise<void> {
    await this.findDocumentRow(projectId, documentId);
    await this.database
      .connection('project_documents')
      .where({ id: documentId, project_id: projectId })
      .delete();
    await this.touchProject(projectId);
  }

  async previewDocument(
    projectId: string,
    repositoryId: string,
    path: string,
  ): Promise<DocumentPreview> {
    const repository = await this.repositories.getRecord(
      projectId,
      repositoryId,
    );
    const filePath = await this.resolveRepositoryFile(
      repository.local_path,
      path,
    );
    const file = await stat(filePath);
    if (!file.isFile())
      throw new BadRequestException(
        'Le document ne correspond pas à un fichier.',
      );
    if (file.size > 2 * 1024 * 1024)
      throw new BadRequestException(
        'Le document dépasse la limite de prévisualisation de 2 Mo.',
      );
    if (!markdownExtensions.has(extname(filePath).toLowerCase()))
      throw new BadRequestException(
        'Seuls les fichiers Markdown et texte peuvent être prévisualisés.',
      );
    const content = await readFile(filePath, 'utf8');
    const limit = 200_000;
    return {
      title: basename(filePath),
      path,
      content: content.slice(0, limit),
      truncated: content.length > limit,
    };
  }

  async getCommercial(projectId: string): Promise<ProjectCommercialView> {
    await this.requireProject(projectId);
    const [finance, entries] = await Promise.all([
      this.database
        .connection<FinanceRow>('project_finances')
        .where({ project_id: projectId })
        .first(),
      this.database
        .connection<TimeEntryRow>('project_time_entries')
        .where({ project_id: projectId })
        .orderBy('date', 'desc')
        .orderBy('created_at', 'desc'),
    ]);
    return this.toCommercial(projectId, finance, entries);
  }

  async updateFinance(
    projectId: string,
    input: UpdateProjectFinanceDto,
  ): Promise<ProjectCommercialView> {
    await this.requireProject(projectId);
    assertDate(input.nextInvoiceDate, 'La prochaine date de facturation');
    const current = await this.database
      .connection<FinanceRow>('project_finances')
      .where({ project_id: projectId })
      .first();
    const now = new Date().toISOString();
    await this.database
      .connection('project_finances')
      .insert({
        project_id: projectId,
        daily_rate_cents:
          input.dailyRateCents === undefined
            ? (current?.daily_rate_cents ?? null)
            : input.dailyRateCents,
        budget_cents:
          input.budgetCents === undefined
            ? (current?.budget_cents ?? null)
            : input.budgetCents,
        currency: (input.currency ?? current?.currency ?? 'EUR').toUpperCase(),
        next_invoice_date:
          input.nextInvoiceDate === undefined
            ? (current?.next_invoice_date ?? null)
            : input.nextInvoiceDate,
        updated_at: now,
      })
      .onConflict('project_id')
      .merge();
    await this.touchProject(projectId, now);
    return this.getCommercial(projectId);
  }

  async createTimeEntry(
    projectId: string,
    input: CreateTimeEntryDto,
  ): Promise<ProjectCommercialView> {
    await this.requireProject(projectId);
    assertDate(input.date, 'La date de saisie');
    const now = new Date().toISOString();
    await this.database.connection('project_time_entries').insert({
      id: randomUUID(),
      project_id: projectId,
      date: input.date,
      duration_minutes: input.durationMinutes,
      description: input.description,
      billable: input.billable ?? true,
      created_at: now,
      updated_at: now,
    });
    await this.touchProject(projectId, now);
    return this.getCommercial(projectId);
  }

  async updateTimeEntry(
    projectId: string,
    entryId: string,
    input: UpdateTimeEntryDto,
  ): Promise<ProjectCommercialView> {
    await this.requireTimeEntry(projectId, entryId);
    assertDate(input.date, 'La date de saisie');
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.date !== undefined) patch.date = input.date;
    if (input.durationMinutes !== undefined)
      patch.duration_minutes = input.durationMinutes;
    if (input.description !== undefined) patch.description = input.description;
    if (input.billable !== undefined) patch.billable = input.billable;
    await this.database
      .connection('project_time_entries')
      .where({ id: entryId, project_id: projectId })
      .update(patch);
    await this.touchProject(projectId, patch.updated_at as string);
    return this.getCommercial(projectId);
  }

  async removeTimeEntry(projectId: string, entryId: string): Promise<void> {
    await this.requireTimeEntry(projectId, entryId);
    await this.database
      .connection('project_time_entries')
      .where({ id: entryId, project_id: projectId })
      .delete();
    await this.touchProject(projectId);
  }

  private async discoverDocuments(
    repository: RepositoryRecord,
  ): Promise<ProjectDocument[]> {
    try {
      const root = await realpath(repository.local_path);
      const paths = await this.walkDocumentation(root, root, 0, []);
      return paths.map((path) => {
        const location = relative(root, path);
        const lower = basename(path).toLowerCase();
        return {
          id: `discovered:${Buffer.from(`${repository.id}:${location}`).toString('base64url')}`,
          projectId: repository.project_id,
          repositoryId: repository.id,
          repositoryName: repository.name,
          kind: 'file' as const,
          category: lower.startsWith('readme')
            ? ('readme' as const)
            : ('technical' as const),
          title: basename(path),
          location,
          description: null,
          source: 'discovered' as const,
          createdAt: null,
          updatedAt: null,
        };
      });
    } catch {
      return [];
    }
  }

  private async walkDocumentation(
    root: string,
    directory: string,
    depth: number,
    found: string[],
  ): Promise<string[]> {
    if (depth > 4 || found.length >= 80) return found;
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (found.length >= 80) break;
      if (entry.isDirectory()) {
        if (
          !ignoredDirectories.has(entry.name) &&
          (depth > 0 ||
            entry.name === 'docs' ||
            entry.name === 'documentation' ||
            entry.name === '.github')
        ) {
          await this.walkDocumentation(
            root,
            resolve(directory, entry.name),
            depth + 1,
            found,
          );
        }
      } else if (
        entry.isFile() &&
        markdownExtensions.has(extname(entry.name).toLowerCase())
      ) {
        if (
          depth > 0 ||
          /^(readme|contributing|security|architecture|changelog)/i.test(
            entry.name,
          )
        )
          found.push(resolve(directory, entry.name));
      }
    }
    return found;
  }

  private async validateDocumentLocation(
    projectId: string,
    kind: DocumentKind,
    repositoryId: string | null,
    location: string,
  ) {
    if (kind === 'link') {
      try {
        const url = new URL(location);
        if (url.protocol !== 'https:') throw new Error();
      } catch {
        throw new BadRequestException(
          'Le lien du document doit être une URL HTTPS valide.',
        );
      }
      return;
    }
    if (!repositoryId)
      throw new BadRequestException(
        'Un document local doit être associé à un repository.',
      );
    const repository = await this.repositories.getRecord(
      projectId,
      repositoryId,
    );
    await this.resolveRepositoryFile(repository.local_path, location);
  }

  private async resolveRepositoryFile(
    rootPath: string,
    inputPath: string,
  ): Promise<string> {
    if (!inputPath || inputPath.startsWith('/') || inputPath.includes('\0'))
      throw new BadRequestException('Le chemin du document est invalide.');
    const root = await realpath(rootPath);
    const candidate = await realpath(resolve(root, inputPath));
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`))
      throw new BadRequestException(
        'Le document doit rester dans le repository.',
      );
    return candidate;
  }

  private async findDocument(
    projectId: string,
    documentId: string,
  ): Promise<ProjectDocument> {
    const row = (await this.database
      .connection<DocumentRow>('project_documents as documents')
      .leftJoin('repositories', 'repositories.id', 'documents.repository_id')
      .select('documents.*', 'repositories.name as repository_name')
      .where({ 'documents.id': documentId, 'documents.project_id': projectId })
      .first()) as DocumentRow | undefined;
    if (!row) throw new NotFoundException('Document introuvable.');
    return this.toDocument(row);
  }

  private async findDocumentRow(projectId: string, documentId: string) {
    const row = await this.database
      .connection<DocumentRow>('project_documents')
      .where({ id: documentId, project_id: projectId })
      .first();
    if (!row) throw new NotFoundException('Document introuvable.');
    return row;
  }

  private toDocument(row: DocumentRow): ProjectDocument {
    return {
      id: row.id,
      projectId: row.project_id,
      repositoryId: row.repository_id,
      repositoryName: row.repository_name,
      kind: row.kind,
      category: row.category,
      title: row.title,
      location: row.location,
      description: row.description,
      source: 'managed',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toCommercial(
    projectId: string,
    row: FinanceRow | undefined,
    rows: TimeEntryRow[],
  ): ProjectCommercialView {
    const entries = rows.map((entry) => this.toTimeEntry(entry));
    const totalMinutes = entries.reduce(
      (sum, entry) => sum + entry.durationMinutes,
      0,
    );
    const billableMinutes = entries
      .filter(({ billable }) => billable)
      .reduce((sum, entry) => sum + entry.durationMinutes, 0);
    const billableValueCents =
      row?.daily_rate_cents == null
        ? null
        : Math.round((billableMinutes / 480) * row.daily_rate_cents);
    const budgetConsumedPercent =
      row?.budget_cents && billableValueCents != null
        ? Math.round((billableValueCents / row.budget_cents) * 10_000) / 100
        : null;
    const remainingBudgetCents =
      row?.budget_cents == null || billableValueCents == null
        ? null
        : row.budget_cents - billableValueCents;
    const finance: ProjectFinance = {
      projectId,
      dailyRateCents: row?.daily_rate_cents ?? null,
      budgetCents: row?.budget_cents ?? null,
      currency: row?.currency ?? 'EUR',
      nextInvoiceDate: row?.next_invoice_date ?? null,
      totalMinutes,
      billableMinutes,
      billableValueCents,
      budgetConsumedPercent,
      remainingBudgetCents,
      updatedAt: row?.updated_at ?? null,
    };
    return { finance, entries };
  }

  private toTimeEntry(row: TimeEntryRow): ProjectTimeEntry {
    return {
      id: row.id,
      projectId: row.project_id,
      date: row.date,
      durationMinutes: row.duration_minutes,
      description: row.description,
      billable: Boolean(row.billable),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async requireTimeEntry(projectId: string, entryId: string) {
    const row = await this.database
      .connection<{ id: string; project_id: string }>('project_time_entries')
      .where({ id: entryId, project_id: projectId })
      .first();
    if (!row) throw new NotFoundException('Saisie de temps introuvable.');
  }

  private async requireProject(projectId: string) {
    const row = await this.database
      .connection<{ id: string }>('projects')
      .where({ id: projectId })
      .first();
    if (!row) throw new NotFoundException('Projet introuvable.');
  }

  private touchProject(
    projectId: string,
    updatedAt = new Date().toISOString(),
  ) {
    return this.database
      .connection('projects')
      .where({ id: projectId })
      .update({ updated_at: updatedAt });
  }
}
