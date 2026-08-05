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
import type { CreateProjectDto } from './dto/create-project.dto';
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

interface RepositoryRow {
  id: string;
  project_id: string;
  connection_id: string | null;
  name: string;
  local_path: string;
  remote_url: string | null;
  provider: 'github' | 'gitlab' | 'unknown';
  created_at: string;
  updated_at: string;
}

interface ClientRow {
  id: string;
  name: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly git: GitService,
    private readonly remoteRepositories: RemoteRepositoriesService,
  ) {}

  async create(input: CreateProjectDto): Promise<ProjectView> {
    this.validateDates(input);
    if (input.clientId) await this.requireClient(input.clientId);
    const inspection = await this.prepareRepository(input);
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
          connection_id: input.connectionId ?? null,
          name: inspection.name,
          local_path: inspection.canonicalPath,
          remote_url: inspection.remoteUrl,
          provider: inspection.provider,
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

  private async prepareRepository(
    input: CreateProjectDto,
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

  private prepareExistingRemote(input: CreateProjectDto) {
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

  private prepareNewRemote(input: CreateProjectDto) {
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
    if (input.startDate && input.deadline && input.deadline < input.startDate) {
      throw new BadRequestException(
        'La deadline doit être postérieure à la date de début.',
      );
    }
    if (input.followUpNote && !input.followUpDate) {
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

  private selectRepositories(projectId: string): Promise<RepositoryRow[]> {
    return this.database
      .connection<RepositoryRow>('repositories')
      .select('*')
      .where('project_id', projectId)
      .orderBy('created_at', 'asc');
  }

  private async toProjectView(
    project: ProjectRow,
    freshInspection?: RepositoryInspection,
  ): Promise<ProjectView> {
    const repositories = await this.selectRepositories(project.id);
    const repositoryViews = await Promise.all(
      repositories.map((repository, index) =>
        this.toRepositoryView(
          repository,
          index === 0 ? freshInspection : undefined,
        ),
      ),
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

  private async toRepositoryView(
    repository: RepositoryRow,
    freshInspection?: RepositoryInspection,
  ): Promise<RepositoryView> {
    const inspection =
      freshInspection?.canonicalPath === repository.local_path
        ? freshInspection
        : await this.inspectStoredRepository(repository.local_path);
    const updatedAt = inspection
      ? await this.syncRepositoryMetadata(repository, inspection)
      : repository.updated_at;

    return {
      id: repository.id,
      name: inspection?.name ?? repository.name,
      localPath: repository.local_path,
      remoteUrl: inspection ? inspection.remoteUrl : repository.remote_url,
      provider: inspection?.provider ?? repository.provider,
      state:
        inspection?.state ??
        (await this.git.observeRepository(repository.local_path)),
      createdAt: repository.created_at,
      updatedAt,
    };
  }

  private async inspectStoredRepository(
    repositoryPath: string,
  ): Promise<RepositoryInspection | undefined> {
    try {
      return await this.git.inspectRepository(repositoryPath);
    } catch {
      return undefined;
    }
  }

  private async syncRepositoryMetadata(
    repository: RepositoryRow,
    inspection: RepositoryInspection,
  ): Promise<string> {
    if (
      repository.name === inspection.name &&
      repository.remote_url === inspection.remoteUrl &&
      repository.provider === inspection.provider
    ) {
      return repository.updated_at;
    }

    const updatedAt = new Date().toISOString();
    await this.database
      .connection('repositories')
      .where({ id: repository.id })
      .update({
        name: inspection.name,
        remote_url: inspection.remoteUrl,
        provider: inspection.provider,
        updated_at: updatedAt,
      });
    return updatedAt;
  }
}
