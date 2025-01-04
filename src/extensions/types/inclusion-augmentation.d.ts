import '@loopback/repository';
import {Set} from '../set';

// Extend the Inclusion interface
declare module '@loopback/repository' {
  export interface Inclusion {
    set?: Set; // Define the new optional 'set' field
  }
}
