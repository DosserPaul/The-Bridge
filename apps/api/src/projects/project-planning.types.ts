export type MilestoneStatus = 'planned' | 'active' | 'completed' | 'canceled';
export type MilestoneRiskLevel = 'low' | 'medium' | 'high';

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

export type DecisionStatus =
  'proposed' | 'accepted' | 'rejected' | 'superseded';

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
