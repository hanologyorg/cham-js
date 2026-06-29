// ─── Validation Types ──────────────────────────────────────────
// Issue severity, issue record, and result shape returned by the
// rule-based validator.

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  file?: string
  line?: number
  message: string
  detail?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}
