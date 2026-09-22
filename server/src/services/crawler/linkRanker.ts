import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface ScoredLink {
  url: string;
  score: number;
  anchorText: string;
  isHiringProcessCandidate: boolean;
}

const HIGH_PRIORITY_TERMS = [
  'interview',
  'how we hire',
  'hiring process',
  'hiring guide',
  'engineering handbook',
  'interview guide',
  'recruiting',
  'what to expect'
];

const MEDIUM_PRIORITY_TERMS = [
  'career',
  'careers',
  'jobs',
  'job',
  'work with us',
  'join us',
  'culture',
  'values',
  'about',
  'about us',
  'engineering'
];

const NEGATIVE_TERMS = [
  'privacy',
  'terms',
  'legal',
  'cookie',
  'cookies',
  'login',
  'signin',
  'sign-in',
  'signup',
  'cart',
  'checkout',
  'billing',
  'download',
  'pricing'
];

export function rankLinksFromHtml(html: string, baseUrl: string): ScoredLink[] {
  const $ = cheerio.load(html);
  const linksMap = new Map<string, ScoredLink>();

  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim();
    if (!rawHref) return;

    // Ignore anchors, javascript, mailto, tel
    if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      return;
    }

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      return;
    }

    // Keep to same origin or company subdomains
    try {
      const parsed = new URL(absoluteUrl);
      if (parsed.origin !== baseOrigin && !parsed.hostname.endsWith(new URL(baseUrl).hostname)) {
        return;
      }
      // Strip hash and query params for crawling deduplication
      parsed.hash = '';
      parsed.search = '';
      absoluteUrl = parsed.toString();
    } catch {
      return;
    }

    // Skip root url itself
    if (absoluteUrl === baseUrl || absoluteUrl === `${baseOrigin}/`) {
      return;
    }

    const anchorText = $(el).text().trim().toLowerCase();
    const hrefLower = absoluteUrl.toLowerCase();
    const ariaLabel = ($(el).attr('aria-label') || '').toLowerCase();
    const combinedContext = `${anchorText} ${hrefLower} ${ariaLabel}`;

    let score = 0;
    let isHiringProcessCandidate = false;

    // Negative penalties
    for (const term of NEGATIVE_TERMS) {
      if (combinedContext.includes(term)) {
        score -= 20;
      }
    }

    // High priority scoring
    for (const term of HIGH_PRIORITY_TERMS) {
      if (combinedContext.includes(term)) {
        score += 35;
        isHiringProcessCandidate = true;
      }
    }

    // Medium priority scoring
    for (const term of MEDIUM_PRIORITY_TERMS) {
      if (combinedContext.includes(term)) {
        score += 15;
      }
    }

    if (score > 0) {
      const existing = linksMap.get(absoluteUrl);
      if (!existing || existing.score < score) {
        linksMap.set(absoluteUrl, {
          url: absoluteUrl,
          score,
          anchorText,
          isHiringProcessCandidate
        });
      }
    }
  });

  return Array.from(linksMap.values()).sort((a, b) => b.score - a.score);
}
