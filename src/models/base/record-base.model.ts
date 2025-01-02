
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false
  }
})
export class RecordBaseModel extends Entity {

  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: 'uuidv4',
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  kind: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 2
    },
  })
  name: string;

  @property({
    type: 'string',
    required: false,
  })
  slug: string;

  @property({
    type: 'date',
    description: 'This field is filled by server at the time of the creation of the record.',
  })
  creationDateTime?: string;

  @property({
    required: false,
    type: 'date',
  })
  lastUpdatedDateTime?: string;

  @property({
    type: 'date',
    description:
      'This is the record approval time. Only those records with validFromDateTime can be seen by other members.',
    default: null,
    jsonSchema: {nullable: true},
  })
  validFromDateTime?: string;

  @property({
    type: 'date',
    description: 'This field indicates if the record is currently active.',
    default: null,
    jsonSchema: {nullable: true},
  })
  validUntilDateTime?: string | null;

  @property({
    type: 'string',
    description:
      'public: anyone can see the record if validFromDateTime has a value. protected: only owner groups can see. private: only owner users can see.',
    default: 'protected',
    jsonSchema: {
      enum: ['public', 'protected', 'private'],
    },
  })
  visibility?: string;

  @property({
    required: false,
    type: 'number',
    default: 1,
  })
  version?: number;

  @property({
    required: false,
    type: 'string',
  })
  lastUpdatedBy?: string;

  @property({
    required: false,
    type: 'string',
  })
  createdBy?: string;

  @property.array(String, {
    required: false,
    default: [],
  })
  ownerUsers?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  ownerGroups?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  viewerUsers?: string[];

  @property.array(String, {
    required: false,
    default: [],
  })
  viewerGroups?: string[];

  @property({
    type: 'number',
    default: 0,
  })
  ownerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  ownerGroupsCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  viewerUsersCount?: number;

  @property({
    type: 'number',
    default: 0,
  })
  viewerGroupsCount?: number;

  @property({
    type: 'string',
  })
  idempotencyKey?: string | undefined;

  // Loose properties for additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<RecordBaseModel>) {
    super(data);
  }
}
