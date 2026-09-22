import { URL } from 'url';

const PRIVATE_IP_REGEX =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0|::1)$/i;

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error?: string;
}

export function validateAndNormalizeUrl(
  urlString: string,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): UrlValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, normalizedUrl: '', error: 'URL is required' };
  }

  let trimmed = urlString.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: `Unsupported protocol: ${parsed.protocol}. Only http and https are allowed.`,
      };
    }

    const hostname = parsed.hostname;

    // In production mode, guard against SSRF to private/internal networks
    if (isProduction && PRIVATE_IP_REGEX.test(hostname)) {
      return {
        valid: false,
        normalizedUrl: '',
        error: `Access to private or loopback host (${hostname}) is blocked in production.`,
      };
    }

    return {
      valid: true,
      normalizedUrl: parsed.toString(),
    };
  } catch (err) {
    return {
      valid: false,
      normalizedUrl: '',
      error: `Invalid URL format: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function resolveUrl(baseUrl: string, relativePath: string): string {
  try {
    return new URL(relativePath, baseUrl).toString();
  } catch {
    return relativePath;
  }
}
