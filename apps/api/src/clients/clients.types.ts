export type ClientKind = 'organization' | 'individual';
export type ClientStatus = 'active' | 'prospect' | 'paused';

export interface ClientContactView {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProjectView {
  id: string;
  name: string;
  repositoriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientView {
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
  contacts: ClientContactView[];
  projects: ClientProjectView[];
  createdAt: string;
  updatedAt: string;
}
