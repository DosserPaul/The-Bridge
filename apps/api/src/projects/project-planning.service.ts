import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CreateDecisionDto } from './dto/create-decision.dto';
import type {
  CreateMilestoneDto,
  LinkedIssueDto,
} from './dto/create-milestone.dto';
import type { UpdateDecisionDto } from './dto/update-decision.dto';
import type { UpdateMilestoneDto } from './dto/update-milestone.dto';
import type {
  DecisionStatus,
  LinkedIssue,
  MilestoneRiskLevel,
  MilestoneStatus,
  ProjectDecision,
  ProjectMilestone,
} from './project-planning.types';

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  due_date: string | null;
  risk_level: MilestoneRiskLevel;
  blockers: string | null;
  linked_issues_json: string;
  created_at: string;
  updated_at: string;
}

interface DecisionRow {
  id: string;
  project_id: string;
  title: string;
  status: DecisionStatus;
  context: string;
  decision: string;
  rationale: string | null;
  alternatives_json: string;
  consequences: string | null;
  participants_json: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function assertCalendarDate(value: string | null | undefined, label: string) {
  if (value === null || value === undefined) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(
      `${label} doit utiliser le format AAAA-MM-JJ.`,
    );
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${label} est invalide.`);
  }
}

@Injectable()
export class ProjectPlanningService {
  constructor(private readonly database: DatabaseService) {}

  async listMilestones(projectId: string): Promise<ProjectMilestone[]> {
    await this.requireProject(projectId);
    const rows = await this.database
      .connection<MilestoneRow>('project_milestones')
      .where({ project_id: projectId })
      .orderByRaw('CASE WHEN due_date IS NULL THEN 1 ELSE 0 END')
      .orderBy('due_date', 'asc')
      .orderBy('created_at', 'asc');
    return rows.map((row) => this.toMilestone(row));
  }

  async createMilestone(
    projectId: string,
    input: CreateMilestoneDto,
  ): Promise<ProjectMilestone> {
    await this.requireProject(projectId);
    assertCalendarDate(input.dueDate, 'La deadline du jalon');
    const linkedIssues = await this.normalizeLinkedIssues(
      projectId,
      input.linkedIssues ?? [],
    );
    const now = new Date().toISOString();
    const id = randomUUID();
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_milestones').insert({
        id,
        project_id: projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'planned',
        due_date: input.dueDate ?? null,
        risk_level: input.riskLevel ?? 'low',
        blockers: input.blockers ?? null,
        linked_issues_json: JSON.stringify(linkedIssues),
        created_at: now,
        updated_at: now,
      });
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: now });
    });
    return this.findMilestone(projectId, id);
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    input: UpdateMilestoneDto,
  ): Promise<ProjectMilestone> {
    await this.findMilestoneRow(projectId, milestoneId);
    assertCalendarDate(input.dueDate, 'La deadline du jalon');
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.riskLevel !== undefined) patch.risk_level = input.riskLevel;
    if (input.blockers !== undefined) patch.blockers = input.blockers;
    if (input.linkedIssues !== undefined) {
      patch.linked_issues_json = JSON.stringify(
        await this.normalizeLinkedIssues(projectId, input.linkedIssues),
      );
    }
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_milestones')
        .where({ id: milestoneId, project_id: projectId })
        .update(patch);
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: patch.updated_at });
    });
    return this.findMilestone(projectId, milestoneId);
  }

  async removeMilestone(projectId: string, milestoneId: string): Promise<void> {
    await this.findMilestoneRow(projectId, milestoneId);
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_milestones')
        .where({ id: milestoneId, project_id: projectId })
        .delete();
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: new Date().toISOString() });
    });
  }

  async listDecisions(projectId: string): Promise<ProjectDecision[]> {
    await this.requireProject(projectId);
    const rows = await this.database
      .connection<DecisionRow>('project_decisions')
      .where({ project_id: projectId })
      .orderBy('decided_at', 'desc')
      .orderBy('created_at', 'desc');
    return rows.map((row) => this.toDecision(row));
  }

  async createDecision(
    projectId: string,
    input: CreateDecisionDto,
  ): Promise<ProjectDecision> {
    await this.requireProject(projectId);
    assertCalendarDate(input.decidedAt, 'La date de décision');
    const now = new Date().toISOString();
    const id = randomUUID();
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_decisions').insert({
        id,
        project_id: projectId,
        title: input.title,
        status: input.status ?? 'proposed',
        context: input.context,
        decision: input.decision,
        rationale: input.rationale ?? null,
        alternatives_json: JSON.stringify(input.alternatives ?? []),
        consequences: input.consequences ?? null,
        participants_json: JSON.stringify(input.participants ?? []),
        decided_at: input.decidedAt,
        created_at: now,
        updated_at: now,
      });
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: now });
    });
    return this.findDecision(projectId, id);
  }

  async updateDecision(
    projectId: string,
    decisionId: string,
    input: UpdateDecisionDto,
  ): Promise<ProjectDecision> {
    await this.findDecisionRow(projectId, decisionId);
    assertCalendarDate(input.decidedAt, 'La date de décision');
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) patch.status = input.status;
    if (input.context !== undefined) patch.context = input.context;
    if (input.decision !== undefined) patch.decision = input.decision;
    if (input.rationale !== undefined) patch.rationale = input.rationale;
    if (input.alternatives !== undefined) {
      patch.alternatives_json = JSON.stringify(input.alternatives);
    }
    if (input.consequences !== undefined)
      patch.consequences = input.consequences;
    if (input.participants !== undefined) {
      patch.participants_json = JSON.stringify(input.participants);
    }
    if (input.decidedAt !== undefined) patch.decided_at = input.decidedAt;
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_decisions')
        .where({ id: decisionId, project_id: projectId })
        .update(patch);
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: patch.updated_at });
    });
    return this.findDecision(projectId, decisionId);
  }

  async removeDecision(projectId: string, decisionId: string): Promise<void> {
    await this.findDecisionRow(projectId, decisionId);
    await this.database.connection.transaction(async (transaction) => {
      await transaction('project_decisions')
        .where({ id: decisionId, project_id: projectId })
        .delete();
      await transaction('projects')
        .where({ id: projectId })
        .update({ updated_at: new Date().toISOString() });
    });
  }

  private async findMilestone(projectId: string, milestoneId: string) {
    return this.toMilestone(
      await this.findMilestoneRow(projectId, milestoneId),
    );
  }

  private async findMilestoneRow(projectId: string, milestoneId: string) {
    const row = await this.database
      .connection<MilestoneRow>('project_milestones')
      .where({ id: milestoneId, project_id: projectId })
      .first();
    if (!row) throw new NotFoundException('Jalon introuvable.');
    return row;
  }

  private async findDecision(projectId: string, decisionId: string) {
    return this.toDecision(await this.findDecisionRow(projectId, decisionId));
  }

  private async findDecisionRow(projectId: string, decisionId: string) {
    const row = await this.database
      .connection<DecisionRow>('project_decisions')
      .where({ id: decisionId, project_id: projectId })
      .first();
    if (!row) throw new NotFoundException('Décision introuvable.');
    return row;
  }

  private async requireProject(projectId: string) {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .where({ id: projectId })
      .first();
    if (!project) throw new NotFoundException('Projet introuvable.');
  }

  private async normalizeLinkedIssues(
    projectId: string,
    issues: LinkedIssueDto[],
  ): Promise<LinkedIssue[]> {
    const repositoryIds = [
      ...new Set(issues.map(({ repositoryId }) => repositoryId)),
    ];
    if (repositoryIds.length) {
      const rows = await this.database
        .connection('repositories')
        .select('id')
        .where({ project_id: projectId })
        .whereIn('id', repositoryIds);
      if (rows.length !== repositoryIds.length) {
        throw new BadRequestException(
          'Une issue liée appartient à un repository extérieur au projet.',
        );
      }
    }
    return Array.from(
      new Map(
        issues.map((issue) => [
          `${issue.repositoryId}:${issue.number}`,
          {
            repositoryId: issue.repositoryId,
            repositoryName: issue.repositoryName,
            number: issue.number,
            title: issue.title,
            webUrl: issue.webUrl,
          },
        ]),
      ).values(),
    );
  }

  private toMilestone(row: MilestoneRow): ProjectMilestone {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      dueDate: row.due_date,
      riskLevel: row.risk_level,
      blockers: row.blockers,
      linkedIssues: parseJsonArray<LinkedIssue>(row.linked_issues_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toDecision(row: DecisionRow): ProjectDecision {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      context: row.context,
      decision: row.decision,
      rationale: row.rationale,
      alternatives: parseJsonArray<string>(row.alternatives_json),
      consequences: row.consequences,
      participants: parseJsonArray<string>(row.participants_json),
      decidedAt: row.decided_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
