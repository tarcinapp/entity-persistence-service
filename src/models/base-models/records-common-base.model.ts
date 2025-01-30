import { Entity, model, property } from '@loopback/repository';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime
 *
 *  Adds:
 * _version, _createdDateTime, _createdBy, _lastUpdatedDateTime, _lastUpdatedBy, _idempotencyKey
 */
@model({
  settings: {
    strict: false,
  },
})
export class RecordsCommonBase extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: 'uuidv4',
  })
  _id: string;

  @property({
    type: 'string',
    required: false,
  })
  _kind?: string;

  @property({
    type: 'date',
    description:
      'This is the approval time.' +
      'Only those records with validFromDateTime property has a value can be' +
      'seen by other members.' +
      'If caller is not a member at the creation time, this field is filled' +
      'automatically by the server.',
    default: null,
    jsonSchema: { nullable: true },
  })
  _validFromDateTime?: string;

  @property({
    type: 'date',
    description: 'This field indicates if the rcord is currently active.',
    default: null,
    jsonSchema: { nullable: true },
  })
  _validUntilDateTime?: string | null;

  @property({
    type: 'date',
    description:
      'This field is filled by server at the time of the creation of the record.',
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
    hidden: true,
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
