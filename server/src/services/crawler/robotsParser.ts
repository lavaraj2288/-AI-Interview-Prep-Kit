import axios from 'axios';
import { URL } from 'url';

export class RobotsParser {
  private disallowedPaths: string[] = [];

  constructor(disallowedPaths: string[] = []) {
    this.disallowedPaths = disallowedPaths;
  }

  static async load(baseUrl: string, timeoutMs: number = 3000): Promise<RobotsParser> {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await axios.get(robotsUrl, {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'TraoInterviewPrepBot/1.0 (+https://example.com/bot)' },
        validateStatus: (status) => status === 200,
      });

      if (typeof response.data !== 'string') {
        return new RobotsParser([]);
      }

      const disallowed: string[] = [];
      const lines = response.data.split('\n');
      let isAllUserAgents = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('#') || !line) continue;

        if (line.toLowerCase().startsWith('user-agent:')) {
          const agent = line.substring(11).trim();
          isAllUserAgents = agent === '*' || agent.toLowerCase().includes('trao');
        } else if (isAllUserAgents && line.toLowerCase().startsWith('disallow:')) {
          const path = line.substring(9).trim();
          if (path) disallowed.push(path);
        }
      }

      return new RobotsParser(disallowed);
    } catch {
      // If robots.txt doesn't exist (404) or fails, default to allowing crawling
      return new RobotsParser([]);
    }
  }

  isAllowed(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      const path = parsed.pathname;

      for (const disallowed of this.disallowedPaths) {
        if (disallowed === '/') return false;
        if (path.startsWith(disallowed)) return false;
      }
      return true;
    } catch {
      return true;
    }
  }
}
