import type { Model } from '@loopback/repository';
import type { SchemaObject } from '@loopback/rest';

/**
 * Scope object shared by both LookupFilter and InclusionFilter.
 * Inlined at every nesting level to avoid $ref usage, which AJV cannot
 * resolve when the schema is compiled as a standalone parameter schema
 * (AJV's '#' root is the parameter schema object, not the full OAS document).
 */
function makeLookupScope(depth: number): SchemaObject {
  const scopeProps: Record<string, SchemaObject> = {
    fields: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
    where: {
      type: 'object',
      additionalProperties: true,
    },
    limit: { type: 'integer', minimum: 0 },
    skip: { type: 'integer', minimum: 0 },
    order: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } },
      ],
    },
  };

  // Add one more level of nesting unless we've hit the depth limit
  if (depth > 0) {
    scopeProps.lookup = {
      type: 'array',
      items: makeLookupFilter(depth - 1),
    };
  }

  return { type: 'object', properties: scopeProps };
}

function makeLookupFilter(depth: number): SchemaObject {
  return {
    type: 'object',
    properties: {
      prop: { type: 'string' },
      set: { type: 'object', additionalProperties: true },
      scope: makeLookupScope(depth),
    },
  };
}

function makeInclusionScope(depth: number): SchemaObject {
  const scopeProps: Record<string, SchemaObject> = {
    fields: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
    where: {
      type: 'object',
      additionalProperties: true,
    },
    limit: { type: 'integer', minimum: 0 },
    skip: { type: 'integer', minimum: 0 },
    order: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } },
      ],
    },
  };

  if (depth > 0) {
    scopeProps.include = {
      type: 'array',
      items: makeInclusionFilter(depth - 1),
    };
  }

  return { type: 'object', properties: scopeProps };
}

function makeInclusionFilter(depth: number): SchemaObject {
  return {
    oneOf: [
      { type: 'string' },
      {
        type: 'object',
        properties: {
          relation: { type: 'string' },
          set: { type: 'object', additionalProperties: true },
          setThrough: { type: 'object', additionalProperties: true },
          whereThrough: { type: 'object', additionalProperties: true },
          scope: makeInclusionScope(depth),
        },
      },
    ],
  };
}

// Max observed nesting depth in tests and production usage is 2
// (e.g. filter[lookup][0][scope][lookup][0][scope][lookup][0]).
// 3 levels gives one extra margin without schema bloat.
const RECURSION_DEPTH = 3;

export function getFilterSchemaFor(modelRef: typeof Model): SchemaObject {
  return {
    type: 'object',
    title: `${modelRef.name}Filter`,
    properties: {
      where: { type: 'object' },
      fields: { type: 'object' },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1 },
      skip: { type: 'integer', minimum: 0 },
      order: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      include: {
        type: 'array',
        items: makeInclusionFilter(RECURSION_DEPTH),
      },
      lookup: {
        type: 'array',
        items: makeLookupFilter(RECURSION_DEPTH),
      },
    },
    additionalProperties: false,
  };
}
