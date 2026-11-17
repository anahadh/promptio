/** Data the merge gates work on, already validated (see github.ts). */
export interface ChangedFile {
  path: string;
  /** Old path for renames, else null. */
  previousPath: string | null;
  /** GitHub file status: added, modified, removed, renamed, ... */
  status: string;
}

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
  startedAt: string;
}

export interface PrData {
  labels: string[];
  branch: string;
  files: ChangedFile[];
  additions: number;
  deletions: number;
  checks: CheckRun[];
  /** Tests collected on the base branch. */
  testCount: number;
}

export interface GateResult {
  allowed: boolean;
  reasons: string[];
}
