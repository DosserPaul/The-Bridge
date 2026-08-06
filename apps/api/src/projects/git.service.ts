import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  lstat,
  mkdtemp,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { promisify } from 'node:util';
import { BadRequestException, Injectable } from '@nestjs/common';
import { detectProviderFromRemote } from '../repositories/git-remote';

const execFileAsync = promisify(execFile);

export type RepositoryProvider = 'github' | 'gitlab' | 'unknown';

export interface GitHead {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string;
}

export interface RepositoryState {
  availability: 'available' | 'unavailable';
  branch: string | null;
  detached: boolean;
  head: GitHead | null;
  isDirty: boolean;
  changedFilesCount: number;
  error?: string;
}

export interface RepositoryInspection {
  canonicalPath: string;
  name: string;
  remoteUrl: string | null;
  provider: RepositoryProvider;
  state: RepositoryState;
}

export interface CloneRepositoryInput {
  cloneUrl: string;
  targetPath: string;
  username: string;
  password: string;
}

const askPassScript = `#!/usr/bin/env node
const prompt = process.argv.slice(2).join(' ').toLowerCase();
const value = prompt.includes('username')
  ? process.env.THE_BRIDGE_GIT_USERNAME
  : process.env.THE_BRIDGE_GIT_PASSWORD;
process.stdout.write(value ?? '');
`;

function getErrorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as { code?: unknown }).code;
}

@Injectable()
export class GitService {
  async cloneRepository(
    input: CloneRepositoryInput,
  ): Promise<RepositoryInspection> {
    const cloneUrl = this.requireHttpsCloneUrl(input.cloneUrl);
    const destination = await this.prepareCloneDestination(input.targetPath);
    const helperDirectory = await mkdtemp(
      join(tmpdir(), 'the-bridge-git-askpass-'),
    );
    const helperPath = join(helperDirectory, 'askpass.mjs');

    try {
      await writeFile(helperPath, askPassScript, { mode: 0o700 });
      await execFileAsync('git', ['clone', '--', cloneUrl, destination.path], {
        env: {
          ...process.env,
          GIT_ASKPASS: helperPath,
          GIT_TERMINAL_PROMPT: '0',
          THE_BRIDGE_GIT_USERNAME: input.username,
          THE_BRIDGE_GIT_PASSWORD: input.password,
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      });
    } catch {
      if (!destination.existed) {
        await rm(destination.path, { recursive: true, force: true });
      }
      throw new BadRequestException(
        'Le repository distant a été trouvé, mais son clone local a échoué. Vérifiez le token et le chemin de destination.',
      );
    } finally {
      await rm(helperDirectory, { recursive: true, force: true });
    }

    return this.inspectRepository(destination.path);
  }

  async validateCloneDestination(inputPath: string): Promise<string> {
    return (await this.prepareCloneDestination(inputPath)).path;
  }

  async inspectRepository(inputPath: string): Promise<RepositoryInspection> {
    let resolvedPath: string;

    try {
      resolvedPath = await realpath(inputPath);
      const pathStats = await stat(resolvedPath);

      if (!pathStats.isDirectory()) {
        throw new Error('Le chemin ne pointe pas vers un dossier.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Chemin invalide.';
      throw new BadRequestException(`Repository inaccessible : ${message}`);
    }

    const repositoryRoot = await this.runGit(resolvedPath, [
      'rev-parse',
      '--show-toplevel',
    ]);

    if (!repositoryRoot) {
      throw new BadRequestException(
        'Le chemin ne se trouve pas dans un repository Git.',
      );
    }

    const canonicalPath = await realpath(repositoryRoot);
    const [branch, remoteUrl, logOutput, statusOutput] = await Promise.all([
      this.runGit(canonicalPath, ['branch', '--show-current'], true),
      this.runGit(canonicalPath, ['remote', 'get-url', 'origin'], true),
      this.runGit(
        canonicalPath,
        ['log', '-1', '--format=%H%n%h%n%s%n%cI'],
        true,
      ),
      this.runGit(canonicalPath, ['status', '--porcelain=v1']),
    ]);

    const head = this.parseHead(logOutput);
    const changedFilesCount = statusOutput
      ? statusOutput.split('\n').filter(Boolean).length
      : 0;

    return {
      canonicalPath,
      name: basename(canonicalPath),
      remoteUrl,
      provider: detectProviderFromRemote(remoteUrl),
      state: {
        availability: 'available',
        branch,
        detached: !branch && head !== null,
        head,
        isDirty: changedFilesCount > 0,
        changedFilesCount,
      },
    };
  }

  private requireHttpsCloneUrl(input: string): string {
    try {
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('invalid');
      }
      return url.toString();
    } catch {
      throw new BadRequestException(
        'Le provider a renvoyé une URL de clone HTTPS invalide.',
      );
    }
  }

  private async prepareCloneDestination(
    inputPath: string,
  ): Promise<{ path: string; existed: boolean }> {
    const requestedPath = resolve(inputPath);
    if (requestedPath === parse(requestedPath).root) {
      throw new BadRequestException(
        'La racine du disque ne peut pas être utilisée comme destination.',
      );
    }

    try {
      const pathStats = await lstat(requestedPath);
      if (!pathStats.isDirectory()) {
        throw new BadRequestException(
          'La destination existe mais ne correspond pas à un dossier.',
        );
      }
      if ((await readdir(requestedPath)).length > 0) {
        throw new BadRequestException(
          'Le dossier de destination doit être vide pour cloner un repository.',
        );
      }
      await access(requestedPath, constants.W_OK);
      return { path: await realpath(requestedPath), existed: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        getErrorCode(error) !== 'ENOENT'
      ) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(
          'La destination locale n’est pas accessible en écriture.',
        );
      }
    }

    try {
      const parentPath = await realpath(dirname(requestedPath));
      const parentStats = await stat(parentPath);
      if (!parentStats.isDirectory()) throw new Error('not-directory');
      await access(parentPath, constants.W_OK);
      return {
        path: join(parentPath, basename(requestedPath)),
        existed: false,
      };
    } catch {
      throw new BadRequestException(
        'Le dossier parent de la destination doit exister et être accessible en écriture.',
      );
    }
  }

  async observeRepository(inputPath: string): Promise<RepositoryState> {
    try {
      return (await this.inspectRepository(inputPath)).state;
    } catch (error) {
      return {
        availability: 'unavailable',
        branch: null,
        detached: false,
        head: null,
        isDirty: false,
        changedFilesCount: 0,
        error:
          error instanceof Error
            ? error.message
            : 'Le repository est indisponible.',
      };
    }
  }

  private parseHead(logOutput: string | null): GitHead | null {
    if (!logOutput) {
      return null;
    }

    const [sha, shortSha, message, committedAt] = logOutput.split('\n');

    if (!sha || !shortSha || !message || !committedAt) {
      return null;
    }

    return { sha, shortSha, message, committedAt };
  }

  private async runGit(
    repositoryPath: string,
    args: string[],
    allowFailure = false,
  ): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', repositoryPath, ...args],
        { maxBuffer: 10 * 1024 * 1024 },
      );

      const output = stdout.trim();
      return output || null;
    } catch {
      if (allowFailure) {
        return null;
      }

      throw new BadRequestException(
        'Impossible de lire les informations du repository Git.',
      );
    }
  }
}
