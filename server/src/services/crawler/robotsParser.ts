import { URL } from 'url';

export class RobotsParser {
  private disallowedPaths: string[] = [];

  async fetchAndParse(baseUrl: string): Promise<void> {
    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TraoInterviewPrepBot/1.0' }
      });
      clearTimeout(timeout);

      if (!response.ok) return;

      const text = await response.text();
      this.parseRobotsTxt(text);
    } catch {
      // If robots.txt fails or 404s, standard behavior is to proceed normally
      this.disallowedPaths = [];
    }
  }

  private parseRobotsTxt(content: string): void {
    const lines = content.split('\n');
    let appliesToAll = false;

    for (let rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const [directive, ...valParts] = line.split(':');
      const val = valParts.join(':').trim();

      if (directive.toLowerCase() === 'user-agent') {
        appliesToAll = (val === '*');
      } else if (appliesToAll && directive.toLowerCase() === 'disallow') {
        if (val) {
          this.disallowedPaths.push(val);
        }
      }
    }
  }

  isAllowed(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      const pathname = parsed.pathname;

      for (const disallowed of this.disallowedPaths) {
        if (disallowed === '/') return false;
        if (pathname.startsWith(disallowed)) return false;
      }
      return true;
    } catch {
      return true;
    }
  }
}
