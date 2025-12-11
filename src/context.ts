/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export type Ctx = {
  org?: string;
  site?: string;
  edsDomainUrl?: string;
  contentPath?: string;
  sourceUrl?: string; // Direct URL to fetch content from
  useSchema: boolean;
  compact: boolean;
  includeHead: boolean;
  transformer?: string;
};

/**
 * Extract base domain from a URL (protocol + hostname)
 */
function getBaseDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

export function getCtx(url: string): Ctx {
  const urlObj = new URL(url);
  const compact = urlObj.searchParams.get('compact') === 'true';
  const includeHead = urlObj.searchParams.get('head') !== 'false';
  const useSchema = urlObj.searchParams.get('schema') === 'true';
  const usePreview = urlObj.searchParams.get('preview') === 'true';
  const transformer = urlObj.searchParams.get('transformer') || undefined;

  // Check if a direct URL is provided via query parameter
  const sourceUrlParam = urlObj.searchParams.get('url');

  if (sourceUrlParam) {
    // Direct URL mode: use the provided URL directly
    try {
      const sourceUrl = new URL(sourceUrlParam);
      const baseDomain = getBaseDomain(sourceUrlParam);

      return {
        sourceUrl: sourceUrlParam,
        edsDomainUrl: baseDomain, // Use base domain for schema fetching
        useSchema,
        compact,
        includeHead,
        transformer,
      };
    } catch (error) {
      throw new Error(`Invalid URL parameter: ${sourceUrlParam}. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Legacy mode: parse org/site/path from URL pathname
  const [, org, site, ...rest] = urlObj.pathname.split('/');
  if (!org || !site) {
    throw new Error('Usage: /org/site/path or ?url=https://domain.com/path');
  }

  return {
    org,
    site,
    edsDomainUrl: `https://main--${site}--${org}.aem.${usePreview ? 'page' : 'live'}`,
    contentPath: rest.join('/') || '',
    useSchema,
    compact,
    includeHead,
    transformer,
  };
}
