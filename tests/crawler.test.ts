import { describe, it, expect } from 'vitest';
import { rankDiscoveredLinks } from '../server/src/services/crawler/linkRanker.js';
import { validateAndNormalizeUrl } from '../server/src/services/crawler/urlGuard.js';

describe('Crawler & Link Ranker', () => {
  it('ranks hiring and career links above generic links', () => {
    const mockHtml = `
      <html>
        <body>
          <a href="/privacy">Privacy Policy</a>
          <a href="/about-us">About Us</a>
          <a href="/careers/hiring-process">Our Engineering Hiring Process</a>
          <a href="/terms">Terms of Service</a>
          <a href="/handbook/engineering">Engineering Handbook</a>
          <a href="/contact">Contact</a>
        </body>
      </html>
    `;

    const ranked = rankDiscoveredLinks(mockHtml, 'https://example.com');
    expect(ranked.length).toBeGreaterThan(0);

    // Top link should be the hiring process or handbook
    expect(ranked[0].url).toMatch(/hiring-process|handbook/);
    expect(ranked[0].category).toBe('hiring');

    // Low priority / penalty links should not be at top
    const topUrls = ranked.slice(0, 2).map((r) => r.url);
    expect(topUrls.some((u) => u.includes('privacy') || u.includes('terms'))).toBe(false);
  });

  it('SSRF guard blocks private IP in production while allowing valid domains', () => {
    // In production, private host must fail
    const privateResult = validateAndNormalizeUrl('http://127.0.0.1:8080', true);
    expect(privateResult.valid).toBe(false);

    const localhostResult = validateAndNormalizeUrl('http://localhost:3000', true);
    expect(localhostResult.valid).toBe(false);

    // Valid public URL passes in production
    const publicResult = validateAndNormalizeUrl('https://example.com', true);
    expect(publicResult.valid).toBe(true);

    // In non-production (e.g. batch local evaluation), local addresses are permitted
    const devLocalResult = validateAndNormalizeUrl('http://localhost:8099/acme/', false);
    expect(devLocalResult.valid).toBe(true);
    expect(devLocalResult.normalizedUrl).toBe('http://localhost:8099/acme/');
  });
});
