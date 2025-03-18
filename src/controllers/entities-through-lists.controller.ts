import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getJsonSchema,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
  RestBindings,
  Request,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import {
  GenericEntity,
  List,
  ListToEntityRelation,
  HttpErrorResponse,
} from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { ListRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class EntitiesThroughListController {
  constructor(
    @repository(ListRepository)
    protected listRepository: ListRepository,
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject('services.LoggingService') private logger: LoggingService,
  ) {}

  @get('/lists/{id}/entities', {
    responses: {
      '200': {
        description: 'Array of Entity model instances through List',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericEntity, {
                includeRelations: true,
              }),
            },
          },
        },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter') filter?: Filter<GenericEntity>,
    @param.query.object('setThrough') setThrough?: Set,
    @param.query.object('filterThrough')
    filterThrough?: Filter<ListToEntityRelation>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    if (setThrough) {
      filterThrough = new SetFilterBuilder<ListToEntityRelation>(setThrough, {
        filter: filterThrough,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(filterThrough);

    return this.listRepository.entities(id).find(filter, filterThrough);
  }

  @post('/lists/{id}/entities', {
    responses: {
      '200': {
        description: 'Entity model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(GenericEntity) },
        },
      },
      '429': {
        description: 'Entity limit is exceeded',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '409': {
        description: 'Entity name already exists.',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof List.prototype._id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewEntityInList',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    entity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<GenericEntity> {
    return this.listRepository.entities(id).create(entity);
  }

  @patch('/lists/{id}/entities', {
    responses: {
      '200': {
        description: 'List.Entity PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
      '422': {
        description: 'Unprocessable entity',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'PatchEntityInList',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    entity: Partial<GenericEntity>,
    @param.query.object('where', getWhereSchemaFor(GenericEntity))
    where?: Where<GenericEntity>,
    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,
  ): Promise<Count> {
    return this.listRepository
      .entities(id)
      .updateAll(entity, where, whereThrough);
  }

  @del('/lists/{id}/entities', {
    responses: {
      '200': {
        description: 'List.Entity DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'List not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getJsonSchema(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('where', getWhereSchemaFor(GenericEntity))
    where?: Where<GenericEntity>,
    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericEntity>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    return this.listRepository
      .entities(id)
      .deleteAll(filter.where, whereThrough);
  }
}
