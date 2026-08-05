export type RepositoryProvider = "github" | "gitlab" | "unknown";

export interface GitHead {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string;
}

export interface RepositoryState {
  availability: "available" | "unavailable";
  branch: string | null;
  detached: boolean;
  head: GitHead | null;
  isDirty: boolean;
  changedFilesCount: number;
  error?: string;
}

export interface Repository {
  id: string;
  name: string;
  localPath: string;
  remoteUrl: string | null;
  provider: RepositoryProvider;
  state: RepositoryState;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  logoDataUrl: string | null;
  description: string | null;
  status: "planned" | "active" | "paused" | "completed" | "archived";
  priority: "low" | "normal" | "high" | "critical";
  types: string[];
  technologies: string[];
  startDate: string | null;
  deadline: string | null;
  followUp: { date: string; note: string | null } | null;
  client: { id: string; name: string } | null;
  repositories: Repository[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  logoDataUrl?: string;
  description?: string;
  status?: Project["status"];
  priority?: Project["priority"];
  types?: string[];
  technologies?: string[];
  startDate?: string;
  deadline?: string;
  followUpDate?: string;
  followUpNote?: string;
  clientId?: string;
  clientName?: string;
  repositoryPath: string;
  repositoryMode?: "local" | "existing" | "create";
  provider?: "github" | "gitlab";
  connectionId?: string;
  remoteRepositoryId?: string;
  remoteRepositoryName?: string;
  repositoryVisibility?: "private" | "public";
  initializeReadme?: boolean;
}

export interface ValidateRepositoryPathInput {
  repositoryMode: "local" | "existing" | "create";
  repositoryPath: string;
  cloneDestinationMode?: "exact" | "subfolder";
  cloneDirectoryName?: string;
}

export interface RepositoryPathValidation {
  repositoryMode: ValidateRepositoryPathInput["repositoryMode"];
  resolvedPath: string;
  repository: {
    name: string;
    provider: RepositoryProvider;
    remoteUrl: string | null;
    branch: string | null;
  } | null;
}

export type ClientKind = "organization" | "individual";
export type ClientStatus = "active" | "prospect" | "paused";

export interface ClientContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProject {
  id: string;
  name: string;
  repositoriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  kind: ClientKind;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  logoDataUrl: string | null;
  projectsCount: number;
  repositoriesCount: number;
  contacts: ClientContact[];
  projects: ClientProject[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  name: string;
  kind: ClientKind;
  status: ClientStatus;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  logoDataUrl?: string;
  primaryContact?: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  };
}

export interface UpdateClientInput {
  name?: string;
  kind?: ClientKind;
  status?: ClientStatus;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
  logoDataUrl?: string | null;
  primaryContact?: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  } | null;
}

export interface GitLabConnection {
  id: string;
  provider: "gitlab";
  baseUrl: string;
  account: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  };
  credentialState: "available" | "missing";
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConnection {
  id: string;
  provider: "github";
  baseUrl: string;
  account: {
    id: string;
    username: string;
    name: string;
    avatarUrl: string | null;
  };
  credentialState: "available" | "missing";
  createdAt: string;
  updatedAt: string;
}

export interface RemoteRepository {
  id: string;
  provider: "github" | "gitlab";
  connectionId: string;
  name: string;
  fullName: string;
  description: string | null;
  webUrl: string;
  cloneUrl: string;
  visibility: "private" | "public" | "internal";
  defaultBranch: string | null;
  updatedAt: string;
}

export type PipelineStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "canceled"
  | "skipped"
  | "manual"
  | "unknown";

export interface Pipeline {
  id: string;
  number: number;
  status: PipelineStatus;
  ref: string;
  sha: string;
  shortSha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPipelines {
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab" | "unknown";
  state: "ready" | "connection_required" | "unsupported" | "error";
  message?: string;
  pipelines: Pipeline[];
}

export interface ProjectPipelines {
  projectId: string;
  repositories: RepositoryPipelines[];
}

export interface ConnectGitLabInput {
  baseUrl: string;
  token: string;
}

export interface ConnectGitHubInput {
  token: string;
}

export type ActivityCategory =
  | "clients"
  | "projects"
  | "repositories"
  | "integrations"
  | "security"
  | "system";

export type ActivityStatus = "success" | "error";

export interface ActivityItem {
  id: string;
  requestId: string;
  category: ActivityCategory;
  action: string;
  status: ActivityStatus;
  method: string;
  route: string;
  subject: { type: string; id: string | null } | null;
  summary: string;
  httpStatus: number;
  durationMs: number;
  createdAt: string;
}

export interface ActivityDetail extends ActivityItem {
  request: unknown | null;
  response: unknown | null;
  error: unknown | null;
}

export interface ActivityListResult {
  items: ActivityItem[];
  nextCursor: string | null;
  total: number;
  counts: {
    success: number;
    error: number;
  };
}

export interface ActivityQuery {
  category?: ActivityCategory;
  status?: ActivityStatus;
  search?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3101/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(" ")
      : payload?.message;

    throw new ApiError(
      message ?? "THE BRIDGE n’a pas pu terminer cette opération.",
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listProjects(
  signal?: AbortSignal,
  options?: { silentActivity?: boolean },
): Promise<Project[]> {
  return apiRequest<Project[]>("/projects", {
    signal,
    headers: options?.silentActivity
      ? { "X-Activity-Silent": "true" }
      : undefined,
  });
}

export function getProject(
  projectId: string,
  signal?: AbortSignal,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`, { signal });
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function validateRepositoryPath(
  input: ValidateRepositoryPathInput,
): Promise<RepositoryPathValidation> {
  return apiRequest<RepositoryPathValidation>(
    "/projects/validate-repository-path",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function listClients(signal?: AbortSignal): Promise<Client[]> {
  return apiRequest<Client[]>("/clients", { signal });
}

export function getClient(
  clientId: string,
  signal?: AbortSignal,
): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`, { signal });
}

export function createClient(input: CreateClientInput): Promise<Client> {
  return apiRequest<Client>("/clients", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateClient(
  clientId: string,
  input: UpdateClientInput,
): Promise<Client> {
  return apiRequest<Client>(`/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listGitLabConnections(
  signal?: AbortSignal,
): Promise<GitLabConnection[]> {
  return apiRequest<GitLabConnection[]>("/integrations/gitlab", { signal });
}

export function connectGitLab(
  input: ConnectGitLabInput,
): Promise<GitLabConnection> {
  return apiRequest<GitLabConnection>("/integrations/gitlab", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function disconnectGitLab(connectionId: string): Promise<void> {
  return apiRequest<void>(`/integrations/gitlab/${connectionId}`, {
    method: "DELETE",
  });
}

export function listGitHubConnections(
  signal?: AbortSignal,
): Promise<GitHubConnection[]> {
  return apiRequest<GitHubConnection[]>("/integrations/github", { signal });
}

export function connectGitHub(
  input: ConnectGitHubInput,
): Promise<GitHubConnection> {
  return apiRequest<GitHubConnection>("/integrations/github", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function disconnectGitHub(connectionId: string): Promise<void> {
  return apiRequest<void>(`/integrations/github/${connectionId}`, {
    method: "DELETE",
  });
}

export function listRemoteRepositories(
  provider: "github" | "gitlab",
  connectionId: string,
  signal?: AbortSignal,
): Promise<RemoteRepository[]> {
  return apiRequest<RemoteRepository[]>(
    `/integrations/${provider}/${connectionId}/repositories`,
    { signal },
  );
}

export function getProjectPipelines(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectPipelines> {
  return apiRequest<ProjectPipelines>(`/projects/${projectId}/pipelines`, {
    signal,
  });
}

export function listActivity(
  query: ActivityQuery = {},
  signal?: AbortSignal,
): Promise<ActivityListResult> {
  const parameters = new URLSearchParams();
  if (query.category) parameters.set("category", query.category);
  if (query.status) parameters.set("status", query.status);
  if (query.search) parameters.set("search", query.search);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);
  if (query.cursor) parameters.set("cursor", query.cursor);
  if (query.limit) parameters.set("limit", String(query.limit));
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return apiRequest<ActivityListResult>(`/activity${suffix}`, { signal });
}

export function getActivity(
  activityId: string,
  signal?: AbortSignal,
): Promise<ActivityDetail> {
  return apiRequest<ActivityDetail>(`/activity/${activityId}`, { signal });
}
