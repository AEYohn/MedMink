export interface ComplianceFlag {
  severity: 'error' | 'warning' | 'info';
  domain: 'claim_denial' | 'malpractice';
  section: 'subjective' | 'objective' | 'assessment' | 'plan';
  field: string;
  rule_id: string;
  message: string;
  auto_fixable: boolean;
  suggested_fix: string;
  reference: string;
}

export interface ComplianceScanResult {
  score: number;
  grade: string;
  flags: ComplianceFlag[];
  claim_denial_score: number;
  malpractice_score: number;
  rules_checked: number;
  rules_passed: number;
}
