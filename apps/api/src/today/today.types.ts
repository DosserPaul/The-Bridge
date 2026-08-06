import type { ActivityListItem } from '../activity/activity.types';

export type TodaySignalKind =
  | 'deadline'
  | 'follow_up'
  | 'repository'
  | 'pipeline'
  | 'pull_request'
  | 'issue'
  | 'priority';

export type TodaySignalSeverity = 'critical' | 'warning' | 'info';
export type TodayFocusPriority = 'critical' | 'high' | 'normal';

export interface TodayProjectSummary {
  id: string;
  name: string;
  logoDataUrl: string | null;
}

export interface TodayRepositorySummary {
  id: string;
  name: string;
}

export interface TodaySignal {
  id: string;
  kind: TodaySignalKind;
  severity: TodaySignalSeverity;
  title: string;
  description: string;
  project: TodayProjectSummary;
  repository: TodayRepositorySummary | null;
  href: string;
  dueAt: string | null;
}

export interface TodayFocusItem {
  id: string;
  sourceKey: string | null;
  project: TodayProjectSummary | null;
  title: string;
  description: string | null;
  href: string | null;
  priority: TodayFocusPriority;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodayDegradedSource {
  projectId: string;
  projectName: string;
  source: 'pipelines' | 'pull_requests' | 'issues';
  message: string;
}

export interface TodayView {
  generatedAt: string;
  summary: {
    activeProjects: number;
    signals: number;
    critical: number;
    dueSoon: number;
    runningPipelines: number;
  };
  signals: TodaySignal[];
  focus: TodayFocusItem[];
  recentActivity: ActivityListItem[];
  degradedSources: TodayDegradedSource[];
}
