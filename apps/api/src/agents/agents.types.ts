export const agentStatuses = ['draft', 'active', 'paused', 'archived'] as const;
export const permissionPolicies = [
  'read_only',
  'supervised',
  'autonomous',
] as const;
export const approvalPolicies = ['always', 'destructive', 'never'] as const;
export const agentTeamStatuses = ['active', 'archived'] as const;

export type AgentStatus = (typeof agentStatuses)[number];
export type PermissionPolicy = (typeof permissionPolicies)[number];
export type ApprovalPolicy = (typeof approvalPolicies)[number];
export type AgentTeamStatus = (typeof agentTeamStatuses)[number];

export interface AgentProjectScope {
  id: string;
  name: string;
}

export interface AgentRepositoryScope {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
}

export interface AgentTeamSummary {
  id: string;
  name: string;
  assignmentId: string;
  role: string;
}

export interface AgentView {
  id: string;
  name: string;
  slug: string;
  avatarDataUrl: string | null;
  role: string;
  description: string | null;
  instructions: string | null;
  status: AgentStatus;
  runtime: {
    provider: string | null;
    model: string | null;
    serviceTier: string | null;
    reasoningLevel: string | null;
  };
  capabilities: string[];
  permissionPolicy: PermissionPolicy;
  approvalPolicy: ApprovalPolicy;
  monthlyBudgetCents: number | null;
  maxConcurrency: number | null;
  projects: AgentProjectScope[];
  repositories: AgentRepositoryScope[];
  teams: AgentTeamSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentAssignmentView {
  id: string;
  parentAssignmentId: string | null;
  role: string;
  sortOrder: number;
  agent: Pick<
    AgentView,
    'id' | 'name' | 'slug' | 'avatarDataUrl' | 'role' | 'status' | 'runtime'
  >;
}

export interface AgentTeamView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: AgentTeamStatus;
  projects: AgentProjectScope[];
  assignments: AgentAssignmentView[];
  createdAt: string;
  updatedAt: string;
}
