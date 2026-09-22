import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DiscussionResult {
  found: boolean;
  notes: string;
  sources: string[];
}

/**
 * Searches for public discussions regarding the company's interview process.
 * Gracefully reports if nothing is found without failing the run.
 */
export async function findPublicDiscussion(
  companyName: string,
  timeoutMs: number = 4000
): Promise<DiscussionResult> {
  if (!companyName || companyName.trim().length === 0) {
    return {
      found: false,
      notes: 'No company name provided for discussion research.',
      sources: [],
    };
  }

  const cleanName = companyName.trim();

  try {
    // Attempt search on DuckDuckGo HTML Lite (no JS required, respectful search)
    const query = encodeURIComponent(`${cleanName} interview process questions glassdoor reddit`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;

    const response = await axios.get(searchUrl, {
      timeout: timeoutMs,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      validateStatus: (status) => status === 200,
    });

    if (!response.data || typeof response.data !== 'string') {
      return {
        found: false,
        notes: `Public discussion search returned no data for ${cleanName}.`,
        sources: [],
      };
    }

    const $ = cheerio.load(response.data);
    const snippets: string[] = [];
    const sources: string[] = [];

    $('.result__snippet').slice(0, 3).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) {
        snippets.push(text);
      }
    });

    $('.result__url').slice(0, 3).each((_, el) => {
      const href = $(el).text().trim();
      if (href) {
        sources.push(href.startsWith('http') ? href : `https://${href}`);
      }
    });

    if (snippets.length === 0) {
      return {
        found: false,
        notes: `No public interview discussions found for ${cleanName}. Relying on job description and company site.`,
        sources: [],
      };
    }

    // Combine sanitized snippets
    const cleanNotes = snippets
      .join(' ')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 800);

    return {
      found: true,
      notes: cleanNotes,
      sources,
    };
  } catch {
    // If external search fails (e.g. offline, rate-limited, or blocked), fail gracefully
    return {
      found: false,
      notes: `Public interview discussion search for "${cleanName}" was unavailable or returned no results.`,
      sources: [],
    };
  }
}
