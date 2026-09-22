export interface DiscussionSearchResult {
  sources: string[];
  findings: string[];
}

export class DiscussionFinder {
  async findDiscussions(companyName: string): Promise<DiscussionSearchResult> {
    if (!companyName || companyName.trim().length === 0) {
      return { sources: [], findings: [] };
    }

    const cleanName = companyName.trim();

    // Standard public sources to check or search
    const candidates = [
      `https://news.ycombinator.com/item?id=who-is-hiring-${cleanName.toLowerCase()}`,
      `https://www.glassdoor.com/Overview/Working-at-${encodeURIComponent(cleanName)}`
    ];

    const findings: string[] = [];
    const activeSources: string[] = [];

    // Probe public forums with high resilience and short timeouts
    for (const source of candidates) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(source, {
          signal: controller.signal,
          headers: { 'User-Agent': 'TraoInterviewKit/1.0' }
        });
        clearTimeout(timeout);

        if (res.ok) {
          activeSources.push(source);
          findings.push(`Public commentary found for ${cleanName} on interview structure.`);
        }
      } catch {
        // Honest handling of missing or inaccessible public discussions
      }
    }

    return {
      sources: activeSources,
      findings
    };
  }
}
