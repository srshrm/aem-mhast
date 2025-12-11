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

import { Element } from 'hast';
import { select, selectAll } from 'hast-util-select';
import { getText } from './utils';
import { Ctx } from './context';

// Constants for magic strings
const SCHEMA_CONSTANTS = {
  SELECTOR: 'x-eds-selector',
  ATTRIBUTE: 'x-eds-attribute',
  TEXT: 'text',
  TYPES: {
    ARRAY: 'array',
    OBJECT: 'object',
    STRING: 'string'
  }
} as const;

// TypeScript interfaces for better type safety
interface BaseSchemaProperty {
  type: string;
  description?: string;
  [SCHEMA_CONSTANTS.SELECTOR]?: string;
}

interface StringSchemaProperty extends BaseSchemaProperty {
  type: 'string';
  [SCHEMA_CONSTANTS.ATTRIBUTE]?: string;
  format?: string;
}

interface ObjectSchemaProperty extends BaseSchemaProperty {
  type: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface ArraySchemaProperty extends BaseSchemaProperty {
  type: 'array';
  items?: SchemaProperty;
}

type SchemaProperty = StringSchemaProperty | ObjectSchemaProperty | ArraySchemaProperty;

interface BlockSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: 'object';
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Fetch block schema from EDS domain.
 */
export async function fetchBlockSchema(blockName: string, ctx: Ctx): Promise<BlockSchema | null> {
  try {
    // Determine base domain: use edsDomainUrl if available, otherwise extract from sourceUrl
    let baseDomain = ctx.edsDomainUrl;
    if (!baseDomain && ctx.sourceUrl) {
      try {
        const sourceUrlObj = new URL(ctx.sourceUrl);
        baseDomain = `${sourceUrlObj.protocol}//${sourceUrlObj.hostname}`;
      } catch (error) {
        console.warn(`Failed to extract domain from sourceUrl: ${ctx.sourceUrl}`, error);
        return null;
      }
    }

    if (!baseDomain) {
      console.warn(`No domain available for fetching schema for block ${blockName}`);
      return null;
    }

    const schemaUrl = `${baseDomain}/blocks/${blockName}/${blockName}.schema.json`;

    const response = await fetch(schemaUrl);
    if (response.ok) {
      const schema = await response.json();
      return schema as BlockSchema;
    } else {
      console.warn(`Schema not found for block ${blockName} at ${schemaUrl} (${response.status})`);
      return null;
    }
  } catch (error) {
    console.warn(`Failed to fetch schema for block ${blockName}:`, error);
    return null;
  }
}

/**
 * Extract value from an element using attribute name or text content.
 */
function extractValueFromElement(element: Element, attributeName: string): string {
  if (attributeName === SCHEMA_CONSTANTS.TEXT) {
    return getText(element).trim();
  }

  if (element.properties?.[attributeName]) {
    return element.properties[attributeName] as string;
  }

  // Fallback to text content if attribute doesn't exist
  return getText(element).trim();
}

/**
 * Find element using selector within context, with fallback to shared element.
 */
function findElement(
  contextNode: Element,
  selector?: string,
  sharedElement?: Element | null
): Element | null {
  if (selector) {
    return select(selector, contextNode) as Element || null;
  }

  return sharedElement || null;
}

/**
 * Extract string value according to schema property definition.
 */
function extractStringValue(
  contextNode: Element,
  property: StringSchemaProperty,
  sharedElement?: Element | null,
  propertyName?: string
): string | null {
  const selector = property[SCHEMA_CONSTANTS.SELECTOR];

  // Find the element to extract from
  const element = findElement(contextNode, selector, sharedElement);
  if (!element) {
    // If no element found via selector/shared, use contextNode directly (for array items)
    if (!selector && !sharedElement) {
      // Default to property name for attribute extraction, fallback to 'text'
      const attributeName = property[SCHEMA_CONSTANTS.ATTRIBUTE] || propertyName || SCHEMA_CONSTANTS.TEXT;
      const value = extractValueFromElement(contextNode, attributeName);
      return value || null;
    }
    return null;
  }

  // Default to property name for attribute extraction, fallback to 'text'
  const attributeName = property[SCHEMA_CONSTANTS.ATTRIBUTE] || propertyName || SCHEMA_CONSTANTS.TEXT;
  const value = extractValueFromElement(element, attributeName);

  return value || null;
}

/**
 * Extract array values according to schema property definition.
 */
function extractArrayValue(
  contextNode: Element,
  property: ArraySchemaProperty
): unknown[] | null {
  const selector = property[SCHEMA_CONSTANTS.SELECTOR];
  if (!selector || !property.items) {
    return null;
  }

  const elements = selectAll(selector, contextNode) as Element[];
  if (elements.length === 0) {
    return null;
  }

  const results = elements
    .map((element, index) => {
      const result = extractSchemaValue(element, property.items!, null);
      return result;
    })
    .filter(Boolean);

  return results.length > 0 ? results : null;
}

/**
 * Extract object values according to schema property definition.
 */
function extractObjectValue(
  contextNode: Element,
  property: ObjectSchemaProperty
): Record<string, unknown> | null {
  if (!property.properties) {
    return null;
  }

  const result: Record<string, unknown> = {};
  const objectSelector = property[SCHEMA_CONSTANTS.SELECTOR];
  let sharedElement: Element | null = null;

  // Find shared element once if object has a selector
  if (objectSelector) {
    sharedElement = select(objectSelector, contextNode) as Element || null;
  }

  for (const [propName, propSchema] of Object.entries(property.properties)) {
    // Use sharedElement as context if available, otherwise use original context
    const extractionContext = sharedElement || contextNode;
    const value = extractSchemaValue(extractionContext, propSchema, sharedElement, propName);
    if (value !== null) {
      result[propName] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract value using schema selector and property definition.
 * Main recursive function that delegates to type-specific handlers.
 */
function extractSchemaValue(
  contextNode: Element,
  property: SchemaProperty,
  sharedElement?: Element | null,
  propertyName?: string
): unknown | null {
  // Input validation
  if (!contextNode || !property || !property.type) {
    return null;
  }

  const propertyType = property.type;

  switch (propertyType) {
    case SCHEMA_CONSTANTS.TYPES.STRING:
      return extractStringValue(contextNode, property as StringSchemaProperty, sharedElement, propertyName);

    case SCHEMA_CONSTANTS.TYPES.ARRAY:
      return extractArrayValue(contextNode, property as ArraySchemaProperty);

    case SCHEMA_CONSTANTS.TYPES.OBJECT:
      return extractObjectValue(contextNode, property as ObjectSchemaProperty);

    default:
      console.warn(`Unsupported schema type: ${propertyType}`);
      return null;
  }
}

/**
 * Extract structured data from block using schema.
 */
export function extractBlockWithSchema(
  blockNode: Element,
  schema: BlockSchema,
  blockName: string
): Record<string, unknown> | null {
  // Input validation
  if (!blockNode || !schema || !schema.properties) {
    console.warn(`Invalid input for extractBlockWithSchema: blockName=${blockName}`);
    return null;
  }

  const data: Record<string, unknown> = {};

  for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
    try {
      const value = extractSchemaValue(blockNode, propertySchema, null, propertyName);
      if (value !== null) {
        data[propertyName] = value;
      }
    } catch (error) {
      console.warn(`Error extracting property ${propertyName} for block ${blockName}:`, error);
      // Continue processing other properties
    }
  }

  return Object.keys(data).length > 0 ? data : null;
}
