import { execFile } from 'node:child_process';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { RepositoryRecord } from '../repositories/repository-catalog.service';
import type {
  BranchHealth,
  LocalActionName,
  LocalActionRun,
  LocalActionStatus,
  ProjectHealth,
  RepositoryHealth,
} from './project-operations.types';

const execFileAsync = promisify(execFile);

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

@Injectable()
export class ProjectHealthService {
  constructor(private readonly database: DatabaseService) {}

  async get(projectId: string): Promise<ProjectHealth> {
    const project = await this.database
      .connection<{ id: string }>('projects')
      .select('id')
      .where({ id: projectId })
      .first();
    if (!project) throw new NotFoundException('Projet introuvable.');

    const [repositories, latestBackup] = await Promise.all([
      this.database
        .connection<RepositoryRecord>('repositories')
        .select('*')
        .where({ project_id: projectId })
        .orderBy('created_at', 'asc'),
      this.database
        .connection<{
          action: string;
          status: string;
          created_at: string;
        }>('activity_logs')
        .select('created_at')
        .where({ action: 'data.backup_created', status: 'success' })
        .orderBy('created_at', 'desc')
        .first(),
    ]);

    return {
      repositories: await Promise.all(
        repositories.map((repository) => this.inspectRepository(repository)),
      ),
      latestBackupAt: latestBackup?.created_at ?? null,
    };
  }

  private async inspectRepository(
    repository: RepositoryRecord,
  ): Promise<RepositoryHealth> {
    const [dependencyCount, manager, branches, coverage, runs] =
      await Promise.all([
        this.readDependencyCount(repository.local_path),
        this.detectPackageManager(repository.local_path),
        Promise.all([
          this.inspectBranch(repository.local_path, 'main'),
          this.inspectBranch(repository.local_path, 'develop'),
        ]),
        this.readCoverage(repository.local_path),
        this.latestRuns(repository.project_id, repository.id),
      ]);
    return {
      repositoryId: repository.id,
      repositoryName: repository.name,
      localPath: repository.local_path,
      packageManager: manager?.name ?? null,
      dependencyCount,
      lockfile: manager?.lockfile ?? null,
      lockfileUpdatedAt: manager?.updatedAt ?? null,
      coveragePercent: coverage,
      branches,
      latestRuns: runs,
    };
  }

  private async inspectBranch(
    path: string,
    name: 'main' | 'develop',
  ): Promise<BranchHealth> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', path, 'log', '-1', '--format=%cI', name],
        { timeout: 5_000 },
      );
      return { name, exists: true, lastCommitAt: stdout.trim() || null };
    } catch {
      return { name, exists: false, lastCommitAt: null };
    }
  }

  private async readManifest(path: string): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null> {
    try {
      return JSON.parse(
        await readFile(resolve(path, 'package.json'), 'utf8'),
      ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
    } catch {
      return null;
    }
  }

  private async readDependencyCount(path: string): Promise<number | null> {
    const manifests = [await this.readManifest(path)];
    for (const workspaceDirectory of ['apps', 'packages']) {
      try {
        const entries = await readdir(resolve(path, workspaceDirectory), {
          withFileTypes: true,
        });
        const nested = await Promise.all(
          entries
            .filter((entry) => entry.isDirectory())
            .map((entry) =>
              this.readManifest(resolve(path, workspaceDirectory, entry.name)),
            ),
        );
        manifests.push(...nested);
      } catch {
        // The conventional workspace directory is optional.
      }
    }
    const existing = manifests.filter((manifest) => manifest !== null);
    if (!existing.length) return null;
    const dependencies = new Set<string>();
    for (const manifest of existing) {
      for (const name of Object.keys(manifest.dependencies ?? {}))
        dependencies.add(name);
      for (const name of Object.keys(manifest.devDependencies ?? {}))
        dependencies.add(name);
    }
    return dependencies.size;
  }

  private async detectPackageManager(path: string): Promise<{
    name: string;
    lockfile: string;
    updatedAt: string;
  } | null> {
    const candidates = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['bun.lockb', 'bun'],
      ['bun.lock', 'bun'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm'],
    ] as const;
    for (const [lockfile, name] of candidates) {
      try {
        await access(resolve(path, lockfile));
        const details = await stat(resolve(path, lockfile));
        return { name, lockfile, updatedAt: details.mtime.toISOString() };
      } catch {
        // Try the next supported lockfile.
      }
    }
    return null;
  }

  private async readCoverage(path: string): Promise<number | null> {
    const candidates = [
      resolve(path, 'coverage', 'coverage-summary.json'),
      resolve(path, 'apps', 'api', 'coverage', 'coverage-summary.json'),
      resolve(path, 'apps', 'web', 'coverage', 'coverage-summary.json'),
    ];
    for (const candidate of candidates) {
      try {
        const report = JSON.parse(
          await readFile(candidate, 'utf8'),
        ) as unknown as {
          total?: { lines?: { pct?: number } };
        };
        if (typeof report.total?.lines?.pct === 'number') {
          return report.total.lines.pct;
        }
      } catch {
        // Coverage is optional; try the next conventional location.
      }
    }
    return null;
  }

  private async latestRuns(
    projectId: string,
    repositoryId: string,
  ): Promise<Partial<Record<LocalActionName, LocalActionRun>>> {
    const rows = await this.database
      .connection<ActionRunRow>('local_action_runs as runs')
      .join('repositories', 'repositories.id', 'runs.repository_id')
      .select('runs.*', 'repositories.name as repository_name')
      .where({
        'runs.project_id': projectId,
        'runs.repository_id': repositoryId,
      })
      .orderBy('runs.created_at', 'desc');
    const runs: Partial<Record<LocalActionName, LocalActionRun>> = {};
    for (const row of rows as ActionRunRow[]) {
      if (runs[row.action]) continue;
      runs[row.action] = {
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
    return runs;
  }
}
