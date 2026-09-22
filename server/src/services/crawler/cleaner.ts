import * as cheerio from 'cheerio';

export interface CleanedDocument {
  title: string;
  cleanText: string;
  charCount: number;
}

const MAX_CHAR_LIMIT = 25000;

export function cleanHtmlContent(html: string): CleanedDocument {
  if (!html || typeof html !== 'string') {
    return { title: '', cleanText: '', charCount: 0 };
  }

  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Remove non-content elements
  $('script, style, noscript, svg, iframe, nav, footer, header, form, button').remove();

  // Prefer main content container if available
  let contentTarget = $('main, article, #content, .content, [role="main"]').first();
  if (contentTarget.length === 0) {
    contentTarget = $('body');
  }

  // Replace block elements with linebreaks for readability
  contentTarget.find('p, h1, h2, h3, h4, h5, h6, li, tr, div').each((_, el) => {
    $(el).append('\n');
  });

  const rawText = contentTarget.text();

  // Normalize excessive spaces and blank lines
  const cleanLines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  let cleanText = cleanLines.join('\n');

  if (cleanText.length > MAX_CHAR_LIMIT) {
    cleanText = cleanText.substring(0, MAX_CHAR_LIMIT) + '\n... [content truncated for length]';
  }

  return {
    title,
    cleanText,
    charCount: cleanText.length
  };
}
