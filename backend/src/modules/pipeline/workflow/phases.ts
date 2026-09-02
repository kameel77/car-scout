import { PipelinePhase } from '@prisma/client';

export const PIPELINE_PHASES: PipelinePhase[] = [
  PipelinePhase.INBOX,
  PipelinePhase.QUALIFICATION,
  PipelinePhase.SELECTION,
  PipelinePhase.COMPLETING,
  PipelinePhase.FINANCIAL_DECISION,
  PipelinePhase.CONTRACT,
  PipelinePhase.DELIVERY,
];

export const PHASE_LABELS: Record<PipelinePhase, string> = {
  [PipelinePhase.INBOX]: 'Inbox',
  [PipelinePhase.QUALIFICATION]: 'Kwalifikacja',
  [PipelinePhase.SELECTION]: 'Wybór pojazdu',
  [PipelinePhase.COMPLETING]: 'Kompletowanie',
  [PipelinePhase.FINANCIAL_DECISION]: 'Decyzja finansowa',
  [PipelinePhase.CONTRACT]: 'Umowa i płatność',
  [PipelinePhase.DELIVERY]: 'Wydanie pojazdu',
};

/**
 * Validates if transition from currentPhase to targetPhase is structurally allowed.
 * In M1, any phase change within the active taxonomy is allowed (or overridden if explicitly flagged).
 */
export function isPhaseTransitionAllowed(
  currentPhase: PipelinePhase,
  targetPhase: PipelinePhase,
  _overridden: boolean = false
): boolean {
  if (currentPhase === targetPhase) return true;
  return PIPELINE_PHASES.includes(targetPhase);
}
