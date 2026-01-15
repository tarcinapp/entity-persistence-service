import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  Options,
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
import { transactional } from '../decorators';
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
  ALWAYS_HIDDEN_FIELDS,
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
    operationId: 'findEntitiesByListId',
    responses: {
      '200': {
        description: 'Array of Entity model instances through List',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(GenericEntity, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof GenericEntity)[],
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

    const repo = await this.listRepository.entities(id);

    return repo.find(filter, filterThrough);
  }

  @transactional()
  @post('/lists/{id}/entities', {
    operationId: 'createEntityByListId',
    responses: {
      '200': {
        description: 'Entity model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericEntity, {
              exclude: [...ALWAYS_HIDDEN_FIELDS, '_relationMetadata'] as (keyof GenericEntity)[],
            }),
          },
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
    @inject('active.transaction.options', { optional: true })
    options: any = {},
  ): Promise<GenericEntity> {
    const repo = await this.listRepository.entities(id);

    return repo.create(entity, options);
  }

  @transactional()
  @patch('/lists/{id}/entities', {
    operationId: 'updateEntitiesByListId',
    responses: {
      '200': {
        description: 'List.entities PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
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
    @param.query.object('set')
    set?: Set,

    @param.query.object('where', getWhereSchemaFor(GenericEntity))
    where?: Where<GenericEntity>,

    @param.query.object('setThrough')
    setThrough?: Set,

    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,

    @inject('active.transaction.options', { optional: true })
    options: any = {},
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericEntity>();
    const filterThroughBuilder = new FilterBuilder<ListToEntityRelation>();
    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    if (whereThrough) {
      filterThroughBuilder.where(whereThrough);
    }

    let filterThrough = filterThroughBuilder.build();

    if (setThrough) {
      filterThrough = new SetFilterBuilder<ListToEntityRelation>(setThrough, {
        filter: filterThrough,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(filterThrough);

    const repo = await this.listRepository.entities(id);

    return repo.updateAll(entity, filter.where, filterThrough.where, options);
  }

  @transactional()
  @del('/lists/{id}/entities', {
    operationId: 'deleteEntitiesByListId',
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
    @param.query.object('setThrough') setThrough?: Set,
    @param.query.object('whereThrough')
    whereThrough?: Where<ListToEntityRelation>,
    @inject('active.transaction.options', { optional: true })
    options: any = {},
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<GenericEntity>();
    const filterThroughBuilder = new FilterBuilder<ListToEntityRelation>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    if (whereThrough) {
      filterThroughBuilder.where(whereThrough);
    }

    let filterThrough = filterThroughBuilder.build();

    if (setThrough) {
      filterThrough = new SetFilterBuilder<ListToEntityRelation>(setThrough, {
        filter: filterThrough,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(filterThrough);

    const repo = await this.listRepository.entities(id);

    return repo.deleteAll(filter.where, filterThrough.where, options);
  }
}
