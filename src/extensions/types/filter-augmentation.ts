import type { Where } from '@loopback/repository';

// Define the structure for lookup property configuration
export interface LookupScope<T extends object = object> {
  prop: string;
  scope?: {
    fields?: { [key: string]: boolean };
    where?: Where<T>;
    limit?: number;
    skip?: number;
    order?: string[];
    // Support nested lookups
    lookup?: LookupScope<T>[];
  };
}

declare module '@loopback/repository' {
  interface Filter<MT> {
    lookup?: LookupScope<MT>[];
  }
}

// Re-export Inclusion type for convenience
export type { Inclusion } from '@loopback/repository';
