# mhast

A minimal tool for extracting and processing Edge Delivery Services HTML content from HTML to a generic JSON format.

## Features
- Extracts content, head, and main sections from HTML
- Utilities for HTML parsing and manipulation
- Generic JSON output
- Support for schema-based extraction
- Transformers for custom output formats

## Usage

This is a Cloudflare Worker that converts EDS HTML pages to JSON. Make HTTP requests to your deployed worker endpoint.

The service supports **two ways** to specify the content URL:

### Method 1: Direct URL (Recommended for migrated customers)

Use the `url` query parameter to provide any domain URL directly:

```bash
# Direct URL - works with any domain
GET https://your-worker.com/?url=https://main--aem-boilerplate--adobe.aem.live
GET https://your-worker.com/?url=https://your-custom-domain.com/path/to/content
GET https://your-worker.com/?url=https://example.com/page?with=query&params=too
```

**Perfect for:** Customers who have migrated to EDS and use their own custom domains instead of the EDS format URLs.

### Method 2: EDS Format (Legacy - still supported)

Use the path-based format for EDS domains:

```
https://your-worker-domain.com/{org}/{site}/{content-path}?query-params
```

**Path Parameters:**
- `{org}` - Your AEM organization name (e.g., `adobecom`)
- `{site}` - Your AEM site name (e.g., `aem-live`)
- `{content-path}` - The content path on your EDS site (e.g., `developer/markup-sections-blocks`)

```bash
# EDS format request
GET https://your-worker.com/adobecom/aem-live/developer/markup-sections-blocks

# This will fetch:
# https://main--aem-live--adobecom.aem.live/developer/markup-sections-blocks
# and convert it to JSON
```

## Query Parameters

### `url={full-url}` ⭐ **NEW**
Provide a direct URL to fetch content from. Works with any domain.
```bash
GET /?url=https://main--aem-boilerplate--adobe.aem.live
GET /?url=https://your-custom-domain.com/path/to/content
```

**Note:** When using `url` parameter, other path-based parameters (`org`, `site`, `contentPath`) are ignored.

### `head=false`
Exclude `<head>` metadata from the response
```bash
GET /adobecom/aem-live/path?head=false
GET /?url=https://example.com/page&head=false
```

### `preview=true`
Use preview environment (`.aem.page` instead of `.aem.live`) - **Only applies to EDS format**
```bash
GET /adobecom/aem-live/path?preview=true
# Fetches from: https://main--aem-live--adobecom.aem.page/path
```

### `schema=true`
Use schema-based extraction (extracts structured schema data)
```bash
GET /adobecom/aem-live/path?schema=true
```

### `compact=true`
Compact output format (removes empty values)
```bash
GET /adobecom/aem-live/path?compact=true
```

### `transformer={name}`
Apply a transformer to the output. Available transformers:
- `flatten` - Flattens nested section arrays
- `strip-metadata` - Removes metadata from sections
- `compact` - Removes empty sections and null values
- `ffc_photoshop` - Transforms ffc-photoshop content structure

```bash
GET /adobecom/aem-live/path?transformer=ffc_photoshop
GET /adobecom/aem-live/path?transformer=flatten
```

## Response Format

The service returns JSON with this structure:

```json
{
  "metadata": {
    // Head metadata (title, meta tags, etc.)
  },
  "content": [
    {
      "metadata": {
        // Section metadata
      },
      "section": [
        // Blocks and content elements
      ]
    }
  ]
}
```

## Complete Examples

### Using Direct URL (Recommended)

```bash
# 1. Basic conversion with direct URL
curl "https://your-worker.com/?url=https://main--aem-boilerplate--adobe.aem.live"

# 2. Direct URL with custom domain
curl "https://your-worker.com/?url=https://your-custom-domain.com/path/to/content"

# 3. Direct URL with query parameters
curl "https://your-worker.com/?url=https://example.com/page&head=false&schema=true"

# 4. Direct URL with transformer
curl "https://your-worker.com/?url=https://example.com/page&transformer=ffc_photoshop"
```

### Using EDS Format (Legacy)

```bash
# 1. Basic conversion
curl https://your-worker.com/adobecom/aem-live/developer/markup-sections-blocks

# 2. Preview environment without head metadata
curl "https://your-worker.com/adobecom/aem-live/developer/markup-sections-blocks?preview=true&head=false"

# 3. With schema extraction and compact format
curl "https://your-worker.com/adobecom/aem-live/path?schema=true&compact=true"

# 4. With transformer
curl "https://your-worker.com/adobecom/aem-live/path?transformer=ffc_photoshop"
```

## Development

```bash
npm run dev    # Start local development server
npm run build  # Build the worker
npm run deploy # Deploy to Cloudflare
npm test       # Run tests
```

The worker will be available at `http://localhost:8787` during development.

## How It Works

1. Receives request → checks for `url` query parameter:
   - **If `url` parameter exists:** Uses the provided URL directly
   - **If no `url` parameter:** Parses path to extract `org`, `site`, and `contentPath` (legacy mode)
2. Fetches HTML from the determined URL:
   - Direct URL mode: Uses `url` parameter as-is
   - EDS format mode: Constructs `https://main--{site}--{org}.aem.{live|page}/{contentPath}`
3. Parses HTML using `rehype-parse` (converts to HAST - Hypertext Abstract Syntax Tree)
4. Extracts:
   - `<head>` metadata (optional, controlled by `?head=false`)
   - `<main>` content sections and blocks
5. Converts to JSON with section metadata and block content

**Notes:**
- The service uses the normal published EDS URL (not `plain.html`)
- Use `?preview=true` to access preview content (EDS format only)
- Direct URL mode works with any domain, including custom domains for migrated customers
