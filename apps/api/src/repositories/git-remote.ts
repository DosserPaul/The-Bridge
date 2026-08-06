import type { RepositoryProvider } from '../projects/git.service';

export interface GitRemoteLocation {
  hostname: string;
  projectPath: string;
}

function safeDecodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function parseGitRemote(
  remoteUrl: string | null,
): GitRemoteLocation | null {
  if (!remoteUrl) return null;
  let hostname: string;
  let pathname: string;

  if (!remoteUrl.includes('://')) {
    const scpLocation = remoteUrl.match(/^(?:[^@]+@)?([^:/]+):(.+)$/);
    if (!scpLocation) return null;
    hostname = scpLocation[1];
    pathname = scpLocation[2];
  } else {
    try {
      const url = new URL(remoteUrl);
      hostname = url.hostname;
      pathname = url.pathname;
    } catch {
      return null;
    }
  }

  const projectPath = safeDecodePath(pathname)
    .replace(/^\/+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');

  if (!hostname || !projectPath) return null;
  return { hostname: hostname.toLowerCase(), projectPath };
}

export function detectProviderFromRemote(
  remoteUrl: string | null,
): RepositoryProvider {
  const remote = parseGitRemote(remoteUrl);
  if (!remote) return 'unknown';
  if (remote.hostname === 'github.com') return 'github';
  if (
    remote.hostname === 'gitlab.com' ||
    remote.hostname.startsWith('gitlab.') ||
    remote.hostname.includes('.gitlab.')
  ) {
    return 'gitlab';
  }
  return 'unknown';
}
