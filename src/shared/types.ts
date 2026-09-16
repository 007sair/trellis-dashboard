export type JsonObject = Record<string, unknown>;
export type DocumentGroup = 'task' | 'spec' | 'workspace';

export interface Diagnostic {
  path: string;
  code: string;
  message: string;
}

export interface DocumentEntry {
  path: string;
  name: string;
  group: DocumentGroup;
  size: number;
  modifiedAt: string;
  readable: boolean;
  problem?: string;
}

export interface PlanProgress {
  done: number;
  total: number;
  source: string;
}

export interface Task {
  key: string;
  id: string;
  name: string;
  title: string;
  titleSource: 'title' | 'name' | 'id' | 'directory';
  description: string;
  status: string | null;
  priority: string | null;
  assignee: string | null;
  creator: string | null;
  createdAt: string | null;
  completedAt: string | null;
  modifiedAt: string;
  archived: boolean;
  metadata: JsonObject;
  files: DocumentEntry[];
  progress: PlanProgress | null;
}

export interface Snapshot {
  project: { name: string; root: string; version: string | null };
  readOnly: true;
  generatedAt: string;
  tasks: Task[];
  specs: DocumentEntry[];
  workspace: DocumentEntry[];
  diagnostics: Diagnostic[];
}

export interface DocumentContent {
  path: string;
  kind: 'markdown' | 'json' | 'jsonl' | 'text';
  content: string;
  size: number;
  modifiedAt: string;
}

export interface ApiFailure {
  error: { code: string; message: string };
}
