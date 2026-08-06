import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Knex } from 'knex';
import { isUniqueConstraintError } from '../database/database-error';
import { DatabaseService } from '../database/database.service';
import { RemoteRepositoriesService } from '../integrations/remote-repositories.service';
import { RepositoryCatalogService } from '../repositories/repository-catalog.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { CreateRepositoryDto } from './dto/create-repository.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import type { ValidateRepositoryPathDto } from './dto/validate-repository-path.dto';
import { GitService, type RepositoryInspection } from './git.service';
import type {
  ProjectView,
  RepositoryPathValidation,
  RepositoryView,
} from './projects.types';

interface ProjectRow {
  id: string;
  name: string;
  logo_data_url: string | null;
  description: string | null;
  status: 'planned' | 'active' | 'paused' | 'completed' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'critical';
  types_json: string;
  technologies_json: string;
  start_date: string | null;
  deadline: string | null;
  follow_up_date: string | null;
  follow_up_note: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientRow {
  id: string;
  name: string;
}

type RepositoryInput = CreateProjectDto | CreateRepositoryDto;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly git: GitService,
    private readonly remoteRepositories: RemoteRepositoriesService,
    private readonly repositoryCatalog: RepositoryCatalogService,
  ) {}

  async create(input: CreateProjectDto): Promise<ProjectView> {
    this.validateDates(input);
    if (input.clientId) await this.requireClient(input.clientId);
    const inspection = await this.prepareRepository(input);
    const association = await this.repositoryCatalog.validateConnection(
      input.connectionId,
      inspection,
    );
    const now = new Date().toISOString();
    const projectId = randomUUID();
    const repositoryId = randomUUID();

    try {
      await this.database.connection.transaction(async (transaction) => {
        const clientId = input.clientId
          ? await this.requireClient(input.clientId, transaction)
          : input.clientName
            ? await this.findOrCreateClient(input.clientName, now, transaction)
            : null;

        await transaction('projects').insert({
          id: projectId,
          client_id: clientId,
          name: input.name,
          logo_data_url: input.logoDataUrl ?? null,
          description: input.description ?? null,
          status: input.status ?? 'active',
          priority: input.priority ?? 'normal',
          types_json: JSON.stringify(input.types ?? []),
          technologies_json: JSON.stringify(input.technologies ?? []),
          start_date: input.startDate ?? null,
          deadline: input.deadline ?? null,
          follow_up_date: input.followUpDate ?? null,
          follow_up_note: input.followUpNote ?? null,
          created_at: now,
          updated_at: now,
        });

        await transaction('repositories').insert({
          id: repositoryId,
          project_id: projectId,
          connection_id: association.connectionId,
          name: inspection.name,
          local_path: inspection.canonicalPath,
          remote_url: inspection.remoteUrl,
          provider: association.provider,
          created_at: now,
          updated_at: now,
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'repositories.local_path')) {
        throw new ConflictException(
          'Ce repository est déjà rattaché à un projet.',
        );
      }
      throw error;
    }

    return this.findOne(projectId, inspection);
  }

  async validateRepositoryPath(
    input: ValidateRepositoryPathDto,
  ): Promise<RepositoryPathValidation> {
    if (input.repositoryMode === 'local') {
      const inspection = await this.git.inspectRepository(input.repositoryPath);
      await this.assertRepositoryPathAvailable(inspection.canonicalPath);

      return {
        repositoryMode: input.repositoryMode,
        resolvedPath: inspection.canonicalPath,
        repository: {
          name: inspection.name,
          provider: inspection.provider,
          remoteUrl: inspection.remoteUrl,
          branch: inspection.state.branch,
        },
      };
    }

    const cloneDestinationMode = input.cloneDestinationMode ?? 'exact';
    if (
      cloneDestinationMode === 'subfolder' &&
      (!input.cloneDirectoryName ||
        input.cloneDirectoryName === '.' ||
        input.cloneDirectoryName === '..')
    ) {
      throw new BadRequestException(
        'Le nom du dossier à créer est requis pour vérifier cette destination.',
      );
    }

    const requestedPath =
      cloneDestinationMode === 'subfolder'
        ? resolve(input.repositoryPath, input.cloneDirectoryName!)
        : input.repositoryPath;
    const resolvedPath = await this.git.validateCloneDestination(requestedPath);
    await this.assertRepositoryPathAvailable(resolvedPath);

    return {
      repositoryMode: input.repositoryMode,
      resolvedPath,
      repository: null,
    };
  }

  async findAll(): Promise<ProjectView[]> {
    const projects = await this.selectProjects();
    return Promise.all(projects.map((project) => this.toProjectView(project)));
  }

  async findOne(
    projectId: string,
    freshInspection?: RepositoryInspection,
  ): Promise<ProjectView> {
    const project = await this.selectProject(projectId);
    if (!project) throw new NotFoundException('Projet introuvable.');
    return this.toProjectView(project, freshInspection);
  }

  async update(
    projectId: string,
    input: UpdateProjectDto,
  ): Promise<ProjectView> {
    const project = await this.selectProject(projectId);
    if (!project) throw new NotFoundException('Projet introuvable.');
    if (typeof input.clientId === 'string') {
      await this.requireClient(input.clientId);
    }

    const startDate =
      input.startDate === undefined ? project.start_date : input.startDate;
    const deadline =
      input.deadline === undefined ? project.deadline : input.deadline;
    const followUpDate =
      input.followUpDate === undefined
        ? project.follow_up_date
        : input.followUpDate;
    const followUpNote =
      input.followUpNote === undefined
        ? project.follow_up_note
        : input.followUpNote;
    this.validateDateValues(startDate, deadline, followUpDate, followUpNote);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = input.name;
    if (input.logoDataUrl !== undefined)
      patch.logo_data_url = input.logoDataUrl;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.types !== undefined)
      patch.types_json = JSON.stringify(input.types);
    if (input.technologies !== undefined)
      patch.technologies_json = JSON.stringify(input.technologies);
    if (input.startDate !== undefined) patch.start_date = input.startDate;
    if (input.deadline !== undefined) patch.deadline = input.deadline;
    if (input.followUpDate !== undefined)
      patch.follow_up_date = input.followUpDate;
    if (input.followUpNote !== undefined)
      patch.follow_up_note = input.followUpNote;
    if (input.clientId !== undefined) patch.client_id = input.clientId;

    await this.database
      .connection('projects')
      .where({ id: projectId })
      .update(patch);
    return this.findOne(projectId);
  }

  archive(projectId: string): Promise<ProjectView> {
    return this.update(projectId, { status: 'archived' });
  }

  async addRepository(
    projectId: string,
    input: CreateRepositoryDto,
  ): Promise<ProjectView> {
    if (!(await this.selectProject(projectId))) {
      throw new NotFoundException('Projet introuvable.');
    }
    const inspection = await this.prepareRepository(input);
    const association = await this.repositoryCatalog.validateConnection(
      input.connectionId,
      inspection,
    );
    const now = new Date().toISOString();
    try {
      await this.database.connection('repositories').insert({
        id: randomUUID(),
        project_id: projectId,
        connection_id: association.connectionId,
        name: inspection.name,
        local_path: inspection.canonicalPath,
        remote_url: inspection.remoteUrl,
        provider: association.provider,
        created_at: now,
        updated_at: now,
      });
      await this.database
        .connection('projects')
        .where({ id: projectId })
        .update({ updated_at: now });
    } catch (error) {
      if (isUniqueConstraintError(error, 'repositories.local_path')) {
        throw new ConflictException(
          'Ce repository est déjà rattaché à un projet.',
        );
      }
      throw error;
    }
    return this.findOne(projectId, inspection);
  }

  async removeRepository(
    projectId: string,
    repositoryId: string,
  ): Promise<void> {
    await this.repositoryCatalog.getRecord(projectId, repositoryId);
    await this.database
      .connection('repositories')
      .where({ id: repositoryId, project_id: projectId })
      .delete();
    await this.database
      .connection('projects')
      .where({ id: projectId })
      .update({ updated_at: new Date().toISOString() });
  }

  associateRepositoryConnection(
    projectId: string,
    repositoryId: string,
    connectionId: string | null,
  ): Promise<RepositoryView> {
    return this.repositoryCatalog.associateConnection(
      projectId,
      repositoryId,
      connectionId,
    );
  }

  private async prepareRepository(
    input: RepositoryInput,
  ): Promise<RepositoryInspection> {
    const mode = input.repositoryMode ?? 'local';
    if (mode === 'local') {
      return this.git.inspectRepository(input.repositoryPath);
    }

    if (!input.provider || !input.connectionId) {
      throw new BadRequestException(
        'Une connexion GitHub ou GitLab est requise pour ce repository.',
      );
    }

    const repositoryPath = await this.git.validateCloneDestination(
      input.repositoryPath,
    );
    await this.assertRepositoryPathAvailable(repositoryPath);

    const remote =
      mode === 'existing'
        ? await this.prepareExistingRemote(input)
        : await this.prepareNewRemote(input);

    try {
      return await this.git.cloneRepository({
        cloneUrl: remote.repository.cloneUrl,
        targetPath: repositoryPath,
        username: remote.credentials.username,
        password: remote.credentials.password,
      });
    } catch (error) {
      if (mode === 'create') {
        throw new BadRequestException(
          `Le repository distant a été créé (${remote.repository.webUrl}), mais son clone local a échoué. Il n’a pas été supprimé du provider.`,
        );
      }
      throw error;
    }
  }

  private prepareExistingRemote(input: RepositoryInput) {
    if (!input.provider || !input.connectionId || !input.remoteRepositoryId) {
      throw new BadRequestException(
        'Sélectionnez un repository distant avant de continuer.',
      );
    }
    return this.remoteRepositories.getWithCredentials(
      input.provider,
      input.connectionId,
      input.remoteRepositoryId,
    );
  }

  private prepareNewRemote(input: RepositoryInput) {
    if (!input.provider || !input.connectionId || !input.remoteRepositoryName) {
      throw new BadRequestException('Indiquez le nom du repository à créer.');
    }
    return this.remoteRepositories.createWithCredentials(
      input.provider,
      input.connectionId,
      {
        name: input.remoteRepositoryName,
        description: input.description,
        visibility: input.repositoryVisibility ?? 'private',
        initializeReadme: input.initializeReadme ?? true,
      },
    );
  }

  private async assertRepositoryPathAvailable(
    repositoryPath: string,
  ): Promise<void> {
    const existing = await this.database
      .connection<{ id: string }>('repositories')
      .select('id')
      .whereIn('local_path', [repositoryPath, resolve(repositoryPath)])
      .first();
    if (existing) {
      throw new ConflictException(
        'Cette destination locale est déjà rattachée à un projet.',
      );
    }
  }

  private validateDates(input: CreateProjectDto): void {
    this.validateDateValues(
      input.startDate,
      input.deadline,
      input.followUpDate,
      input.followUpNote,
    );
  }

  private validateDateValues(
    startDate: string | null | undefined,
    deadline: string | null | undefined,
    followUpDate: string | null | undefined,
    followUpNote: string | null | undefined,
  ): void {
    if (startDate && deadline && deadline < startDate) {
      throw new BadRequestException(
        'La deadline doit être postérieure à la date de début.',
      );
    }
    if (followUpNote && !followUpDate) {
      throw new BadRequestException(
        'Ajoutez une date au follow-up ou retirez sa note.',
      );
    }
  }

  private async findOrCreateClient(
    name: string,
    now: string,
    transaction: Knex.Transaction,
  ): Promise<string> {
    const existingClient = await transaction<ClientRow>('clients')
      .select('id', 'name')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (existingClient) return existingClient.id;

    const clientId = randomUUID();
    await transaction('clients').insert({
      id: clientId,
      name,
      created_at: now,
      updated_at: now,
    });
    return clientId;
  }

  private async requireClient(
    clientId: string,
    connection: Knex | Knex.Transaction = this.database.connection,
  ): Promise<string> {
    const client = await connection<ClientRow>('clients')
      .select('id', 'name')
      .where({ id: clientId })
      .first();
    if (!client) throw new NotFoundException('Client introuvable.');
    return client.id;
  }

  private async selectProjects(): Promise<ProjectRow[]> {
    return this.database
      .connection<ProjectRow>('projects')
      .leftJoin('clients', 'clients.id', 'projects.client_id')
      .select(
        'projects.*',
        this.database.connection.raw('clients.name AS client_name'),
      )
      .orderBy('projects.updated_at', 'desc');
  }

  private selectProject(projectId: string): Promise<ProjectRow | undefined> {
    return this.database
      .connection<ProjectRow>('projects')
      .leftJoin('clients', 'clients.id', 'projects.client_id')
      .select(
        'projects.*',
        this.database.connection.raw('clients.name AS client_name'),
      )
      .where('projects.id', projectId)
      .first();
  }

  private async toProjectView(
    project: ProjectRow,
    freshInspection?: RepositoryInspection,
  ): Promise<ProjectView> {
    const repositoryViews = await this.repositoryCatalog.listProjectSnapshots(
      project.id,
      freshInspection,
    );

    return {
      id: project.id,
      name: project.name,
      logoDataUrl: project.logo_data_url,
      description: project.description,
      status: project.status,
      priority: project.priority,
      types: this.parseStringArray(project.types_json),
      technologies: this.parseStringArray(project.technologies_json),
      startDate: project.start_date,
      deadline: project.deadline,
      followUp: project.follow_up_date
        ? { date: project.follow_up_date, note: project.follow_up_note }
        : null,
      client:
        project.client_id && project.client_name
          ? { id: project.client_id, name: project.client_name }
          : null,
      repositories: repositoryViews,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
}
