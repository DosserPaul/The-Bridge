import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { isUniqueConstraintError } from '../database/database-error';
import { DatabaseService } from '../database/database.service';
import type { CreateAgentTeamDto } from './dto/create-agent-team.dto';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { AgentAssignmentInputDto } from './dto/replace-team-assignments.dto';
import type { UpdateAgentTeamDto } from './dto/update-agent-team.dto';
import type { UpdateAgentDto } from './dto/update-agent.dto';
import type {
  AgentAssignmentView,
  AgentProjectScope,
  AgentRepositoryScope,
  AgentStatus,
  AgentTeamSummary,
  AgentTeamStatus,
  AgentTeamView,
  AgentView,
  ApprovalPolicy,
  PermissionPolicy,
} from './agents.types';

interface AgentRow {
  id: string;
  name: string;
  slug: string;
  avatar_data_url: string | null;
  role: string;
  description: string | null;
  instructions: string | null;
  status: AgentStatus;
  runtime_provider: string | null;
  model_id: string | null;
  service_tier: string | null;
  reasoning_level: string | null;
  capabilities_json: string;
  permission_policy: PermissionPolicy;
  approval_policy: ApprovalPolicy;
  monthly_budget_cents: number | null;
  max_concurrency: number | null;
  created_at: string;
  updated_at: string;
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: AgentTeamStatus;
  created_at: string;
  updated_at: string;
}

interface AssignmentQueryRow {
  id: string;
  parentAssignmentId: string | null;
  role: string;
  sortOrder: number;
  agentId: string;
  agentName: string;
  agentSlug: string;
  agentAvatarDataUrl: string | null;
  agentRole: string;
  agentStatus: AgentStatus;
  runtimeProvider: string | null;
  modelId: string | null;
  serviceTier: string | null;
  reasoningLevel: string | null;
}

interface ProjectScopeIdRow {
  project_id: string;
}

interface RepositoryScopeIdRow {
  repository_id: string;
}

type Connection = Knex | Knex.Transaction;

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function unique(values: string[] | undefined): string[] {
  return [...new Set(values ?? [])];
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function rowsAs<T>(query: PromiseLike<unknown>): Promise<T[]> {
  const rows = await query;
  if (!Array.isArray(rows)) return [];
  return rows as T[];
}

@Injectable()
export class AgentsService {
  constructor(private readonly database: DatabaseService) {}

  async createAgent(input: CreateAgentDto): Promise<AgentView> {
    const projectIds = unique(input.projectIds);
    const repositoryIds = unique(input.repositoryIds);
    await this.validateScopes(projectIds, repositoryIds);

    const now = new Date().toISOString();
    const id = randomUUID();
    const slug = await this.resolveSlug('agents', input.slug ?? input.name);

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('agents').insert({
          id,
          name: input.name,
          slug,
          avatar_data_url: input.avatarDataUrl ?? null,
          role: input.role,
          description: input.description ?? null,
          instructions: input.instructions ?? null,
          status: input.status ?? 'draft',
          runtime_provider: input.runtimeProvider ?? null,
          model_id: input.modelId ?? null,
          service_tier: input.serviceTier ?? null,
          reasoning_level: input.reasoningLevel ?? null,
          capabilities_json: JSON.stringify(unique(input.capabilities)),
          permission_policy: input.permissionPolicy ?? 'supervised',
          approval_policy: input.approvalPolicy ?? 'destructive',
          monthly_budget_cents: input.monthlyBudgetCents ?? null,
          max_concurrency: input.maxConcurrency ?? null,
          created_at: now,
          updated_at: now,
        });
        await this.replaceAgentScopes(
          id,
          projectIds,
          repositoryIds,
          transaction,
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException('Ce slug d’agent est déjà utilisé.');
      }
      throw error;
    }

    return this.findAgent(id);
  }

  async findAgents(): Promise<AgentView[]> {
    const rows = await this.database
      .connection<AgentRow>('agents')
      .select('*')
      .orderByRaw("CASE WHEN status = 'archived' THEN 1 ELSE 0 END")
      .orderBy('updated_at', 'desc');
    return Promise.all(rows.map((row) => this.toAgentView(row)));
  }

  async findAgent(agentId: string): Promise<AgentView> {
    const row = await this.selectAgent(agentId);
    if (!row) throw new NotFoundException('Agent introuvable.');
    return this.toAgentView(row);
  }

  async updateAgent(
    agentId: string,
    input: UpdateAgentDto,
  ): Promise<AgentView> {
    const current = await this.selectAgent(agentId);
    if (!current) throw new NotFoundException('Agent introuvable.');

    const projectIds =
      input.projectIds === undefined ? null : unique(input.projectIds);
    const repositoryIds =
      input.repositoryIds === undefined ? null : unique(input.repositoryIds);
    if (projectIds !== null || repositoryIds !== null) {
      const existing = await this.agentScopeIds(agentId);
      await this.validateScopes(
        projectIds ?? existing.projectIds,
        repositoryIds ?? existing.repositoryIds,
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.avatarDataUrl !== undefined)
      patch.avatar_data_url = input.avatarDataUrl;
    if (input.role !== undefined) patch.role = input.role;
    if (input.description !== undefined) patch.description = input.description;
    if (input.instructions !== undefined)
      patch.instructions = input.instructions;
    if (input.status !== undefined) patch.status = input.status;
    if (input.runtimeProvider !== undefined)
      patch.runtime_provider = input.runtimeProvider;
    if (input.modelId !== undefined) patch.model_id = input.modelId;
    if (input.serviceTier !== undefined) patch.service_tier = input.serviceTier;
    if (input.reasoningLevel !== undefined)
      patch.reasoning_level = input.reasoningLevel;
    if (input.capabilities !== undefined)
      patch.capabilities_json = JSON.stringify(unique(input.capabilities));
    if (input.permissionPolicy !== undefined)
      patch.permission_policy = input.permissionPolicy;
    if (input.approvalPolicy !== undefined)
      patch.approval_policy = input.approvalPolicy;
    if (input.monthlyBudgetCents !== undefined)
      patch.monthly_budget_cents = input.monthlyBudgetCents;
    if (input.maxConcurrency !== undefined)
      patch.max_concurrency = input.maxConcurrency;

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('agents').where({ id: agentId }).update(patch);
        if (projectIds !== null || repositoryIds !== null) {
          const existing = await this.agentScopeIds(agentId, transaction);
          await this.replaceAgentScopes(
            agentId,
            projectIds ?? existing.projectIds,
            repositoryIds ?? existing.repositoryIds,
            transaction,
          );
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException('Ce slug d’agent est déjà utilisé.');
      }
      throw error;
    }

    return this.findAgent(agentId);
  }

  archiveAgent(agentId: string): Promise<AgentView> {
    return this.updateAgent(agentId, { status: 'archived' });
  }

  async createTeam(input: CreateAgentTeamDto): Promise<AgentTeamView> {
    const projectIds = unique(input.projectIds);
    await this.validateScopes(projectIds, []);
    const id = randomUUID();
    const now = new Date().toISOString();
    const slug = await this.resolveSlug(
      'agent_teams',
      input.slug ?? input.name,
    );

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('agent_teams').insert({
          id,
          name: input.name,
          slug,
          description: input.description ?? null,
          status: 'active',
          created_at: now,
          updated_at: now,
        });
        await this.replaceTeamProjectScopes(id, projectIds, transaction);
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException('Ce slug d’équipe est déjà utilisé.');
      }
      throw error;
    }

    return this.findTeam(id);
  }

  async findTeams(): Promise<AgentTeamView[]> {
    const rows = await this.database
      .connection<TeamRow>('agent_teams')
      .select('*')
      .orderByRaw("CASE WHEN status = 'archived' THEN 1 ELSE 0 END")
      .orderBy('updated_at', 'desc');
    return Promise.all(rows.map((row) => this.toTeamView(row)));
  }

  async findTeam(teamId: string): Promise<AgentTeamView> {
    const row = await this.selectTeam(teamId);
    if (!row) throw new NotFoundException('Équipe d’agents introuvable.');
    return this.toTeamView(row);
  }

  async updateTeam(
    teamId: string,
    input: UpdateAgentTeamDto,
  ): Promise<AgentTeamView> {
    if (!(await this.selectTeam(teamId))) {
      throw new NotFoundException('Équipe d’agents introuvable.');
    }
    const projectIds =
      input.projectIds === undefined ? null : unique(input.projectIds);
    if (projectIds) await this.validateScopes(projectIds, []);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;

    try {
      await this.database.connection.transaction(async (transaction) => {
        await transaction('agent_teams').where({ id: teamId }).update(patch);
        if (projectIds) {
          await this.replaceTeamProjectScopes(teamId, projectIds, transaction);
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException('Ce slug d’équipe est déjà utilisé.');
      }
      throw error;
    }

    return this.findTeam(teamId);
  }

  archiveTeam(teamId: string): Promise<AgentTeamView> {
    return this.updateTeam(teamId, { status: 'archived' });
  }

  async replaceTeamAssignments(
    teamId: string,
    assignments: AgentAssignmentInputDto[],
  ): Promise<AgentTeamView> {
    if (!(await this.selectTeam(teamId))) {
      throw new NotFoundException('Équipe d’agents introuvable.');
    }
    await this.validateAssignments(assignments);

    const now = new Date().toISOString();
    const assignmentIds = new Map(
      assignments.map((assignment) => [assignment.agentId, randomUUID()]),
    );

    await this.database.connection.transaction(async (transaction) => {
      await transaction('agent_team_assignments')
        .where({ team_id: teamId })
        .update({ parent_assignment_id: null });
      await transaction('agent_team_assignments')
        .where({ team_id: teamId })
        .delete();

      if (assignments.length) {
        await transaction('agent_team_assignments').insert(
          assignments.map((assignment, index) => ({
            id: assignmentIds.get(assignment.agentId)!,
            team_id: teamId,
            agent_id: assignment.agentId,
            parent_assignment_id: null,
            role: assignment.role,
            sort_order: assignment.sortOrder ?? index,
            created_at: now,
            updated_at: now,
          })),
        );
        for (const assignment of assignments) {
          if (!assignment.parentAgentId) continue;
          await transaction('agent_team_assignments')
            .where({ id: assignmentIds.get(assignment.agentId)! })
            .update({
              parent_assignment_id: assignmentIds.get(
                assignment.parentAgentId,
              )!,
            });
        }
      }
      await transaction('agent_teams')
        .where({ id: teamId })
        .update({ updated_at: now });
    });

    return this.findTeam(teamId);
  }

  private async selectAgent(
    agentId: string,
    connection: Connection = this.database.connection,
  ): Promise<AgentRow | undefined> {
    return connection<AgentRow>('agents').where({ id: agentId }).first();
  }

  private async selectTeam(
    teamId: string,
    connection: Connection = this.database.connection,
  ): Promise<TeamRow | undefined> {
    return connection<TeamRow>('agent_teams').where({ id: teamId }).first();
  }

  private async toAgentView(row: AgentRow): Promise<AgentView> {
    const [projects, repositories, teams] = await Promise.all([
      rowsAs<AgentProjectScope>(
        this.database
          .connection('agent_project_scopes as scope')
          .join('projects as project', 'project.id', 'scope.project_id')
          .where('scope.agent_id', row.id)
          .select('project.id', 'project.name')
          .orderBy('project.name'),
      ),
      rowsAs<AgentRepositoryScope>(
        this.database
          .connection('agent_repository_scopes as scope')
          .join(
            'repositories as repository',
            'repository.id',
            'scope.repository_id',
          )
          .join('projects as project', 'project.id', 'repository.project_id')
          .where('scope.agent_id', row.id)
          .select(
            'repository.id',
            'repository.name',
            'project.id as projectId',
            'project.name as projectName',
          )
          .orderBy('project.name')
          .orderBy('repository.name'),
      ),
      rowsAs<AgentTeamSummary>(
        this.database
          .connection('agent_team_assignments as assignment')
          .join('agent_teams as team', 'team.id', 'assignment.team_id')
          .where('assignment.agent_id', row.id)
          .select(
            'team.id',
            'team.name',
            'assignment.id as assignmentId',
            'assignment.role',
          )
          .orderBy('team.name'),
      ),
    ]);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      avatarDataUrl: row.avatar_data_url,
      role: row.role,
      description: row.description,
      instructions: row.instructions,
      status: row.status,
      runtime: {
        provider: row.runtime_provider,
        model: row.model_id,
        serviceTier: row.service_tier,
        reasoningLevel: row.reasoning_level,
      },
      capabilities: parseStringArray(row.capabilities_json),
      permissionPolicy: row.permission_policy,
      approvalPolicy: row.approval_policy,
      monthlyBudgetCents: row.monthly_budget_cents,
      maxConcurrency: row.max_concurrency,
      projects,
      repositories,
      teams,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async toTeamView(row: TeamRow): Promise<AgentTeamView> {
    const [projects, assignmentRows] = await Promise.all([
      rowsAs<AgentProjectScope>(
        this.database
          .connection('agent_team_project_scopes as scope')
          .join('projects as project', 'project.id', 'scope.project_id')
          .where('scope.team_id', row.id)
          .select('project.id', 'project.name')
          .orderBy('project.name'),
      ),
      rowsAs<AssignmentQueryRow>(
        this.database
          .connection('agent_team_assignments as assignment')
          .join('agents as agent', 'agent.id', 'assignment.agent_id')
          .where('assignment.team_id', row.id)
          .select(
            'assignment.id',
            'assignment.parent_assignment_id as parentAssignmentId',
            'assignment.role',
            'assignment.sort_order as sortOrder',
            'agent.id as agentId',
            'agent.name as agentName',
            'agent.slug as agentSlug',
            'agent.avatar_data_url as agentAvatarDataUrl',
            'agent.role as agentRole',
            'agent.status as agentStatus',
            'agent.runtime_provider as runtimeProvider',
            'agent.model_id as modelId',
            'agent.service_tier as serviceTier',
            'agent.reasoning_level as reasoningLevel',
          )
          .orderBy('assignment.sort_order'),
      ),
    ]);

    const assignments: AgentAssignmentView[] = assignmentRows.map(
      (assignment) => ({
        id: assignment.id,
        parentAssignmentId: assignment.parentAssignmentId,
        role: assignment.role,
        sortOrder: Number(assignment.sortOrder),
        agent: {
          id: assignment.agentId,
          name: assignment.agentName,
          slug: assignment.agentSlug,
          avatarDataUrl: assignment.agentAvatarDataUrl,
          role: assignment.agentRole,
          status: assignment.agentStatus,
          runtime: {
            provider: assignment.runtimeProvider,
            model: assignment.modelId,
            serviceTier: assignment.serviceTier,
            reasoningLevel: assignment.reasoningLevel,
          },
        },
      }),
    );

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      projects,
      assignments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async validateScopes(
    projectIds: string[],
    repositoryIds: string[],
  ): Promise<void> {
    if (projectIds.length) {
      const projects = await this.database
        .connection('projects')
        .whereIn('id', projectIds)
        .select('id');
      if (projects.length !== projectIds.length) {
        throw new BadRequestException(
          'Un ou plusieurs projets sélectionnés sont introuvables.',
        );
      }
    }
    if (repositoryIds.length) {
      const repositories = await this.database
        .connection('repositories')
        .whereIn('id', repositoryIds)
        .select('id');
      if (repositories.length !== repositoryIds.length) {
        throw new BadRequestException(
          'Un ou plusieurs repositories sélectionnés sont introuvables.',
        );
      }
    }
  }

  private async agentScopeIds(
    agentId: string,
    connection: Connection = this.database.connection,
  ): Promise<{ projectIds: string[]; repositoryIds: string[] }> {
    const [projects, repositories] = await Promise.all([
      rowsAs<ProjectScopeIdRow>(
        connection('agent_project_scopes')
          .where({ agent_id: agentId })
          .select('project_id'),
      ),
      rowsAs<RepositoryScopeIdRow>(
        connection('agent_repository_scopes')
          .where({ agent_id: agentId })
          .select('repository_id'),
      ),
    ]);
    return {
      projectIds: projects.map((row) => row.project_id),
      repositoryIds: repositories.map((row) => row.repository_id),
    };
  }

  private async replaceAgentScopes(
    agentId: string,
    projectIds: string[],
    repositoryIds: string[],
    connection: Connection,
  ): Promise<void> {
    await connection('agent_project_scopes')
      .where({ agent_id: agentId })
      .delete();
    await connection('agent_repository_scopes')
      .where({ agent_id: agentId })
      .delete();
    if (projectIds.length) {
      await connection('agent_project_scopes').insert(
        projectIds.map((projectId) => ({
          agent_id: agentId,
          project_id: projectId,
        })),
      );
    }
    if (repositoryIds.length) {
      await connection('agent_repository_scopes').insert(
        repositoryIds.map((repositoryId) => ({
          agent_id: agentId,
          repository_id: repositoryId,
        })),
      );
    }
  }

  private async replaceTeamProjectScopes(
    teamId: string,
    projectIds: string[],
    connection: Connection,
  ): Promise<void> {
    await connection('agent_team_project_scopes')
      .where({ team_id: teamId })
      .delete();
    if (projectIds.length) {
      await connection('agent_team_project_scopes').insert(
        projectIds.map((projectId) => ({
          team_id: teamId,
          project_id: projectId,
        })),
      );
    }
  }

  private async validateAssignments(
    assignments: AgentAssignmentInputDto[],
  ): Promise<void> {
    if (!assignments.length) return;
    const agentIds = assignments.map((assignment) => assignment.agentId);
    if (new Set(agentIds).size !== agentIds.length) {
      throw new BadRequestException(
        'Un agent ne peut occuper qu’une position dans une même équipe.',
      );
    }
    const roots = assignments.filter((assignment) => !assignment.parentAgentId);
    if (roots.length !== 1) {
      throw new BadRequestException(
        'Une équipe non vide doit avoir exactement un agent racine.',
      );
    }

    const agents = await this.database
      .connection<AgentRow>('agents')
      .whereIn('id', agentIds)
      .select('id', 'status');
    if (agents.length !== agentIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs agents de l’équipe sont introuvables.',
      );
    }
    if (agents.some((agent) => agent.status === 'archived')) {
      throw new BadRequestException(
        'Un agent archivé ne peut pas être ajouté à une équipe.',
      );
    }

    const parents = new Map(
      assignments.map((assignment) => [
        assignment.agentId,
        assignment.parentAgentId ?? null,
      ]),
    );
    for (const assignment of assignments) {
      if (assignment.parentAgentId === assignment.agentId) {
        throw new BadRequestException(
          'Un agent ne peut pas être son propre responsable.',
        );
      }
      if (assignment.parentAgentId && !parents.has(assignment.parentAgentId)) {
        throw new BadRequestException(
          'Chaque responsable doit appartenir à la même équipe.',
        );
      }

      const visited = new Set<string>();
      let current: string | null = assignment.agentId;
      while (current) {
        if (visited.has(current)) {
          throw new BadRequestException(
            'La hiérarchie de l’équipe contient un cycle.',
          );
        }
        visited.add(current);
        current = parents.get(current) ?? null;
      }
    }
  }

  private async resolveSlug(
    table: 'agents' | 'agent_teams',
    candidate: string,
  ): Promise<string> {
    const base = slugify(candidate) || (table === 'agents' ? 'agent' : 'team');
    let slug = base;
    let suffix = 2;
    while (await this.database.connection(table).where({ slug }).first('id')) {
      slug = `${base.slice(0, Math.max(1, 80 - String(suffix).length - 1))}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
