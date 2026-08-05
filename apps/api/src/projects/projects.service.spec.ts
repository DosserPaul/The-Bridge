import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { RemoteRepositoriesService } from '../integrations/remote-repositories.service';
import { GitService } from './git.service';
import { ProjectsService } from './projects.service';

async function createRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), 'claudehub-project-'));
  execFileSync('git', ['init', '--initial-branch=main', repositoryPath]);
  execFileSync('git', [
    '-C',
    repositoryPath,
    'config',
    'user.name',
    'ClaudeHub',
  ]);
  execFileSync('git', [
    '-C',
    repositoryPath,
    'config',
    'user.email',
    'claudehub@example.test',
  ]);
  await writeFile(join(repositoryPath, 'README.md'), '# Project\n');
  execFileSync('git', ['-C', repositoryPath, 'add', 'README.md']);
  execFileSync('git', ['-C', repositoryPath, 'commit', '-m', 'Initial commit']);
  return realpath(repositoryPath);
}

describe('ProjectsService', () => {
  let database: DatabaseService;
  let projects: ProjectsService;
  let git: GitService;
  let remoteRepositories: jest.Mocked<
    Pick<
      RemoteRepositoriesService,
      'getWithCredentials' | 'createWithCredentials'
    >
  >;
  let repositoryPath: string;

  beforeEach(async () => {
    database = new DatabaseService(':memory:');
    remoteRepositories = {
      getWithCredentials: jest.fn(),
      createWithCredentials: jest.fn(),
    };
    git = new GitService();
    projects = new ProjectsService(
      database,
      git,
      remoteRepositories as unknown as RemoteRepositoriesService,
    );
    repositoryPath = await createRepository();
  });

  afterEach(async () => {
    database.onModuleDestroy();
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('creates a client project with its initial repository', async () => {
    const project = await projects.create({
      name: 'JurisLive',
      clientName: 'Juris Global',
      repositoryPath,
      description: 'Pilotage juridique augmenté.',
      status: 'active',
      priority: 'high',
      types: ['web', 'ai'],
      technologies: ['Next.js', 'NestJS'],
      startDate: '2026-08-05',
      deadline: '2026-12-15',
      followUpDate: '2026-08-20',
      followUpNote: 'Valider le périmètre de la V1.',
    });

    expect(project.name).toBe('JurisLive');
    expect(project.client?.name).toBe('Juris Global');
    expect(project).toMatchObject({
      description: 'Pilotage juridique augmenté.',
      status: 'active',
      priority: 'high',
      types: ['web', 'ai'],
      technologies: ['Next.js', 'NestJS'],
      startDate: '2026-08-05',
      deadline: '2026-12-15',
      followUp: {
        date: '2026-08-20',
        note: 'Valider le périmètre de la V1.',
      },
    });
    expect(project.repositories).toHaveLength(1);
    expect(project.repositories[0]).toMatchObject({
      localPath: repositoryPath,
      provider: 'unknown',
      state: {
        availability: 'available',
        branch: 'main',
        isDirty: false,
      },
    });

    await expect(projects.findAll()).resolves.toHaveLength(1);
  });

  it('creates a personal project without inventing a client', async () => {
    const project = await projects.create({
      name: 'ClaudeHub',
      repositoryPath,
    });

    expect(project.client).toBeNull();
  });

  it('attaches a project to an existing client', async () => {
    const clientId = randomUUID();
    const now = new Date().toISOString();
    database.connection
      .prepare(
        `INSERT INTO clients (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(clientId, 'Defim', now, now);

    const project = await projects.create({
      name: 'Application mobile',
      clientId,
      repositoryPath,
    });

    expect(project.client).toEqual({ id: clientId, name: 'Defim' });
  });

  it('prevents the same local repository from joining two projects', async () => {
    await projects.create({
      name: 'First project',
      repositoryPath,
    });

    await expect(
      projects.create({
        name: 'Second project',
        repositoryPath,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates and normalizes an existing local repository', async () => {
    await expect(
      projects.validateRepositoryPath({
        repositoryMode: 'local',
        repositoryPath,
      }),
    ).resolves.toMatchObject({
      repositoryMode: 'local',
      resolvedPath: repositoryPath,
      repository: {
        name: repositoryPath.split('/').at(-1),
        branch: 'main',
      },
    });
  });

  it('refreshes repository metadata when origin is added after project creation', async () => {
    const project = await projects.create({
      name: 'The Bridge',
      repositoryPath,
    });

    expect(project.repositories[0]).toMatchObject({
      remoteUrl: null,
      provider: 'unknown',
    });

    execFileSync('git', [
      '-C',
      repositoryPath,
      'remote',
      'add',
      'origin',
      'git@github.com:DosserPaul/The-Bridge.git',
    ]);

    const refreshedProject = await projects.findOne(project.id);

    expect(refreshedProject.repositories[0]).toMatchObject({
      remoteUrl: 'git@github.com:DosserPaul/The-Bridge.git',
      provider: 'github',
    });
    expect(
      database.connection
        .prepare(
          `SELECT remote_url AS remoteUrl, provider
           FROM repositories
           WHERE id = ?`,
        )
        .get(project.repositories[0].id),
    ).toEqual({
      remoteUrl: 'git@github.com:DosserPaul/The-Bridge.git',
      provider: 'github',
    });
  });

  it('validates a clone destination inside a new subfolder', async () => {
    await expect(
      projects.validateRepositoryPath({
        repositoryMode: 'existing',
        repositoryPath,
        cloneDestinationMode: 'subfolder',
        cloneDirectoryName: 'mission-control',
      }),
    ).resolves.toEqual({
      repositoryMode: 'existing',
      resolvedPath: join(repositoryPath, 'mission-control'),
      repository: null,
    });
  });

  it('refuses a clone subfolder that can escape its parent path', async () => {
    await expect(
      projects.validateRepositoryPath({
        repositoryMode: 'existing',
        repositoryPath,
        cloneDestinationMode: 'subfolder',
        cloneDirectoryName: '..',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a remote repository and clones it before persisting the project', async () => {
    const clonedPath = join(tmpdir(), `the-bridge-clone-${randomUUID()}`);
    remoteRepositories.createWithCredentials.mockResolvedValue({
      repository: {
        id: '84',
        provider: 'github',
        connectionId: randomUUID(),
        name: 'mission-control',
        fullName: 'pauldosser/mission-control',
        description: null,
        webUrl: 'https://github.com/pauldosser/mission-control',
        cloneUrl: 'https://github.com/pauldosser/mission-control.git',
        visibility: 'private',
        defaultBranch: 'main',
        updatedAt: '2026-08-05T12:00:00Z',
      },
      credentials: {
        username: 'x-access-token',
        password: 'github_pat_secret',
      },
    });
    jest.spyOn(git, 'validateCloneDestination').mockResolvedValue(clonedPath);
    const cloneRepository = jest
      .spyOn(git, 'cloneRepository')
      .mockResolvedValue({
        canonicalPath: clonedPath,
        name: 'mission-control',
        remoteUrl: 'https://github.com/pauldosser/mission-control.git',
        provider: 'github',
        state: {
          availability: 'available',
          branch: 'main',
          detached: false,
          head: null,
          isDirty: false,
          changedFilesCount: 0,
        },
      });

    const connectionId = randomUUID();
    const project = await projects.create({
      name: 'Mission Control',
      repositoryPath: clonedPath,
      repositoryMode: 'create',
      provider: 'github',
      connectionId,
      remoteRepositoryName: 'mission-control',
      repositoryVisibility: 'private',
      initializeReadme: true,
    });

    expect(remoteRepositories.createWithCredentials).toHaveBeenCalledWith(
      'github',
      connectionId,
      expect.objectContaining({
        name: 'mission-control',
        visibility: 'private',
        initializeReadme: true,
      }),
    );
    expect(cloneRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPath: clonedPath,
        password: 'github_pat_secret',
      }),
    );
    expect(project.repositories[0]).toMatchObject({
      localPath: clonedPath,
      provider: 'github',
    });
  });
});
