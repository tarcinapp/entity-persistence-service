import {model, property} from '@loopback/repository';
import {ModelWithIdBase} from './model-with-id-base.model';

/**
 * Inherits:
 * _id
 * 
 * Adds:
 * _kind, _validFromDateTime, _validUntilDateTime
 */
@model({
  settings: {
    strict: false
  }
})
export class IdKindValidityBase extends ModelWithIdBase {

  @property({
    type: 'string',
    required: true,
  })
  _kind: string;

  @property({
    type: 'date',
    description: 'This is the approval time.' +
      'Only those records with validFromDateTime property has a value can be' +
      'seen by other members.' +
      'If caller is not a member at the creation time, this field is filled' +
      'automatically by the server.',
    default: null,
    jsonSchema: {nullable: true}
  })
  _validFromDateTime?: string;

  @property({
    type: 'date',
    description: 'This field indicates if the rcord is currently active.',
    default: null,
    jsonSchema: {nullable: true}
  })
  _validUntilDateTime?: string | null;

  constructor(data?: Partial<IdKindValidityBase>) {
    super(data);
  }
}
