import { BindingKey } from '@loopback/core';
import type { LookupConstraintService } from './lookup-constraint.service';

export const LookupConstraintBindings = {
  SERVICE: BindingKey.create<LookupConstraintService>(
    'services.lookup-constraint',
  ),
} as const;
