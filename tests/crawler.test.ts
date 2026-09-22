import { describe, it, expect } from 'vitest';
import { validateExternalUrl } from '../server/src/services/crawler/urlGuard.js';
import { rankLinksFromHtml } from '../server/src/services/crawler/linkRanker.js';

describe('Crawler & Security URL Guard', () => {
  it('blocks private IP addresses in production mode', () => {
    const oldEnv = process.env.NODE_ENV;
    const oldAllow = process.env.ALLOW_LOCAL_URLS;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_LOCAL_URLS = 'false';

      const privateCheck1 = validateExternalUrl('http://127.0.0.1:8080', false);
      expect(privateCheck1.valid).toBe(false);

      const privateCheck2 = validateExternalUrl('http://169.254.169.254/latest/meta-data/', false);
      expect(privateCheck2.valid).toBe(false);

      const privateCheck3 = validateExternalUrl('http://192.168.1.1', false);
      expect(privateCheck3.valid).toBe(false);
    } finally {
      process.env.NODE_ENV = oldEnv;
      process.env.ALLOW_LOCAL_URLS = oldAllow;
    }
  });

  it('permits localhost when allowLocal is explicitly enabled for batch test cases', () => {
    const localCheck = validateExternalUrl('http://localhost:8099/acme/', true);
    expect(localCheck.valid).toBe(true);
    expect(localCheck.normalizedUrl).toBe('http://localhost:8099/acme/');
  });

  it('ranks hiring and interview links higher than terms and privacy', () => {
    const sampleHtml = `
      <html>
        <body>
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/careers/hiring-process">How We Hire & Interview Guide</a>
          <a href="/about">About Acme</a>
          <a href="/jobs">Engineering Jobs</a>
        </body>
      </html>
    `;

    const ranked = rankLinksFromHtml(sampleHtml, 'https://acme.com');
    expect(ranked.length).toBeGreaterThan(0);

    // The top ranked link should be the hiring process candidate
    expect(ranked[0].url).toContain('hiring-process');
    expect(ranked[0].isHiringProcessCandidate).toBe(true);

    // Terms & privacy should not be at the top
    const urls = ranked.map(r => r.url);
    expect(urls[0]).not.toContain('privacy');
    expect(urls[0]).not.toContain('terms');
  });
});
