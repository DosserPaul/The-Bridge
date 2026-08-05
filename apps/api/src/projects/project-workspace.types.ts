export type DocumentKind = 'file' | 'link';
export type DocumentCategory =
  'readme' | 'specification' | 'contract' | 'technical' | 'design' | 'other';

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
  source: 'managed' | 'discovered';
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DocumentPreview {
  title: string;
  path: string;
  content: string;
  truncated: boolean;
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

export interface ProjectCommercialView {
  finance: ProjectFinance;
  entries: ProjectTimeEntry[];
}
