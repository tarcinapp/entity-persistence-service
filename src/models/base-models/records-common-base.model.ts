import {model, property} from '@loopback/repository';
import {IdKindValidityBase} from './id-kind-validity-base.model';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime
 *
 *  Adds:
 * _version, _createdDateTime, _createdBy, _lastUpdatedDateTime, _lastUpdatedBy, _idempotencyKey
 */
@model({
  settings: {
    strict: false
  }
})
export class RecordsCommonBase extends IdKindValidityBase {

  @property({
    type: 'date',
    description: 'This field is filled by server at the time of the creation of the record.',
  })
  _createdDateTime?: string;

  @property({
    required: false,
    type: 'string',
  })
  _createdBy?: string;

  @property({
    required: false,
    type: 'date',
  })
  _lastUpdatedDateTime?: string;

  @property({
    required: false,
    type: 'string',
  })
  _lastUpdatedBy?: string;

  @property({
    type: 'string',
  })
  _idempotencyKey?: string | undefined;

  @property({
    required: false,
    type: 'number',
    default: 1,
  })
  _version?: number;

  constructor(data?: Partial<RecordsCommonBase>) {
    super(data);
  }
}
