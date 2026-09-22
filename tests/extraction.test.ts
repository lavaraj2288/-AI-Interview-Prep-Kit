import { describe, it, expect } from 'vitest';
import { KitPipelineOrchestrator } from '../server/src/services/pipeline/orchestrator.js';

describe('Job Description Requirement Extraction', () => {
  const orchestrator = new KitPipelineOrchestrator();

  it('correctly handles a two-line stub JD without inventing requirements', () => {
    const stubJd = 'React Developer needed.\nMust know modern React, Redux, and CSS.';
    const result = orchestrator.deterministicExtractRoleAndRequirements(stubJd);

    expect(result.title).toBeDefined();
    // Requirements count should be thin, not padded with invented fluff
    expect(result.requirements.length).toBeLessThanOrEqual(3);
    expect(result.requirements[0].text.toLowerCase()).toContain('react');
  });

  it('accurately distinguishes must vs nice requirements based on phrasing', () => {
    const jd = `
Senior Full Stack Engineer
- 5+ years with TypeScript and Node.js (must)
- Experience designing relational databases (PostgreSQL)
- Bonus points for experience with Go or Rust
- Nice to have: Docker and Kubernetes
    `;

    const result = orchestrator.deterministicExtractRoleAndRequirements(jd);

    const mustReqs = result.requirements.filter(r => r.priority === 'must');
    const niceReqs = result.requirements.filter(r => r.priority === 'nice');

    expect(mustReqs.length).toBeGreaterThan(0);
    expect(niceReqs.length).toBeGreaterThan(0);

    const bonusItem = result.requirements.find(r => r.text.includes('Bonus points') || r.text.includes('Go or Rust'));
    expect(bonusItem?.priority).toBe('nice');

    const tsItem = result.requirements.find(r => r.text.includes('TypeScript'));
    expect(tsItem?.priority).toBe('must');
  });

  it('classifies requirements into technical vs behavioural vs domain', () => {
    const jd = `
Engineering Lead
- Deep expertise in React and TypeScript (technical)
- Mentoring junior engineers and conducting performance reviews (behavioural)
- Experience in healthcare HIPAA compliance and clinical data (domain)
    `;

    const result = orchestrator.deterministicExtractRoleAndRequirements(jd);

    const tech = result.requirements.find(r => r.text.includes('React'));
    const behav = result.requirements.find(r => r.text.includes('Mentoring'));
    const domain = result.requirements.find(r => r.text.includes('HIPAA') || r.text.includes('healthcare'));

    expect(tech?.kind).toBe('technical');
    expect(behav?.kind).toBe('behavioural');
    expect(domain?.kind).toBe('domain');
  });
});
