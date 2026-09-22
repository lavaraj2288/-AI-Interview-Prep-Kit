import { validateExternalUrl } from './urlGuard.js';
import { RobotsParser } from './robotsParser.js';
import { cleanHtmlContent } from './cleaner.js';
import { rankLinksFromHtml } from './linkRanker.js';
import { CrawledPage, CrawlerResult } from '../../types/kit.js';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_PAGES_TO_FETCH = 4;
const MAX_BYTE_SIZE = 2 * 1024 * 1024; // 2MB

export class CompanyCrawler {
  private robotsParser = new RobotsParser();

  async crawlCompanySite(targetUrl: string): Promise<CrawlerResult> {
    const result: CrawlerResult = {
      pages: [],
      hiringPageFound: false,
      publicDiscussion: [],
      errors: []
    };

    const urlCheck = validateExternalUrl(targetUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      result.errors.push({
        url: targetUrl,
        reason: urlCheck.reason || 'Invalid URL'
      });
      return result;
    }

    const startUrl = urlCheck.normalizedUrl;

    // Check robots.txt
    await this.robotsParser.fetchAndParse(startUrl);

    // Fetch homepage / entry point
    const homepage = await this.fetchSinglePage(startUrl);
    if (!homepage) {
      result.errors.push({
        url: startUrl,
        reason: 'Root page could not be retrieved or timed out'
      });
      return result;
    }

    result.pages.push(homepage.page);

    // Rank discovered links
    const rankedLinks = rankLinksFromHtml(homepage.rawHtml, startUrl);

    // Filter by robots.txt and take top candidates
    const eligibleLinks = rankedLinks
      .filter(l => this.robotsParser.isAllowed(l.url))
      .slice(0, MAX_PAGES_TO_FETCH);

    for (const link of eligibleLinks) {
      // Respectful delay between requests
      await new Promise(r => setTimeout(r, 200));

      const subpage = await this.fetchSinglePage(link.url);
      if (subpage) {
        result.pages.push(subpage.page);
        if (link.isHiringProcessCandidate || subpage.page.text.toLowerCase().includes('interview process')) {
          result.hiringPageFound = true;
        }
      } else {
        result.errors.push({
          url: link.url,
          reason: 'Failed to retrieve subpage or timed out'
        });
      }
    }

    return result;
  }

  private async fetchSinglePage(urlString: string): Promise<{ page: CrawledPage; rawHtml: string } | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const response = await fetch(urlString, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (Compatible; TraoInterviewKitCrawler/1.0)',
          'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        return null;
      }

      // Check content-length header if provided
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_BYTE_SIZE) {
        return null;
      }

      const rawHtml = await response.text();
      if (rawHtml.length > MAX_BYTE_SIZE) {
        return null;
      }

      const cleaned = cleanHtmlContent(rawHtml);

      return {
        page: {
          url: urlString,
          title: cleaned.title || urlString,
          text: cleaned.cleanText,
          status: response.status,
          contentType,
          sizeBytes: rawHtml.length
        },
        rawHtml
      };
    } catch {
      return null;
    }
  }
}
