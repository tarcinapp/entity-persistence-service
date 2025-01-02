import {model} from '@loopback/repository';
import {RecordBaseModel} from './record-base.model';

@model({
  settings: {
    strict: false
  }
})
export class GenericEntityBaseModel extends RecordBaseModel {
  // No additional fields, simply inherit from BaseEntityModel
}
