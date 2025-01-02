import {Entity, model, property} from '@loopback/repository';

/**
 * All models that have id field are extending this model.
 */
@model({
  settings: {
    strict: false
  }
})
export class ModelWithIdBase extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    defaultFn: 'uuidv4',
  })
  _id?: string;

  constructor(data?: Partial<ModelWithIdBase>) {
    super(data);
  }
}
