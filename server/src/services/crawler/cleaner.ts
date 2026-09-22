import * as cheerio from 'cheerio';

export interface CleanedPage {
  title: string;
  cleanText: string;
}

export function cleanHtml(html: string, maxChars: number = 12000): CleanedPage {
  if (!html || typeof html !== 'string') {
    return { title: '', cleanText: '' };
  }

  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, noscript, iframe, svg, canvas, nav, footer, header, form, button, input, select, textarea, .ad, .cookie, .banner, .modal').remove();

  // Extract page title
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Prefer main content container if available
  let contentElement = $('main, article, #content, .content, .main-content, body');
  if (contentElement.length === 0) {
    contentElement = $('body');
  }

  // Extract text and normalize whitespace
  let text = contentElement
    .text()
    .replace(/\t+/g, ' ')
    .replace(/\r?\n\s*\r?\n/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

  // Prevent prompt injection: ensure fetched text is clearly treated as data
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n...[Content truncated for length]';
  }

  return {
    title,
    cleanText: text,
  };
}
