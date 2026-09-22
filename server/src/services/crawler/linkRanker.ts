import * as cheerio from 'cheerio';
import { resolveUrl } from './urlGuard.js';
import { URL } from 'url';

export interface RankedLink {
  url: string;
  anchorText: string;
  score: number;
  category: 'hiring' | 'company' | 'other';
}

const HIRING_KEYWORDS: Array<{ term: string; score: number }> = [
  { term: 'hiring-process', score: 100 },
  { term: 'how-we-hire', score: 100 },
  { term: 'interview-process', score: 100 },
  { term: 'interviewing', score: 90 },
  { term: 'engineering-handbook', score: 90 },
  { term: 'handbook', score: 70 },
  { term: 'careers', score: 65 },
  { term: 'jobs', score: 65 },
  { term: 'work-with-us', score: 65 },
  { term: 'join-us', score: 60 },
  { term: 'join-the-team', score: 60 },
  { term: 'open-roles', score: 60 },
  { term: 'positions', score: 50 },
  { term: 'engineering-blog', score: 50 },
  { term: 'culture', score: 45 },
];

const COMPANY_KEYWORDS: Array<{ term: string; score: number }> = [
  { term: 'about-us', score: 45 },
  { term: 'about', score: 40 },
  { term: 'mission', score: 35 },
  { term: 'our-story', score: 35 },
  { term: 'team', score: 30 },
  { term: 'engineering', score: 30 },
  { term: 'values', score: 30 },
  { term: 'technology', score: 25 },
  { term: 'product', score: 20 },
];

const PENALTY_KEYWORDS = [
  'privacy',
  'terms',
  'legal',
  'cookie',
  'login',
  'signin',
  'signup',
  'register',
  'cart',
  'checkout',
  'pricing',
  'billing',
  'subscribe',
  'forgot-password',
  'reset-password',
  'download',
];

export function rankDiscoveredLinks(
  html: string,
  baseUrl: string,
  maxCandidates: number = 6
): RankedLink[] {
  if (!html) return [];

  const $ = cheerio.load(html);
  const baseParsed = new URL(baseUrl);
  const baseHostname = baseParsed.hostname;

  const candidatesMap = new Map<string, { anchorText: string; score: number; category: 'hiring' | 'company' | 'other' }>();

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href');
    const anchorText = $(el).text().trim().toLowerCase();

    if (!rawHref) return;

    // Ignore anchors, javascript, mailto, tel
    if (
      rawHref.startsWith('#') ||
      rawHref.startsWith('javascript:') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:')
    ) {
      return;
    }

    // Ignore binary/asset files
    if (/\.(png|jpe?g|gif|webp|svg|pdf|zip|tar|gz|mp4|mp3|exe|dmg)$/i.test(rawHref)) {
      return;
    }

    const resolved = resolveUrl(baseUrl, rawHref);

    try {
      const resolvedParsed = new URL(resolved);

      // Must be http/https
      if (resolvedParsed.protocol !== 'http:' && resolvedParsed.protocol !== 'https:') {
        return;
      }

      // Check host: keep to same base host or subdomains
      if (
        resolvedParsed.hostname !== baseHostname &&
        !resolvedParsed.hostname.endsWith(`.${baseHostname}`)
      ) {
        return;
      }

      // Normalize URL (strip hash and query parameters)
      resolvedParsed.hash = '';
      resolvedParsed.search = '';
      const cleanUrl = resolvedParsed.toString();

      // Don't crawl root homepage again
      if (cleanUrl === baseUrl || cleanUrl === `${baseUrl}/` || resolvedParsed.pathname === '/') {
        return;
      }

      const pathLower = resolvedParsed.pathname.toLowerCase();
      const combined = `${pathLower} ${anchorText}`;

      let score = 0;
      let category: 'hiring' | 'company' | 'other' = 'other';

      // Check penalties
      for (const penalty of PENALTY_KEYWORDS) {
        if (combined.includes(penalty)) {
          score -= 60;
        }
      }

      // Check hiring keywords
      for (const item of HIRING_KEYWORDS) {
        if (pathLower.includes(item.term)) score += item.score;
        if (anchorText.includes(item.term.replace(/-/g, ' '))) score += item.score;
      }

      // Check company keywords
      for (const item of COMPANY_KEYWORDS) {
        if (pathLower.includes(item.term)) score += item.score;
        if (anchorText.includes(item.term.replace(/-/g, ' '))) score += item.score;
      }

      if (score >= 40) {
        category = score >= 50 && HIRING_KEYWORDS.some((h) => combined.includes(h.term.replace(/-/g, ' ')))
          ? 'hiring'
          : 'company';
      }

      if (score > 0) {
        const existing = candidatesMap.get(cleanUrl);
        if (!existing || score > existing.score) {
          candidatesMap.set(cleanUrl, { anchorText, score, category });
        }
      }
    } catch {
      // Ignore invalid URL
    }
  });

  const ranked: RankedLink[] = Array.from(candidatesMap.entries()).map(
    ([url, data]) => ({
      url,
      anchorText: data.anchorText,
      score: data.score,
      category: data.category,
    })
  );

  // Sort descending by score
  ranked.sort((a, b) => b.score - a.score);

  return ranked.slice(0, maxCandidates);
}
