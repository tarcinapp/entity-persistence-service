import { BindingKey } from '@loopback/core';
import type { RecordLimitCheckerService } from './record-limit-checker.service';

export const RecordLimitCheckerBindings = {
  SERVICE: BindingKey.create<RecordLimitCheckerService>(
    'services.record-limit-checker',
  ),
} as const;
