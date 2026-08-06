import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AgentsService } from './agents.service';

describe('AgentsService', () => {
  let database: DatabaseService;
  let service: AgentsService;
  let projectId: string;
  let repositoryId: string;

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    await database.initialize();
    service = new AgentsService(database);
    projectId = randomUUID();
    repositoryId = randomUUID();
    const now = new Date().toISOString();
    await database.connection('projects').insert({
      id: projectId,
      name: 'The Bridge',
      created_at: now,
      updated_at: now,
    });
    await database.connection('repositories').insert({
      id: repositoryId,
      project_id: projectId,
      name: 'The-Bridge',
      local_path: `/tmp/${repositoryId}`,
      provider: 'github',
      created_at: now,
      updated_at: now,
    });
  });

  afterEach(async () => database.onModuleDestroy());

  it('creates a reusable agent with flexible runtime and explicit scopes', async () => {
    const agent = await service.createAgent({
      name: 'API Lead',
      role: 'Technical lead — API',
      status: 'active',
      runtimeProvider: 'anthropic',
      modelId: 'claude-opus-max',
      capabilities: ['nestjs', 'architecture'],
      permissionPolicy: 'supervised',
      approvalPolicy: 'destructive',
      monthlyBudgetCents: 15_000,
      maxConcurrency: 2,
      projectIds: [projectId],
      repositoryIds: [repositoryId],
    });

    expect(agent).toMatchObject({
      slug: 'api-lead',
      status: 'active',
      runtime: { provider: 'anthropic', model: 'claude-opus-max' },
      projects: [{ id: projectId, name: 'The Bridge' }],
      repositories: [{ id: repositoryId, projectId }],
    });
    expect(agent.capabilities).toEqual(['nestjs', 'architecture']);
  });

  it('builds a contextual hierarchy without changing agent identity', async () => {
    const cto = await service.createAgent({ name: 'CTO', role: 'CTO' });
    const apiLead = await service.createAgent({
      name: 'API Lead',
      role: 'API specialist',
    });
    const qa = await service.createAgent({ name: 'QA', role: 'QA engineer' });
    const team = await service.createTeam({
      name: 'Product engineering',
      projectIds: [projectId],
    });

    const updated = await service.replaceTeamAssignments(team.id, [
      { agentId: cto.id, role: 'CTO', parentAgentId: null, sortOrder: 0 },
      {
        agentId: apiLead.id,
        role: 'API Lead',
        parentAgentId: cto.id,
        sortOrder: 1,
      },
      {
        agentId: qa.id,
        role: 'QA',
        parentAgentId: apiLead.id,
        sortOrder: 2,
      },
    ]);

    expect(updated.assignments).toHaveLength(3);
    const ctoAssignment = updated.assignments.find(
      (assignment) => assignment.agent.id === cto.id,
    );
    const leadAssignment = updated.assignments.find(
      (assignment) => assignment.agent.id === apiLead.id,
    );
    const qaAssignment = updated.assignments.find(
      (assignment) => assignment.agent.id === qa.id,
    );
    expect(ctoAssignment?.parentAssignmentId).toBeNull();
    expect(leadAssignment?.parentAssignmentId).toBe(ctoAssignment?.id);
    expect(qaAssignment?.parentAssignmentId).toBe(leadAssignment?.id);
    await expect(service.findAgent(apiLead.id)).resolves.toMatchObject({
      role: 'API specialist',
      teams: [{ id: team.id, role: 'API Lead' }],
    });
  });

  it('rejects self-parenting, cycles, missing parents, and multiple roots', async () => {
    const first = await service.createAgent({ name: 'First', role: 'Lead' });
    const second = await service.createAgent({ name: 'Second', role: 'Dev' });
    const team = await service.createTeam({ name: 'Invalid team' });

    await expect(
      service.replaceTeamAssignments(team.id, [
        {
          agentId: first.id,
          role: 'Lead',
          parentAgentId: first.id,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.replaceTeamAssignments(team.id, [
        { agentId: first.id, role: 'Lead', parentAgentId: second.id },
        { agentId: second.id, role: 'Dev', parentAgentId: first.id },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.replaceTeamAssignments(team.id, [
        { agentId: first.id, role: 'Lead' },
        { agentId: second.id, role: 'Dev' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.replaceTeamAssignments(team.id, [
        {
          agentId: first.id,
          role: 'Lead',
          parentAgentId: randomUUID(),
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
