import { KitRequirement, KitQuestion } from '../../types/kit.js';

export interface CoverageAnalysis {
  coveredRequirementIds: string[];
  uncoveredRequirementIds: string[];
  uncoveredMustHaves: KitRequirement[];
  uncoveredNiceToHaves: KitRequirement[];
  coverageRatio: number;
}

export function checkRequirementCoverage(
  requirements: KitRequirement[],
  questions: KitQuestion[]
): CoverageAnalysis {
  // Collect all requirement IDs referenced across generated questions
  const coveredIdsSet = new Set<string>();

  for (const question of questions) {
    if (Array.isArray(question.requirement_ids)) {
      for (const reqId of question.requirement_ids) {
        if (reqId) coveredIdsSet.add(reqId);
      }
    }
  }

  const uncoveredRequirementIds: string[] = [];
  const uncoveredMustHaves: KitRequirement[] = [];
  const uncoveredNiceToHaves: KitRequirement[] = [];

  for (const req of requirements) {
    if (!coveredIdsSet.has(req.id)) {
      uncoveredRequirementIds.push(req.id);
      if (req.priority === 'must') {
        uncoveredMustHaves.push(req);
      } else {
        uncoveredNiceToHaves.push(req);
      }
    }
  }

  const totalReqs = requirements.length;
  const coveredCount = totalReqs - uncoveredRequirementIds.length;
  const coverageRatio = totalReqs > 0 ? coveredCount / totalReqs : 1.0;

  return {
    coveredRequirementIds: Array.from(coveredIdsSet),
    uncoveredRequirementIds,
    uncoveredMustHaves,
    uncoveredNiceToHaves,
    coverageRatio
  };
}
