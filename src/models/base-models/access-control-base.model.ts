import {model, property} from '@loopback/repository';
import {IdKindValidityBase} from './id-kind-validity-base.model';

/**
 * Inherits:
 * _id, _kind, _validFromDateTime, _validUntilDateTime
 * 
 * Adds:
 * _ownerUsers, _ownerGroups, _viewerUsers, _viewerGroups
 */
@model({
  settings: {
    strict: false
  }
})
export class AccessControlBase extends IdKindValidityBase {

  @property.array(String, {
    required: false,
    default: [],
  })
  _ownerUsers?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  _ownerGroups?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  _viewerUsers?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  _viewerGroups?: string[];

  @property({
    type: 'string',
    description:
      'public: anyone can see the record if validFromDateTime has a value. protected: only owner groups can see. private: only owner users can see.',
    default: 'protected',
    jsonSchema: {
      enum: ['public', 'protected', 'private'],
    },
  })
  _visibility?: string;

  constructor(data?: Partial<AccessControlBase>) {
    super(data);
  }
}
