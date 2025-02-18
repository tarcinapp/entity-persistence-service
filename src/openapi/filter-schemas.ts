import type { Model } from '@loopback/repository';
import type { SchemaObject } from '@loopback/rest';

export function getFilterSchemaFor(modelRef: typeof Model): SchemaObject {
  const baseSchema: SchemaObject = {
    type: 'object' as const,
    title: `${modelRef.name}Filter`,
    properties: {
      where: { type: 'object' as const },
      fields: { type: 'object' as const },
      offset: { type: 'integer' as const, minimum: 0 },
      limit: { type: 'integer' as const, minimum: 1 },
      skip: { type: 'integer' as const, minimum: 0 },
      order: {
        oneOf: [
          { type: 'string' as const },
          { type: 'array' as const, items: { type: 'string' as const } },
        ],
      },
      include: { type: 'array' as const, items: { type: 'object' as const } },
      lookup: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            prop: { type: 'string' as const },
            scope: {
              type: 'object' as const,
              properties: {
                fields: {
                  type: 'object' as const,
                  additionalProperties: { type: 'boolean' as const },
                },
                where: {
                  type: 'object' as const,
                  additionalProperties: true,
                },
                limit: {
                  type: 'integer' as const,
                  minimum: 0,
                },
                skip: {
                  type: 'integer' as const,
                  minimum: 0,
                },
                order: {
                  oneOf: [
                    { type: 'string' as const },
                    {
                      type: 'array' as const,
                      items: { type: 'string' as const },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    additionalProperties: false,
  };

  return baseSchema;
}
