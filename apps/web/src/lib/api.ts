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
  connectionId: string | null;
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

export interface UpdateProjectInput {
  name?: string;
  logoDataUrl?: string | null;
  description?: string | null;
  status?: Project["status"];
  priority?: Project["priority"];
  types?: string[];
  technologies?: string[];
  startDate?: string | null;
  deadline?: string | null;
  followUpDate?: string | null;
  followUpNote?: string | null;
  clientId?: string | null;
}

export interface CreateRepositoryInput {
  repositoryPath: string;
  repositoryMode?: "local" | "existing" | "create";
  provider?: "github" | "gitlab";
  connectionId?: string;
  remoteRepositoryId?: string;
  remoteRepositoryName?: string;
  repositoryVisibility?: "private" | "public";
  initializeReadme?: boolean;
  description?: string;
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

export interface Issue {
  id: string;
  number: number;
  title: string;
  state: "open" | "closed";
  author: {
    username: string;
    avatarUrl: string | null;
  };
  assignees: Array<{
    username: string;
    avatarUrl: string | null;
  }>;
  labels: string[];
  commentCount: number;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: string;
  author: {
    username: string;
    avatarUrl: string | null;
  };
  body: string;
  createdAt: string;
  updatedAt: string;
  webUrl: string | null;
}

export interface IssueDetail extends Issue {
  body: string | null;
  comments: IssueComment[];
}

export interface RepositoryIssues {
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab" | "unknown";
  state: "ready" | "connection_required" | "unsupported" | "error";
  message?: string;
  issues: Issue[];
}

export interface ProjectIssues {
  projectId: string;
  repositories: RepositoryIssues[];
}

export interface ProjectIssueDetail {
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab";
  issue: IssueDetail;
}

export type PullRequestState = "open" | "closed" | "merged" | "draft";
export type ChangeStatus =
  "pending" | "running" | "success" | "failed" | "canceled" | "unknown";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description: string | null;
  state: PullRequestState;
  author: { username: string; avatarUrl: string | null };
  reviewers: Array<{ username: string; avatarUrl: string | null }>;
  labels: string[];
  sourceBranch: string;
  targetBranch: string;
  sha: string;
  shortSha: string;
  pipelineStatus: ChangeStatus;
  mergeable: boolean | null;
  hasConflicts: boolean | null;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPullRequests {
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab" | "unknown";
  state: "ready" | "connection_required" | "unsupported" | "error";
  message?: string;
  pullRequests: PullRequest[];
}

export interface ProjectPullRequests {
  projectId: string;
  repositories: RepositoryPullRequests[];
}

export interface ProjectPullRequestDetail {
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab";
  pullRequest: PullRequest;
}

export type DeploymentState =
  "success" | "failed" | "running" | "pending" | "inactive" | "unknown";

export interface ProjectEnvironment {
  id: string;
  name: string;
  state: DeploymentState;
  url: string | null;
  ref: string | null;
  sha: string | null;
  shortSha: string | null;
  deploymentId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RepositoryEnvironments {
  repositoryId: string;
  repositoryName: string;
  provider: "github" | "gitlab" | "unknown";
  state: "ready" | "connection_required" | "unsupported" | "error";
  message?: string;
  environments: ProjectEnvironment[];
}

export interface ProjectEnvironments {
  projectId: string;
  repositories: RepositoryEnvironments[];
}

export type MilestoneStatus = "planned" | "active" | "completed" | "canceled";
export type MilestoneRiskLevel = "low" | "medium" | "high";

export interface LinkedIssue {
  repositoryId: string;
  repositoryName: string;
  number: number;
  title: string;
  webUrl: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  riskLevel: MilestoneRiskLevel;
  blockers: string | null;
  linkedIssues: LinkedIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneInput {
  title: string;
  description?: string | null;
  status?: MilestoneStatus;
  dueDate?: string | null;
  riskLevel?: MilestoneRiskLevel;
  blockers?: string | null;
  linkedIssues?: LinkedIssue[];
}

export type DecisionStatus =
  "proposed" | "accepted" | "rejected" | "superseded";

export interface ProjectDecision {
  id: string;
  projectId: string;
  title: string;
  status: DecisionStatus;
  context: string;
  decision: string;
  rationale: string | null;
  alternatives: string[];
  consequences: string | null;
  participants: string[];
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionInput {
  title: string;
  status?: DecisionStatus;
  context: string;
  decision: string;
  rationale?: string | null;
  alternatives?: string[];
  consequences?: string | null;
  participants?: string[];
  decidedAt: string;
}

export type DocumentKind = "file" | "link";
export type DocumentCategory =
  "readme" | "specification" | "contract" | "technical" | "design" | "other";

export interface ProjectDocument {
  id: string;
  projectId: string;
  repositoryId: string | null;
  repositoryName: string | null;
  kind: DocumentKind;
  category: DocumentCategory;
  title: string;
  location: string;
  description: string | null;
  source: "managed" | "discovered";
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DocumentPreview {
  title: string;
  path: string;
  content: string;
  truncated: boolean;
}

export interface ProjectDocumentInput {
  repositoryId?: string | null;
  kind: DocumentKind;
  category: DocumentCategory;
  title: string;
  location: string;
  description?: string | null;
}

export interface ProjectFinance {
  projectId: string;
  dailyRateCents: number | null;
  budgetCents: number | null;
  currency: string;
  nextInvoiceDate: string | null;
  totalMinutes: number;
  billableMinutes: number;
  billableValueCents: number | null;
  budgetConsumedPercent: number | null;
  remainingBudgetCents: number | null;
  updatedAt: string | null;
}

export interface ProjectTimeEntry {
  id: string;
  projectId: string;
  date: string;
  durationMinutes: number;
  description: string;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCommercial {
  finance: ProjectFinance;
  entries: ProjectTimeEntry[];
}

export type LocalActionName =
  | "editor"
  | "terminal"
  | "finder"
  | "dev"
  | "test"
  | "lint"
  | "build"
  | "coverage"
  | "audit"
  | "outdated";

export type LocalActionStatus =
  "queued" | "running" | "succeeded" | "failed" | "stopped";

export interface LocalActionRun {
  id: string;
  projectId: string;
  repositoryId: string;
  repositoryName: string;
  action: LocalActionName;
  status: LocalActionStatus;
  commandLabel: string;
  output: string;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ProjectTechnicalHealth {
  repositories: Array<{
    repositoryId: string;
    repositoryName: string;
    localPath: string;
    packageManager: string | null;
    dependencyCount: number | null;
    lockfile: string | null;
    lockfileUpdatedAt: string | null;
    coveragePercent: number | null;
    branches: Array<{
      name: "main" | "develop";
      exists: boolean;
      lastCommitAt: string | null;
    }>;
    latestRuns: Partial<Record<LocalActionName, LocalActionRun>>;
  }>;
  latestBackupAt: string | null;
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

export type BackupTable =
  | "clients"
  | "providerConnections"
  | "projects"
  | "repositories"
  | "projectMilestones"
  | "projectDecisions"
  | "projectDocuments"
  | "projectFinances"
  | "projectTimeEntries"
  | "localActionRuns"
  | "clientContacts"
  | "activityLogs";

export interface DataStatus {
  dialect: "sqlite" | "postgres";
  dataDirectory: string;
  counts: Record<BackupTable, number>;
  credentialNote: string;
}

export interface LocalBackup {
  id: string;
  createdAt: string;
  sizeBytes: number;
  sourceDialect: "sqlite" | "postgres";
  counts: Record<BackupTable, number>;
}

export interface RestoreResult {
  restoredAt: string;
  safetyBackup: LocalBackup;
  counts: Record<BackupTable, number>;
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

export function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}/archive`, {
    method: "POST",
  });
}

export function addProjectRepository(
  projectId: string,
  input: CreateRepositoryInput,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}/repositories`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function removeProjectRepository(
  projectId: string,
  repositoryId: string,
): Promise<void> {
  return apiRequest<void>(
    `/projects/${projectId}/repositories/${repositoryId}`,
    { method: "DELETE" },
  );
}

export function associateRepositoryConnection(
  projectId: string,
  repositoryId: string,
  connectionId: string | null,
): Promise<Repository> {
  return apiRequest<Repository>(
    `/projects/${projectId}/repositories/${repositoryId}/connection`,
    {
      method: "PATCH",
      body: JSON.stringify({ connectionId }),
    },
  );
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

export function getProjectIssues(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectIssues> {
  return apiRequest<ProjectIssues>(`/projects/${projectId}/issues`, { signal });
}

export function getProjectIssue(
  projectId: string,
  repositoryId: string,
  issueNumber: number,
  signal?: AbortSignal,
): Promise<ProjectIssueDetail> {
  return apiRequest<ProjectIssueDetail>(
    `/projects/${projectId}/repositories/${repositoryId}/issues/${issueNumber}`,
    { signal },
  );
}

export function getProjectPullRequests(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectPullRequests> {
  return apiRequest<ProjectPullRequests>(
    `/projects/${projectId}/pull-requests`,
    {
      signal,
    },
  );
}

export function getProjectPullRequest(
  projectId: string,
  repositoryId: string,
  pullRequestNumber: number,
  signal?: AbortSignal,
): Promise<ProjectPullRequestDetail> {
  return apiRequest<ProjectPullRequestDetail>(
    `/projects/${projectId}/repositories/${repositoryId}/pull-requests/${pullRequestNumber}`,
    { signal },
  );
}

export function getProjectEnvironments(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectEnvironments> {
  return apiRequest<ProjectEnvironments>(
    `/projects/${projectId}/environments`,
    {
      signal,
    },
  );
}

export function listProjectMilestones(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectMilestone[]> {
  return apiRequest<ProjectMilestone[]>(`/projects/${projectId}/milestones`, {
    signal,
  });
}

export function createProjectMilestone(
  projectId: string,
  input: MilestoneInput,
): Promise<ProjectMilestone> {
  return apiRequest<ProjectMilestone>(`/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  input: Partial<MilestoneInput>,
): Promise<ProjectMilestone> {
  return apiRequest<ProjectMilestone>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteProjectMilestone(
  projectId: string,
  milestoneId: string,
): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/milestones/${milestoneId}`, {
    method: "DELETE",
  });
}

export function listProjectDecisions(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDecision[]> {
  return apiRequest<ProjectDecision[]>(`/projects/${projectId}/decisions`, {
    signal,
  });
}

export function createProjectDecision(
  projectId: string,
  input: DecisionInput,
): Promise<ProjectDecision> {
  return apiRequest<ProjectDecision>(`/projects/${projectId}/decisions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProjectDecision(
  projectId: string,
  decisionId: string,
  input: Partial<DecisionInput>,
): Promise<ProjectDecision> {
  return apiRequest<ProjectDecision>(
    `/projects/${projectId}/decisions/${decisionId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteProjectDecision(
  projectId: string,
  decisionId: string,
): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/decisions/${decisionId}`, {
    method: "DELETE",
  });
}

export function listProjectDocuments(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDocument[]> {
  return apiRequest<ProjectDocument[]>(`/projects/${projectId}/documents`, {
    signal,
  });
}

export function createProjectDocument(
  projectId: string,
  input: ProjectDocumentInput,
): Promise<ProjectDocument> {
  return apiRequest<ProjectDocument>(`/projects/${projectId}/documents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteProjectDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

export function previewProjectDocument(
  projectId: string,
  repositoryId: string,
  path: string,
  signal?: AbortSignal,
): Promise<DocumentPreview> {
  const query = new URLSearchParams({ repositoryId, path });
  return apiRequest<DocumentPreview>(
    `/projects/${projectId}/documents/preview?${query.toString()}`,
    { signal },
  );
}

export function getProjectCommercial(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectCommercial> {
  return apiRequest<ProjectCommercial>(`/projects/${projectId}/commercial`, {
    signal,
  });
}

export function updateProjectFinance(
  projectId: string,
  input: {
    dailyRateCents?: number | null;
    budgetCents?: number | null;
    currency?: string;
    nextInvoiceDate?: string | null;
  },
): Promise<ProjectCommercial> {
  return apiRequest<ProjectCommercial>(
    `/projects/${projectId}/commercial/finance`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function createProjectTimeEntry(
  projectId: string,
  input: {
    date: string;
    durationMinutes: number;
    description: string;
    billable?: boolean;
  },
): Promise<ProjectCommercial> {
  return apiRequest<ProjectCommercial>(
    `/projects/${projectId}/commercial/time-entries`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function deleteProjectTimeEntry(
  projectId: string,
  entryId: string,
): Promise<void> {
  return apiRequest<void>(
    `/projects/${projectId}/commercial/time-entries/${entryId}`,
    { method: "DELETE" },
  );
}

export function listLocalActionRuns(
  projectId: string,
  signal?: AbortSignal,
): Promise<LocalActionRun[]> {
  return apiRequest<LocalActionRun[]>(`/projects/${projectId}/local-actions`, {
    signal,
  });
}

export function launchLocalAction(
  projectId: string,
  repositoryId: string,
  action: LocalActionName,
): Promise<LocalActionRun> {
  return apiRequest<LocalActionRun>(
    `/projects/${projectId}/repositories/${repositoryId}/local-actions/${action}`,
    { method: "POST" },
  );
}

export function stopLocalAction(
  projectId: string,
  runId: string,
): Promise<LocalActionRun> {
  return apiRequest<LocalActionRun>(
    `/projects/${projectId}/local-actions/${runId}/stop`,
    { method: "POST" },
  );
}

export function getProjectTechnicalHealth(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectTechnicalHealth> {
  return apiRequest<ProjectTechnicalHealth>(`/projects/${projectId}/health`, {
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

export function getDataStatus(signal?: AbortSignal): Promise<DataStatus> {
  return apiRequest<DataStatus>("/data/status", { signal });
}

export function listLocalBackups(signal?: AbortSignal): Promise<LocalBackup[]> {
  return apiRequest<LocalBackup[]>("/data/backups", { signal });
}

export function createLocalBackup(): Promise<LocalBackup> {
  return apiRequest<LocalBackup>("/data/backups", { method: "POST" });
}

export function restoreDataBackup(document: unknown): Promise<RestoreResult> {
  return apiRequest<RestoreResult>("/data/restore", {
    method: "POST",
    body: JSON.stringify(document),
  });
}

export function restoreLocalBackup(backupId: string): Promise<RestoreResult> {
  return apiRequest<RestoreResult>(`/data/backups/${backupId}/restore`, {
    method: "POST",
  });
}

export async function downloadDataExport(): Promise<Blob> {
  const response = await fetch(`${apiUrl}/data/export`);
  if (!response.ok) {
    throw new ApiError(
      "THE BRIDGE n’a pas pu exporter les données.",
      response.status,
    );
  }
  return response.blob();
}
