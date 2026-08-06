export const activityCategories = [
  'clients',
  'today',
  'projects',
  'repositories',
  'agents',
  'integrations',
  'security',
  'system',
] as const;

export type ActivityCategory = (typeof activityCategories)[number];
export type ActivityStatus = 'success' | 'error';

export interface ActivitySubject {
  type: string;
  id: string | null;
}

export interface ActivityListItem {
  id: string;
  requestId: string;
  category: ActivityCategory;
  action: string;
  status: ActivityStatus;
  method: string;
  route: string;
  subject: ActivitySubject | null;
  summary: string;
  httpStatus: number;
  durationMs: number;
  createdAt: string;
}

export interface ActivityDetail extends ActivityListItem {
  request: unknown;
  response: unknown;
  error: unknown;
}

export interface ActivityListResult {
  items: ActivityListItem[];
  nextCursor: string | null;
  total: number;
  counts: {
    success: number;
    error: number;
  };
}

export interface ActivityRecordInput {
  requestId: string;
  category: ActivityCategory;
  action: string;
  status: ActivityStatus;
  method: string;
  route: string;
  subjectType?: string;
  subjectId?: string | null;
  subjectLabel?: string | null;
  request?: unknown;
  response?: unknown;
  error?: unknown;
  httpStatus: number;
  durationMs: number;
}

export interface ActivityQuery {
  category?: ActivityCategory;
  status?: ActivityStatus;
  search?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit: number;
}
