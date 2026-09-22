import { URL } from 'url';

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

const PRIVATE_IP_PATTERNS = [
  /^127\./,                         // Loopback
  /^10\./,                          // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private class B
  /^192\.168\./,                    // Private class C
  /^169\.254\./,                    // Link-local / Cloud metadata (AWS/GCP/Azure)
  /^0\.0\.0\.0/,
  /^localhost$/i,
  /^\[?::1\]?$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function validateExternalUrl(urlString: string, allowLocal: boolean = false): UrlValidationResult {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'Empty or invalid URL provided' };
  }

  const trimmed = urlString.trim();

  // Protocol check
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // If user entered e.g. "acme.com", auto-prepend https://
    try {
      parsed = new URL(`https://${trimmed}`);
    } catch {
      return { valid: false, reason: 'Malformed URL structure' };
    }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow local addresses if configured (essential for Section 9 batch evaluate tests on localhost)
  const isLocalAllowed = allowLocal || process.env.ALLOW_LOCAL_URLS === 'true' || process.env.NODE_ENV === 'test';

  if (!isLocalAllowed) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: `Access to private or loopback host '${hostname}' is restricted in production.` };
      }
    }
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}
