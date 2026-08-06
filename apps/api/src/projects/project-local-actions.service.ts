import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  RepositoryCatalogService,
  type RepositoryRecord,
} from '../repositories/repository-catalog.service';
import { parseGitRemote } from '../repositories/git-remote';
import {
  localActionNames,
  type LocalActionName,
  type LocalActionRun,
  type LocalActionStatus,
} from './project-operations.types';

const maximumOutputLength = 100_000;

interface ActionRunRow {
  id: string;
  project_id: string;
  repository_id: string;
  repository_name: string;
  action: LocalActionName;
  status: LocalActionStatus;
  command_label: string;
  output: string;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface CommandDefinition {
  executable: string;
  arguments: string[];
  label: string;
}

@Injectable()
export class ProjectLocalActionsService implements OnModuleInit {
  private readonly processes = new Map<
    string,
    ChildProcessWithoutNullStreams
  >();

  constructor(
    private readonly database: DatabaseService,
    private readonly repositories: RepositoryCatalogService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.database
      .connection('local_action_runs')
      .whereIn('status', ['queued', 'running'])
      .update({
        status: 'stopped',
        finished_at: new Date().toISOString(),
        output: 'Interrompu par le redémarrage de The Bridge.',
      });
  }

  async list(projectId: string): Promise<LocalActionRun[]> {
    await this.requireProject(projectId);
    const rows = (await this.database
      .connection<ActionRunRow>('local_action_runs as runs')
      .join('repositories', 'repositories.id', 'runs.repository_id')
      .select('runs.*', 'repositories.name as repository_name')
      .where('runs.project_id', projectId)
      .orderBy('runs.created_at', 'desc')
      .limit(50)) as ActionRunRow[];
    return rows.map((row) => this.toRun(row));
  }

  async launch(
    projectId: string,
    repositoryId: string,
    action: string,
  ): Promise<LocalActionRun> {
    if (!localActionNames.includes(action as LocalActionName)) {
      throw new BadRequestException('Cette action locale n’est pas autorisée.');
    }
    const repository = await this.repositories.getRecord(
      projectId,
      repositoryId,
    );
    const definition = await this.resolveCommand(
      repository,
      action as LocalActionName,
    );
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.connection('local_action_runs').insert({
      id,
      project_id: projectId,
      repository_id: repositoryId,
      action,
      status: 'queued',
      command_label: definition.label,
      output: '',
      exit_code: null,
      started_at: null,
      finished_at: null,
      created_at: now,
    });

    void this.execute(id, repository, definition);
    return this.find(projectId, id);
  }

  async stop(projectId: string, runId: string): Promise<LocalActionRun> {
    const run = await this.find(projectId, runId);
    if (!['queued', 'running'].includes(run.status)) return run;
    const child = this.processes.get(runId);
    if (child) {
      try {
        if (process.platform !== 'win32' && child.pid) {
          process.kill(-child.pid, 'SIGTERM');
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        child.kill('SIGTERM');
      }
    }
    await this.database
      .connection('local_action_runs')
      .where({ id: runId })
      .update({
        status: 'stopped',
        finished_at: new Date().toISOString(),
      });
    return this.find(projectId, runId);
  }

  private async execute(
    runId: string,
    repository: RepositoryRecord,
    definition: CommandDefinition,
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    await this.database
      .connection('local_action_runs')
      .where({ id: runId })
      .update({
        status: 'running',
        started_at: startedAt,
      });

    const child = spawn(definition.executable, definition.arguments, {
      cwd: repository.local_path,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      shell: false,
      detached: process.platform !== 'win32',
    });
    this.processes.set(runId, child);
    let output = '';
    const append = (chunk: Buffer) => {
      output = `${output}${chunk.toString('utf8')}`.slice(-maximumOutputLength);
      void this.database
        .connection('local_action_runs')
        .where({ id: runId })
        .update({ output });
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => {
      output = `${output}\n${error.message}`.slice(-maximumOutputLength);
    });
    child.on('close', (exitCode) => {
      this.processes.delete(runId);
      void this.finish(runId, exitCode, output);
    });
  }

  private async finish(runId: string, exitCode: number | null, output: string) {
    const current = await this.database
      .connection<{ id: string; status: LocalActionStatus }>(
        'local_action_runs',
      )
      .select('status')
      .where({ id: runId })
      .first();
    if (!current || current.status === 'stopped') return;
    await this.database
      .connection('local_action_runs')
      .where({ id: runId })
      .update({
        status: exitCode === 0 ? 'succeeded' : 'failed',
        exit_code: exitCode,
        output,
        finished_at: new Date().toISOString(),
      });
  }

  private async resolveCommand(
    repository: RepositoryRecord,
    action: LocalActionName,
  ): Promise<CommandDefinition> {
    if (action === 'finder')
      return this.guiCommand('finder', repository.local_path);
    if (action === 'editor')
      return this.guiCommand('editor', repository.local_path);
    if (action === 'terminal')
      return this.guiCommand('terminal', repository.local_path);
    if (action === 'remote') return this.remoteCommand(repository.remote_url);

    const packageManager = await this.detectPackageManager(
      repository.local_path,
    );
    if (!packageManager) {
      throw new BadRequestException(
        'Aucun gestionnaire de paquets JavaScript détecté.',
      );
    }
    if (action === 'audit' || action === 'outdated') {
      const argumentsByManager: Record<string, string[]> = {
        pnpm: [action, '--color=false'],
        npm: [action, '--color=false'],
        yarn: [action, '--no-colors'],
        bun: [`${action}`],
      };
      return {
        executable: packageManager,
        arguments: argumentsByManager[packageManager],
        label: `${packageManager} ${action}`,
      };
    }

    const packageJson = await this.readPackageJson(repository.local_path);
    const script = action === 'coverage' ? 'test:cov' : action;
    if (!packageJson.scripts?.[script]) {
      throw new BadRequestException(
        `Le script « ${script} » n’existe pas dans package.json.`,
      );
    }
    const arguments_ =
      packageManager === 'npm' ? ['run', script] : ['run', script];
    return {
      executable: packageManager,
      arguments: arguments_,
      label: `${packageManager} run ${script}`,
    };
  }

  private guiCommand(
    action: 'finder' | 'editor' | 'terminal',
    path: string,
  ): CommandDefinition {
    if (process.platform === 'darwin') {
      if (action === 'finder')
        return {
          executable: 'open',
          arguments: [path],
          label: 'Ouvrir dans Finder',
        };
      if (action === 'editor')
        return {
          executable: 'open',
          arguments: ['-a', 'Visual Studio Code', path],
          label: 'Ouvrir dans VS Code',
        };
      return {
        executable: 'open',
        arguments: ['-a', 'Terminal', path],
        label: 'Ouvrir dans Terminal',
      };
    }
    if (process.platform === 'win32') {
      if (action === 'finder')
        return {
          executable: 'explorer.exe',
          arguments: [path],
          label: 'Ouvrir dans Explorer',
        };
      if (action === 'editor')
        return {
          executable: 'code.cmd',
          arguments: [path],
          label: 'Ouvrir dans VS Code',
        };
      return {
        executable: 'wt.exe',
        arguments: ['-d', path],
        label: 'Ouvrir dans Terminal',
      };
    }
    if (action === 'finder')
      return {
        executable: 'xdg-open',
        arguments: [path],
        label: 'Ouvrir dans le gestionnaire de fichiers',
      };
    if (action === 'editor')
      return {
        executable: 'code',
        arguments: [path],
        label: 'Ouvrir dans VS Code',
      };
    return {
      executable: 'x-terminal-emulator',
      arguments: ['--working-directory', path],
      label: 'Ouvrir dans Terminal',
    };
  }

  private remoteCommand(remoteUrl: string | null): CommandDefinition {
    const remote = parseGitRemote(remoteUrl);
    if (!remote) {
      throw new BadRequestException(
        'Aucun repository distant valide n’est configuré.',
      );
    }

    const webUrl = new URL(`https://${remote.hostname}`);
    webUrl.pathname = remote.projectPath;
    const target = webUrl.toString();

    if (process.platform === 'darwin') {
      return {
        executable: 'open',
        arguments: [target],
        label: 'Ouvrir le repository distant',
      };
    }
    if (process.platform === 'win32') {
      return {
        executable: 'explorer.exe',
        arguments: [target],
        label: 'Ouvrir le repository distant',
      };
    }
    return {
      executable: 'xdg-open',
      arguments: [target],
      label: 'Ouvrir le repository distant',
    };
  }

  private async detectPackageManager(path: string): Promise<string | null> {
    const candidates = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ] as const;
    for (const [file, manager] of candidates) {
      try {
        await access(resolve(path, file));
        return manager;
      } catch {
        // Try the next supported lockfile.
      }
    }
    return null;
  }

  private async readPackageJson(
    path: string,
  ): Promise<{ scripts?: Record<string, string> }> {
    try {
      return JSON.parse(
        await readFile(resolve(path, 'package.json'), 'utf8'),
      ) as {
        scripts?: Record<string, string>;
      };
    } catch {
      throw new BadRequestException(
        'package.json est introuvable ou invalide.',
      );
    }
  }

  private async find(
    projectId: string,
    runId: string,
  ): Promise<LocalActionRun> {
    const row = (await this.database
      .connection<ActionRunRow>('local_action_runs as runs')
      .join('repositories', 'repositories.id', 'runs.repository_id')
      .select('runs.*', 'repositories.name as repository_name')
      .where({ 'runs.id': runId, 'runs.project_id': projectId })
      .first()) as ActionRunRow | undefined;
    if (!row) throw new NotFoundException('Exécution locale introuvable.');
    return this.toRun(row);
  }

  private toRun(row: ActionRunRow): LocalActionRun {
    return {
      id: row.id,
      projectId: row.project_id,
      repositoryId: row.repository_id,
      repositoryName: row.repository_name,
      action: row.action,
      status: row.status,
      commandLabel: row.command_label,
      output: row.output,
      exitCode: row.exit_code,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
    };
  }

  private async requireProject(projectId: string) {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .select('id')
      .where({ id: projectId })
      .first();
    if (!project) throw new NotFoundException('Projet introuvable.');
  }
}
