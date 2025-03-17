import type { MiddlewareContext } from '@loopback/rest';

export interface Middleware {
  handle(context: MiddlewareContext, next: () => Promise<any>): Promise<any>;
}
