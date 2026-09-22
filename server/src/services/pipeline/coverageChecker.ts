import { RoleRequirement, KitQuestion, KitCoverage } from '../../types/kit.js';

export interface CoverageAnalysis {
  coverage: KitCoverage;
  totalRequirements: number;
  coveredRequirementsCount: number;
  uncoveredMustRequirements: RoleRequirement[];
  uncoveredNiceRequirements: RoleRequirement[];
  hasGaps: boolean;
  hasMustGaps: boolean;
  coverageRatio: number;
}

/**
 * Deterministically checks which requirements are covered by questions.
 * This is pure application logic, not handed to the LLM.
 */
export function checkCoverage(
  requirements: RoleRequirement[],
  questions: KitQuestion[],
  previousPasses: number = 0
): CoverageAnalysis {
  const coveredSet = new Set<string>();

  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredSet.add(reqId);
      }
    }
  }

  const uncoveredRequirementIds: string[] = [];
  const uncoveredMust: RoleRequirement[] = [];
  const uncoveredNice: RoleRequirement[] = [];

  for (const req of requirements) {
    if (!coveredSet.has(req.id)) {
      uncoveredRequirementIds.push(req.id);
      if (req.priority === 'must') {
        uncoveredMust.push(req);
      } else {
        uncoveredNice.push(req);
      }
    }
  }

  const totalRequirements = requirements.length;
  const coveredCount = totalRequirements - uncoveredRequirementIds.length;
  const coverageRatio = totalRequirements > 0 ? coveredCount / totalRequirements : 1.0;

  return {
    coverage: {
      uncovered_requirement_ids: uncoveredRequirementIds,
      passes: previousPasses + 1,
    },
    totalRequirements,
    coveredRequirementsCount: coveredCount,
    uncoveredMustRequirements: uncoveredMust,
    uncoveredNiceRequirements: uncoveredNice,
    hasGaps: uncoveredRequirementIds.length > 0,
    hasMustGaps: uncoveredMust.length > 0,
    coverageRatio,
  };
}
