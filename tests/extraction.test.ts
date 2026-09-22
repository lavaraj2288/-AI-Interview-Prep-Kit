import { describe, it, expect } from 'vitest';
import { runPrepKitPipeline } from '../server/src/services/pipeline/orchestrator.js';
import { defaultLLMClient } from '../server/src/services/llm/llmClient.js';
import { buildExtractorPrompt } from '../server/src/services/llm/prompts.js';
import { RoleInfo } from '../server/src/types/kit.js';

describe('Requirement Extraction & Stub Handling', () => {
  it('extracts must vs nice requirements and correct kinds from complex JD', async () => {
    const complexJd = `Staff Backend Architect
We are looking for an experienced developer with 5+ years with React and TypeScript.
Must have strong distributed systems experience and mentoring skills.
Bonus points for GraphQL and Kubernetes.`;

    const extractorPrompts = buildExtractorPrompt(complexJd);
    const extracted = await defaultLLMClient.generateJson<RoleInfo>({
      systemPrompt: extractorPrompts.systemPrompt,
      userPrompt: extractorPrompts.userPrompt,
    });

    expect(extracted.title).toBe('Staff Backend Architect');
    expect(extracted.seniority).toBe('Lead');
    expect(extracted.requirements.length).toBeGreaterThanOrEqual(3);

    const mustReqs = extracted.requirements.filter((r) => r.priority === 'must');
    const niceReqs = extracted.requirements.filter((r) => r.priority === 'nice');
    expect(mustReqs.length).toBeGreaterThanOrEqual(2);
    expect(niceReqs.length).toBeGreaterThanOrEqual(1);

    const behaviouralReq = extracted.requirements.find((r) => r.kind === 'behavioural');
    expect(behaviouralReq).toBeDefined();
    expect(behaviouralReq?.text.toLowerCase()).toContain('mentor');

    const technicalReq = extracted.requirements.find((r) => r.kind === 'technical');
    expect(technicalReq).toBeDefined();
  });

  it('handles a 2-line stub honestly without hallucinating requirements', async () => {
    const stubJd = `Backend Developer
Build Python APIs and PostgreSQL databases.`;

    const extractorPrompts = buildExtractorPrompt(stubJd);
    const extracted = await defaultLLMClient.generateJson<RoleInfo>({
      systemPrompt: extractorPrompts.systemPrompt,
      userPrompt: extractorPrompts.userPrompt,
    });

    expect(extracted.title).toBe('Backend Developer');
    // Only genuine requirements extracted
    expect(extracted.requirements.length).toBeLessThanOrEqual(3);
    for (const r of extracted.requirements) {
      expect(
        r.text.toLowerCase().includes('python') ||
        r.text.toLowerCase().includes('postgresql') ||
        r.text.toLowerCase().includes('api')
      ).toBe(true);
    }
  });

  it(
    'runs full prep kit pipeline producing compliant Appendix A kit for stub',
    async () => {
      const stubJd = `Backend Developer
Build Python APIs and PostgreSQL databases.`;

      const result = await runPrepKitPipeline({
        jd: stubJd,
        companyUrl: 'https://example.org',
        days: 3,
      });

      expect(result.success).toBe(true);
      expect(result.kit).toBeDefined();
      if (result.kit) {
        expect(result.kit.schedule.days_available).toBe(3);
        expect(result.kit.schedule.days.length).toBe(3);
        expect(result.kit.coverage.uncovered_requirement_ids.length).toBe(0);
        expect(result.kit.role.title).toBe('Backend Developer');
      }
    },
    20000
  );
});
