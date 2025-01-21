import type { Where } from '@loopback/repository';
import type { Set } from '../set';

declare module '@loopback/repository' {
  interface Inclusion {
    set?: Set;
    setThrough?: Set;
    whereThrough?: Where<any>;
  }
}
// Re-export types from @loopback/repository to ensure the augmentation is loaded
export type { Inclusion } from '@loopback/repository';
