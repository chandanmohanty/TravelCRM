/**
 * Lead Import — shared DTOs and field catalog.
 *
 * Mirrors the backend contracts exposed by `LeadImportController`
 * (`/api/crm/leads/import/excel/{parse|preview|commit}`). Property names
 * are camelCase to match the default System.Text.Json policy.
 */

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
}

export interface ParseResult {
  stagingId: string;
  headers: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}

export interface PreviewResult {
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  sampleErrors: LeadImportRowOutcome[];
}

export interface LeadImportRowOutcome {
  rowNumber: number;
  key: string;
  status: 'Created' | 'Updated' | 'Skipped' | 'Failed';
  reason: string | null;
}

export interface LeadImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: LeadImportRowOutcome[];
}

// ── Google Sheets — OAuth status + Sheets metadata (Task 14) ──────────────

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  grantedScopes: string;
}

export interface SheetTab {
  title: string;
}

export interface SheetHeaders {
  headers: string[];
  previewRows: Record<string, string>[];
}

// ── Lead Sources — recurring Google Sheets sync (Task 14) ─────────────────

export type LeadSourceSyncCadence = 'Manual' | 'Every15Min' | 'Hourly' | 'Daily';
export type LeadSourceStatus = 'Active' | 'Paused' | 'Error' | 'Disconnected';

export interface LeadSource {
  id: string;
  displayName: string;
  spreadsheetId: string;
  sheetName: string;
  columnMapping: Record<string, string>;
  matchKeyField: string;
  syncCadence: LeadSourceSyncCadence;
  status: LeadSourceStatus;
  lastPolledAt: string | null;
  lastSuccessAt: string | null;
  lastResultJson: string | null;
  lastError: string | null;
  rowVersion: string;
}

export interface CreateLeadSourceRequest {
  displayName: string;
  spreadsheetId: string;
  sheetName: string;
  columnMapping: Record<string, string>;
  matchKeyField: string;
  syncCadence: LeadSourceSyncCadence;
}

export interface UpdateLeadSourceRequest {
  rowVersion: string;
  displayName: string;
  sheetName: string;
  columnMapping: Record<string, string>;
  matchKeyField: string;
  syncCadence: LeadSourceSyncCadence;
}

/** Canonical lead fields that can be mapped from imported file headers. */
export const LEAD_IMPORT_FIELDS: ImportField[] = [
  { key: 'email',           label: 'Email',           required: true  },
  { key: 'firstName',       label: 'First Name',      required: false },
  { key: 'lastName',        label: 'Last Name',       required: false },
  { key: 'phone',           label: 'Phone',           required: false },
  { key: 'company',         label: 'Company',         required: false },
  { key: 'jobTitle',        label: 'Job Title',       required: false },
  { key: 'assignedTo',      label: 'Assigned To',     required: false },
  { key: 'status',          label: 'Status',          required: false },
  { key: 'source',          label: 'Source',          required: false },
  { key: 'score',           label: 'Score',           required: false },
  { key: 'estimatedValue',  label: 'Estimated Value', required: false },
  { key: 'tags',            label: 'Tags',            required: false },
  { key: 'notes',           label: 'Notes',           required: false },
];
