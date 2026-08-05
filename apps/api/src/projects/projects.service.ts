import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isUniqueConstraintError } from '../database/sqlite-error';
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
    if (input.clientId) this.requireClient(input.clientId);
    const inspection = await this.prepareRepository(input);
    const now = new Date().toISOString();
    const projectId = randomUUID();
    const repositoryId = randomUUID();

    try {
      this.database.connection.transaction(() => {
        const clientId = input.clientId
          ? this.requireClient(input.clientId)
          : input.clientName
            ? this.findOrCreateClient(input.clientName, now)
            : null;

        this.database.connection
          .prepare(
            `INSERT INTO projects (
               id, client_id, name, logo_data_url, description, status,
               priority, types_json, technologies_json, start_date, deadline,
               follow_up_date, follow_up_note, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            projectId,
            clientId,
            input.name,
            input.logoDataUrl ?? null,
            input.description ?? null,
            input.status ?? 'active',
            input.priority ?? 'normal',
            JSON.stringify(input.types ?? []),
            JSON.stringify(input.technologies ?? []),
            input.startDate ?? null,
            input.deadline ?? null,
            input.followUpDate ?? null,
            input.followUpNote ?? null,
            now,
            now,
          );

        this.database.connection
          .prepare(
            `INSERT INTO repositories (
               id, project_id, name, local_path, remote_url, provider,
               created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            repositoryId,
            projectId,
            inspection.name,
            inspection.canonicalPath,
            inspection.remoteUrl,
            inspection.provider,
            now,
            now,
          );
      })();
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
      this.assertRepositoryPathAvailable(inspection.canonicalPath);

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
    this.assertRepositoryPathAvailable(resolvedPath);

    return {
      repositoryMode: input.repositoryMode,
      resolvedPath,
      repository: null,
    };
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
    this.assertRepositoryPathAvailable(repositoryPath);

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

  private assertRepositoryPathAvailable(repositoryPath: string): void {
    const existing = this.database.connection
      .prepare('SELECT id FROM repositories WHERE local_path IN (?, ?) LIMIT 1')
      .get(repositoryPath, resolve(repositoryPath)) as
      { id: string } | undefined;
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

  async findAll(): Promise<ProjectView[]> {
    const projects = this.selectProjects();
    return Promise.all(projects.map((project) => this.toProjectView(project)));
  }

  async findOne(
    projectId: string,
    freshInspection?: RepositoryInspection,
  ): Promise<ProjectView> {
    const project = this.selectProject(projectId);

    if (!project) {
      throw new NotFoundException('Projet introuvable.');
    }

    return this.toProjectView(project, freshInspection);
  }

  private findOrCreateClient(name: string, now: string): string {
    const existingClient = this.database.connection
      .prepare('SELECT id, name FROM clients WHERE name = ? COLLATE NOCASE')
      .get(name) as ClientRow | undefined;

    if (existingClient) {
      return existingClient.id;
    }

    const clientId = randomUUID();
    this.database.connection
      .prepare(
        `INSERT INTO clients (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(clientId, name, now, now);

    return clientId;
  }

  private requireClient(clientId: string): string {
    const client = this.database.connection
      .prepare('SELECT id, name FROM clients WHERE id = ?')
      .get(clientId) as ClientRow | undefined;

    if (!client) {
      throw new NotFoundException('Client introuvable.');
    }

    return client.id;
  }

  private selectProjects(): ProjectRow[] {
    return this.database.connection
      .prepare(
        `SELECT
           projects.id,
           projects.name,
           projects.logo_data_url,
           projects.description,
           projects.status,
           projects.priority,
           projects.types_json,
           projects.technologies_json,
           projects.start_date,
           projects.deadline,
           projects.follow_up_date,
           projects.follow_up_note,
           projects.client_id,
           clients.name AS client_name,
           projects.created_at,
           projects.updated_at
         FROM projects
         LEFT JOIN clients ON clients.id = projects.client_id
         ORDER BY projects.updated_at DESC`,
      )
      .all() as ProjectRow[];
  }

  private selectProject(projectId: string): ProjectRow | undefined {
    return this.database.connection
      .prepare(
        `SELECT
           projects.id,
           projects.name,
           projects.logo_data_url,
           projects.description,
           projects.status,
           projects.priority,
           projects.types_json,
           projects.technologies_json,
           projects.start_date,
           projects.deadline,
           projects.follow_up_date,
           projects.follow_up_note,
           projects.client_id,
           clients.name AS client_name,
           projects.created_at,
           projects.updated_at
         FROM projects
         LEFT JOIN clients ON clients.id = projects.client_id
         WHERE projects.id = ?`,
      )
      .get(projectId) as ProjectRow | undefined;
  }

  private selectRepositories(projectId: string): RepositoryRow[] {
    return this.database.connection
      .prepare(
        `SELECT
           id, project_id, name, local_path, remote_url, provider,
           created_at, updated_at
         FROM repositories
         WHERE project_id = ?
         ORDER BY created_at ASC`,
      )
      .all(projectId) as RepositoryRow[];
  }

  private async toProjectView(
    project: ProjectRow,
    freshInspection?: RepositoryInspection,
  ): Promise<ProjectView> {
    const repositories = this.selectRepositories(project.id);
    const repositoryViews = await Promise.all(
      repositories.map(async (repository, index) =>
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
      ? this.syncRepositoryMetadata(repository, inspection)
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

  private syncRepositoryMetadata(
    repository: RepositoryRow,
    inspection: RepositoryInspection,
  ): string {
    if (
      repository.name === inspection.name &&
      repository.remote_url === inspection.remoteUrl &&
      repository.provider === inspection.provider
    ) {
      return repository.updated_at;
    }

    const updatedAt = new Date().toISOString();
    this.database.connection
      .prepare(
        `UPDATE repositories
         SET name = ?, remote_url = ?, provider = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        inspection.name,
        inspection.remoteUrl,
        inspection.provider,
        updatedAt,
        repository.id,
      );

    return updatedAt;
  }
}
