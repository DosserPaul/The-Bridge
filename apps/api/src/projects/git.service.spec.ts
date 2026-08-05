import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitService } from './git.service';

async function createRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), 'claudehub-git-'));
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
  await writeFile(join(repositoryPath, 'README.md'), '# Test repository\n');
  execFileSync('git', ['-C', repositoryPath, 'add', 'README.md']);
  execFileSync('git', ['-C', repositoryPath, 'commit', '-m', 'Initial commit']);
  return realpath(repositoryPath);
}

describe('GitService', () => {
  const git = new GitService();
  let repositoryPath: string;

  beforeEach(async () => {
    repositoryPath = await createRepository();
  });

  afterEach(async () => {
    await rm(repositoryPath, { recursive: true, force: true });
  });

  it('normalizes a nested path and reads the current repository state', async () => {
    const nestedPath = join(repositoryPath, 'src');
    await mkdir(nestedPath);

    const inspection = await git.inspectRepository(nestedPath);

    expect(inspection.canonicalPath).toBe(repositoryPath);
    expect(inspection.name).toBe(repositoryPath.split('/').at(-1));
    expect(inspection.provider).toBe('unknown');
    expect(inspection.state).toMatchObject({
      availability: 'available',
      branch: 'main',
      detached: false,
      changedFilesCount: 0,
      isDirty: false,
    });
    expect(inspection.state.head).toMatchObject({
      message: 'Initial commit',
    });
  });

  it('reports working-tree changes', async () => {
    await writeFile(join(repositoryPath, 'README.md'), '# Changed\n');

    const inspection = await git.inspectRepository(repositoryPath);

    expect(inspection.state.isDirty).toBe(true);
    expect(inspection.state.changedFilesCount).toBe(1);
  });

  it('returns an unavailable state when a stored repository disappears', async () => {
    await rm(repositoryPath, { recursive: true, force: true });

    const state = await git.observeRepository(repositoryPath);

    expect(state.availability).toBe('unavailable');
    expect(state.error).toContain('Repository inaccessible');
  });

  it('returns the normalized target for a clone destination', async () => {
    const destinationPath = join(repositoryPath, 'new-repository');

    await expect(git.validateCloneDestination(destinationPath)).resolves.toBe(
      destinationPath,
    );
  });
});
