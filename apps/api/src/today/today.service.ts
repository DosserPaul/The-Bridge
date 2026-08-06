import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { ProjectIssuesService } from '../integrations/project-issues.service';
import { ProjectOperationsService } from '../integrations/project-operations.service';
import { ProjectPipelinesService } from '../integrations/project-pipelines.service';
import type {
  ProjectIssuesView,
  ProjectPipelinesView,
  ProjectPullRequestsView,
} from '../integrations/integrations.types';
import { ProjectsService } from '../projects/projects.service';
import type { ProjectView } from '../projects/projects.types';
import type { CreateFocusItemDto } from './dto/create-focus-item.dto';
import type { UpdateFocusItemDto } from './dto/update-focus-item.dto';
import type {
  TodayDegradedSource,
  TodayFocusItem,
  TodayFocusPriority,
  TodayProjectSummary,
  TodaySignal,
  TodaySignalSeverity,
  TodayView,
} from './today.types';

const MAX_ACTIVE_FOCUS_ITEMS = 3;
const MAX_SIGNALS = 40;

interface FocusRow {
  id: string;
  source_key: string | null;
  project_id: string | null;
  project_name: string | null;
  project_logo_data_url: string | null;
  title: string;
  description: string | null;
  href: string | null;
  priority: TodayFocusPriority;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RemoteResult {
  signals: TodaySignal[];
  degradedSources: TodayDegradedSource[];
}

function projectSummary(project: ProjectView): TodayProjectSummary {
  return {
    id: project.id,
    name: project.name,
    logoDataUrl: project.logoDataUrl,
  };
}

function calendarDay(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`);
}

function daysFromToday(date: string, now: Date): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((calendarDay(date) - today) / 86_400_000);
}

function severityRank(severity: TodaySignalSeverity): number {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function sortSignals(left: TodaySignal, right: TodaySignal): number {
  const severity = severityRank(left.severity) - severityRank(right.severity);
  if (severity) return severity;
  if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
  if (left.dueAt) return -1;
  if (right.dueAt) return 1;
  return left.project.name.localeCompare(right.project.name);
}

@Injectable()
export class TodayService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projects: ProjectsService,
    private readonly pipelines: ProjectPipelinesService,
    private readonly operations: ProjectOperationsService,
    private readonly issues: ProjectIssuesService,
    private readonly activity: ActivityService,
  ) {}

  async get(now = new Date()): Promise<TodayView> {
    const projects = (await this.projects.findAll()).filter(
      (project) => project.status !== 'archived',
    );
    const operationalProjects = projects.filter(
      (project) =>
        project.status === 'active' ||
        project.status === 'planned' ||
        project.status === 'paused',
    );
    const localSignals = operationalProjects.flatMap((project) =>
      this.localSignals(project, now),
    );
    const remoteResults = await Promise.all(
      operationalProjects.map((project) => this.remoteSignals(project)),
    );
    const signals = [
      ...localSignals,
      ...remoteResults.flatMap((result) => result.signals),
    ]
      .sort(sortSignals)
      .slice(0, MAX_SIGNALS);
    const [focus, recentActivity] = await Promise.all([
      this.listFocus(),
      this.activity.list({ limit: 7 }),
    ]);

    return {
      generatedAt: now.toISOString(),
      summary: {
        activeProjects: projects.filter(
          (project) => project.status === 'active',
        ).length,
        signals: signals.length,
        critical: signals.filter((signal) => signal.severity === 'critical')
          .length,
        dueSoon: signals.filter(
          (signal) => signal.kind === 'deadline' || signal.kind === 'follow_up',
        ).length,
        runningPipelines: signals.filter(
          (signal) => signal.kind === 'pipeline' && signal.severity === 'info',
        ).length,
      },
      signals,
      focus,
      recentActivity: recentActivity.items,
      degradedSources: remoteResults.flatMap(
        (result) => result.degradedSources,
      ),
    };
  }

  async addFocus(input: CreateFocusItemDto): Promise<TodayFocusItem> {
    this.assertHref(input.href);
    if (input.projectId) await this.assertProject(input.projectId);

    if (input.sourceKey) {
      const existing = await this.database
        .connection<FocusRow>('today_focus_items')
        .select('*')
        .where({ source_key: input.sourceKey })
        .first();
      if (existing) {
        if (!existing.completed_at) return this.findFocus(existing.id);
        await this.assertFocusCapacity();
        const now = new Date().toISOString();
        await this.database
          .connection('today_focus_items')
          .where({ id: existing.id })
          .update({
            project_id: input.projectId ?? existing.project_id,
            title: input.title,
            description: input.description ?? null,
            href: input.href ?? null,
            priority: input.priority ?? existing.priority,
            completed_at: null,
            updated_at: now,
          });
        return this.findFocus(existing.id);
      }
    }

    await this.assertFocusCapacity();
    const now = new Date().toISOString();
    const id = randomUUID();
    await this.database.connection('today_focus_items').insert({
      id,
      source_key: input.sourceKey ?? null,
      project_id: input.projectId ?? null,
      title: input.title,
      description: input.description ?? null,
      href: input.href ?? null,
      priority: input.priority ?? 'normal',
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
    return this.findFocus(id);
  }

  async updateFocus(
    focusId: string,
    input: UpdateFocusItemDto,
  ): Promise<TodayFocusItem> {
    const current = await this.findFocus(focusId);
    if (input.completed === false && current.completedAt) {
      await this.assertFocusCapacity();
    }
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined)
      patch.description = input.description || null;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.completed !== undefined) {
      patch.completed_at = input.completed ? new Date().toISOString() : null;
    }
    await this.database
      .connection('today_focus_items')
      .where({ id: focusId })
      .update(patch);
    return this.findFocus(focusId);
  }

  async removeFocus(focusId: string): Promise<void> {
    const deleted = await this.database
      .connection('today_focus_items')
      .where({ id: focusId })
      .delete();
    if (!deleted) throw new NotFoundException('Priorité Focus introuvable.');
  }

  private localSignals(project: ProjectView, now: Date): TodaySignal[] {
    const projectRef = projectSummary(project);
    const signals: TodaySignal[] = [];
    if (project.deadline) {
      const days = daysFromToday(project.deadline, now);
      if (days <= 14) {
        signals.push({
          id: `deadline:${project.id}`,
          kind: 'deadline',
          severity: days < 0 ? 'critical' : days <= 3 ? 'warning' : 'info',
          title: days < 0 ? 'Deadline dépassée' : 'Deadline à venir',
          description:
            days < 0
              ? `${project.name} a dépassé sa deadline de ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}.`
              : days === 0
                ? `${project.name} arrive à échéance aujourd’hui.`
                : `${project.name} arrive à échéance dans ${days} jour${days > 1 ? 's' : ''}.`,
          project: projectRef,
          repository: null,
          href: `/projects/${project.id}`,
          dueAt: project.deadline,
        });
      }
    }
    if (project.followUp) {
      const days = daysFromToday(project.followUp.date, now);
      if (days <= 7) {
        signals.push({
          id: `follow-up:${project.id}:${project.followUp.date}`,
          kind: 'follow_up',
          severity: days < 0 ? 'critical' : days <= 1 ? 'warning' : 'info',
          title: days < 0 ? 'Follow-up en retard' : 'Follow-up à préparer',
          description:
            project.followUp.note ??
            (days <= 0
              ? `Le follow-up de ${project.name} doit être traité.`
              : `Follow-up prévu dans ${days} jour${days > 1 ? 's' : ''}.`),
          project: projectRef,
          repository: null,
          href: `/projects/${project.id}`,
          dueAt: project.followUp.date,
        });
      }
    }
    if (project.priority === 'critical' || project.priority === 'high') {
      signals.push({
        id: `priority:${project.id}`,
        kind: 'priority',
        severity: project.priority === 'critical' ? 'critical' : 'warning',
        title:
          project.priority === 'critical'
            ? 'Projet critique'
            : 'Priorité élevée',
        description: `${project.name} est marqué comme une priorité ${project.priority === 'critical' ? 'critique' : 'élevée'}.`,
        project: projectRef,
        repository: null,
        href: `/projects/${project.id}`,
        dueAt: null,
      });
    }
    for (const repository of project.repositories) {
      if (repository.state.availability === 'unavailable') {
        signals.push({
          id: `repository-unavailable:${repository.id}`,
          kind: 'repository',
          severity: 'critical',
          title: 'Repository local indisponible',
          description:
            repository.state.error ??
            `${repository.name} n’est plus accessible à son chemin local.`,
          project: projectRef,
          repository: { id: repository.id, name: repository.name },
          href: `/projects/${project.id}?tab=repositories`,
          dueAt: null,
        });
      } else if (repository.state.isDirty) {
        signals.push({
          id: `repository-dirty:${repository.id}`,
          kind: 'repository',
          severity: 'warning',
          title: 'Modifications locales non commitées',
          description: `${repository.state.changedFilesCount} fichier${repository.state.changedFilesCount > 1 ? 's' : ''} modifié${repository.state.changedFilesCount > 1 ? 's' : ''} dans ${repository.name}.`,
          project: projectRef,
          repository: { id: repository.id, name: repository.name },
          href: `/projects/${project.id}?tab=repositories`,
          dueAt: null,
        });
      }
    }
    return signals;
  }

  private async remoteSignals(project: ProjectView): Promise<RemoteResult> {
    const [pipelines, pullRequests, issues] = await Promise.allSettled([
      this.pipelines.findForProject(project.id),
      this.operations.findPullRequests(project.id),
      this.issues.findForProject(project.id),
    ]);
    const result: RemoteResult = { signals: [], degradedSources: [] };
    if (pipelines.status === 'fulfilled') {
      this.appendPipelineSignals(project, pipelines.value, result);
    } else {
      this.appendRejectedSource(project, 'pipelines', pipelines.reason, result);
    }
    if (pullRequests.status === 'fulfilled') {
      this.appendPullRequestSignals(project, pullRequests.value, result);
    } else {
      this.appendRejectedSource(
        project,
        'pull_requests',
        pullRequests.reason,
        result,
      );
    }
    if (issues.status === 'fulfilled') {
      this.appendIssueSignals(project, issues.value, result);
    } else {
      this.appendRejectedSource(project, 'issues', issues.reason, result);
    }
    return result;
  }

  private appendPipelineSignals(
    project: ProjectView,
    view: ProjectPipelinesView,
    result: RemoteResult,
  ): void {
    for (const repository of view.repositories) {
      if (repository.state !== 'ready') {
        if (repository.state === 'error') {
          result.degradedSources.push({
            projectId: project.id,
            projectName: project.name,
            source: 'pipelines',
            message: repository.message ?? 'CI / CD indisponible.',
          });
        }
        continue;
      }
      const pipeline = repository.pipelines[0];
      if (
        !pipeline ||
        !['failed', 'running', 'pending'].includes(pipeline.status)
      ) {
        continue;
      }
      const failed = pipeline.status === 'failed';
      result.signals.push({
        id: `pipeline:${repository.repositoryId}:${pipeline.id}`,
        kind: 'pipeline',
        severity: failed ? 'critical' : 'info',
        title: failed ? 'CI / CD en échec' : 'CI / CD en cours',
        description: `${repository.repositoryName} · ${pipeline.ref} · ${pipeline.shortSha}`,
        project: projectSummary(project),
        repository: {
          id: repository.repositoryId,
          name: repository.repositoryName,
        },
        href: `/projects/${project.id}?tab=pipelines`,
        dueAt: null,
      });
    }
  }

  private appendPullRequestSignals(
    project: ProjectView,
    view: ProjectPullRequestsView,
    result: RemoteResult,
  ): void {
    for (const repository of view.repositories) {
      if (repository.state !== 'ready') {
        if (repository.state === 'error') {
          result.degradedSources.push({
            projectId: project.id,
            projectName: project.name,
            source: 'pull_requests',
            message: repository.message ?? 'Pull requests indisponibles.',
          });
        }
        continue;
      }
      for (const pullRequest of repository.pullRequests
        .filter((item) => item.state === 'open' || item.state === 'draft')
        .slice(0, 4)) {
        const blocked =
          pullRequest.hasConflicts === true ||
          pullRequest.pipelineStatus === 'failed';
        result.signals.push({
          id: `pull-request:${repository.repositoryId}:${pullRequest.id}`,
          kind: 'pull_request',
          severity: blocked ? 'critical' : 'info',
          title: blocked
            ? `PR #${pullRequest.number} bloquée`
            : `PR #${pullRequest.number} ouverte`,
          description: pullRequest.title,
          project: projectSummary(project),
          repository: {
            id: repository.repositoryId,
            name: repository.repositoryName,
          },
          href: `/projects/${project.id}?change=${repository.repositoryId}:${pullRequest.number}`,
          dueAt: null,
        });
      }
    }
  }

  private appendIssueSignals(
    project: ProjectView,
    view: ProjectIssuesView,
    result: RemoteResult,
  ): void {
    const priorityLabel =
      /(?:critical|urgent|priority[\s:/_-]*high|p0|p1|bug)/i;
    for (const repository of view.repositories) {
      if (repository.state !== 'ready') {
        if (repository.state === 'error') {
          result.degradedSources.push({
            projectId: project.id,
            projectName: project.name,
            source: 'issues',
            message: repository.message ?? 'Issues indisponibles.',
          });
        }
        continue;
      }
      for (const issue of repository.issues
        .filter(
          (item) =>
            item.state === 'open' &&
            item.labels.some((label) => priorityLabel.test(label)),
        )
        .slice(0, 3)) {
        result.signals.push({
          id: `issue:${repository.repositoryId}:${issue.id}`,
          kind: 'issue',
          severity: issue.labels.some((label) =>
            /(?:critical|urgent|p0)/i.test(label),
          )
            ? 'critical'
            : 'warning',
          title: `Issue #${issue.number} prioritaire`,
          description: issue.title,
          project: projectSummary(project),
          repository: {
            id: repository.repositoryId,
            name: repository.repositoryName,
          },
          href: `/projects/${project.id}?issue=${repository.repositoryId}:${issue.number}`,
          dueAt: null,
        });
      }
    }
  }

  private appendRejectedSource(
    project: ProjectView,
    source: TodayDegradedSource['source'],
    error: unknown,
    result: RemoteResult,
  ): void {
    result.degradedSources.push({
      projectId: project.id,
      projectName: project.name,
      source,
      message:
        error instanceof Error
          ? error.message
          : 'Source distante indisponible.',
    });
  }

  private async listFocus(): Promise<TodayFocusItem[]> {
    const rows = await this.focusRows()
      .orderByRaw('CASE WHEN focus.completed_at IS NULL THEN 0 ELSE 1 END')
      .orderBy('focus.created_at', 'desc');
    return (rows as FocusRow[]).map((row) => this.toFocus(row));
  }

  private async findFocus(focusId: string): Promise<TodayFocusItem> {
    const row = (await this.focusRows().where('focus.id', focusId).first()) as
      FocusRow | undefined;
    if (!row) throw new NotFoundException('Priorité Focus introuvable.');
    return this.toFocus(row);
  }

  private focusRows() {
    return this.database
      .connection<FocusRow>('today_focus_items as focus')
      .leftJoin('projects', 'projects.id', 'focus.project_id')
      .select(
        'focus.*',
        'projects.name as project_name',
        'projects.logo_data_url as project_logo_data_url',
      );
  }

  private toFocus(row: FocusRow): TodayFocusItem {
    return {
      id: row.id,
      sourceKey: row.source_key,
      project: row.project_id
        ? {
            id: row.project_id,
            name: row.project_name ?? 'Projet supprimé',
            logoDataUrl: row.project_logo_data_url,
          }
        : null,
      title: row.title,
      description: row.description,
      href: row.href,
      priority: row.priority,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async assertFocusCapacity(): Promise<void> {
    const count = await this.database
      .connection('today_focus_items')
      .whereNull('completed_at')
      .count<{ count: number | string }[]>({ count: '*' })
      .first();
    if (Number(count?.count ?? 0) >= MAX_ACTIVE_FOCUS_ITEMS) {
      throw new ConflictException(
        `Le Focus est limité à ${MAX_ACTIVE_FOCUS_ITEMS} priorités actives.`,
      );
    }
  }

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .select('id')
      .where({ id: projectId })
      .first();
    if (!project) throw new NotFoundException('Projet introuvable.');
  }

  private assertHref(href: string | undefined): void {
    if (!href) return;
    if (href.startsWith('/') && !href.startsWith('//')) return;
    try {
      const url = new URL(href);
      if (url.protocol === 'https:') return;
    } catch {
      // Handled by the common validation error below.
    }
    throw new BadRequestException(
      'Le lien Focus doit être un chemin interne ou une URL HTTPS.',
    );
  }
}
