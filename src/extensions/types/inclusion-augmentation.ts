import '@loopback/repository';
import type { Where } from '@loopback/repository';
import type { Set } from '../set';

declare module '@loopback/repository' {
  interface Inclusion {
    set?: Set;
    setThrough?: Set;
    whereThrough?: Where<any>;
  }
}

// Export an empty object to make this a module
export {};
