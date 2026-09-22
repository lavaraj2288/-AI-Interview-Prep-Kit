import axios, { AxiosError } from 'axios';
import { validateAndNormalizeUrl } from './urlGuard.js';
import { RobotsParser } from './robotsParser.js';
import { cleanHtml } from './cleaner.js';
import { rankDiscoveredLinks } from './linkRanker.js';
import { findPublicDiscussion } from './discussionFinder.js';

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  category: 'homepage' | 'hiring' | 'company' | 'other';
}

export interface CrawlResult {
  isUnreachable: boolean;
  unreachableReason?: string;
  homepage: CrawledPage | null;
  pages: CrawledPage[];
  pagesUsed: string[];
  hiringPageFound: boolean;
  publicDiscussion: {
    found: boolean;
    notes: string;
    sources: string[];
  };
  errors: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  retries: number = 3,
  timeoutMs: number = 5000
): Promise<{ data: string; status: number } | null> {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < retries) {
    attempt++;
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TraoInterviewPrepBot/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Handle 404 cleanly without throwing
      });

      if (response.status === 200 && typeof response.data === 'string') {
        return { data: response.data, status: 200 };
      }

      if (response.status === 404) {
        // 404 is definitive, don't retry
        return { data: '', status: 404 };
      }

      // If 429 or other status, back off and retry
      await sleep(500 * Math.pow(2, attempt));
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(500 * Math.pow(2, attempt));
      }
    }
  }

  return null;
}

export async function crawlCompanySite(
  companyUrl: string,
  companyNameHint: string = ''
): Promise<CrawlResult> {
  const result: CrawlResult = {
    isUnreachable: false,
    homepage: null,
    pages: [],
    pagesUsed: [],
    hiringPageFound: false,
    publicDiscussion: {
      found: false,
      notes: '',
      sources: [],
    },
    errors: [],
  };

  // 1. URL validation & normalization
  const urlCheck = validateAndNormalizeUrl(companyUrl);
  if (!urlCheck.valid) {
    result.isUnreachable = true;
    result.unreachableReason = urlCheck.error || 'Invalid company URL';
    result.errors.push(result.unreachableReason);
    return result;
  }

  const normalizedBaseUrl = urlCheck.normalizedUrl;

  // 2. Fetch Homepage (3 retries with backoff)
  const homeFetch = await fetchWithRetry(normalizedBaseUrl, 3, 6000);
  if (!homeFetch || homeFetch.status !== 200 || !homeFetch.data) {
    result.isUnreachable = true;
    result.unreachableReason = `Company site unreachable after 3 retries (status: ${homeFetch?.status || 'no response'}).`;
    result.errors.push(result.unreachableReason);
    return result;
  }

  // Clean Homepage
  const cleanedHome = cleanHtml(homeFetch.data);
  result.homepage = {
    url: normalizedBaseUrl,
    title: cleanedHome.title || 'Company Homepage',
    content: cleanedHome.cleanText,
    category: 'homepage',
  };
  result.pages.push(result.homepage);
  result.pagesUsed.push(normalizedBaseUrl);

  // 3. Load Robots.txt
  const robots = await RobotsParser.load(normalizedBaseUrl);

  // 4. Rank Discovered Links (find hiring / about pages dynamically)
  const rankedLinks = rankDiscoveredLinks(homeFetch.data, normalizedBaseUrl, 6);

  // 5. Fetch Top Ranked Pages (up to 3 candidate pages)
  let fetchedCount = 0;
  for (const candidate of rankedLinks) {
    if (fetchedCount >= 3) break;

    // Check robots permission
    if (!robots.isAllowed(candidate.url)) {
      result.errors.push(`Robots.txt disallowed path: ${candidate.url}`);
      continue;
    }

    // Polite delay between requests
    await sleep(250);

    try {
      const pageFetch = await fetchWithRetry(candidate.url, 2, 4000);
      if (pageFetch && pageFetch.status === 200 && pageFetch.data) {
        const cleaned = cleanHtml(pageFetch.data);
        if (cleaned.cleanText.length > 50) {
          result.pages.push({
            url: candidate.url,
            title: cleaned.title || candidate.anchorText || candidate.url,
            content: cleaned.cleanText,
            category: candidate.category,
          });
          result.pagesUsed.push(candidate.url);
          fetchedCount++;

          if (candidate.category === 'hiring') {
            result.hiringPageFound = true;
          }
        }
      } else if (pageFetch?.status === 404) {
        result.errors.push(`Discovered link returned 404: ${candidate.url}`);
      }
    } catch {
      result.errors.push(`Failed to fetch link: ${candidate.url}`);
    }
  }

  // 6. Public discussion lookup
  const companyName = companyNameHint || cleanedHome.title || '';
  const discussion = await findPublicDiscussion(companyName);
  result.publicDiscussion = discussion;
  if (discussion.found && discussion.sources.length > 0) {
    result.pagesUsed.push(...discussion.sources);
  }

  return result;
}
