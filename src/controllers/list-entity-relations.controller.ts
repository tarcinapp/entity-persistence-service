import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
  Options,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getJsonSchema,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  Request,
  RestBindings,
} from '@loopback/rest';
import { transactional } from '../decorators';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { ListToEntityRelation, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
  ALWAYS_HIDDEN_FIELDS,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { ListEntityRelationRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class ListEntityRelsController {
  constructor(
    @repository(ListEntityRelationRepository)
    public listEntityRelationRepository: ListEntityRelationRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
    @inject(RestBindings.Http.REQUEST)
    private req: Request,
  ) {}

  @transactional()
  @post('/relations', {
    operationId: 'createRelation',
    responses: {
      '200': {
        description: 'ListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation, {
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListToEntityRelation)[],
            }),
          },
        },
      },
      '429': {
        description: 'Relation limit is exceeded',
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
        description: 'Relation already exists.',
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
        description: 'List or Entity not found',
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
        description: 'Unprocessable relation',
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
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            title: 'NewListEntityRelation',
            exclude:
              UNMODIFIABLE_COMMON_FIELDS as (keyof ListToEntityRelation)[],
            includeRelations: false,
          }),
        },
      },
    })
    listEntityRelation: Omit<ListToEntityRelation, UnmodifiableCommonFields>,
    @inject('active.transaction.options', { optional: true })
    options: Options = {},
  ): Promise<ListToEntityRelation> {
    return this.listEntityRelationRepository.create(
      listEntityRelation,
      options,
    );
  }

  @get('/relations/count', {
    operationId: 'countRelations',
    responses: {
      '200': {
        description: 'ListEntityRelation model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(ListToEntityRelation)
    where?: Where<ListToEntityRelation>,
    @param.query.object('listWhere')
    listWhere?: Where<ListToEntityRelation>,
    @param.query.object('listSet')
    listSet?: Set,
    @param.query.object('entityWhere')
    entityWhere?: Where<ListToEntityRelation>,
    @param.query.object('entitySet')
    entitySet?: Set,
  ): Promise<Count> {
    // Build relation filter
    const filterBuilder = new FilterBuilder<ListToEntityRelation>();
    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();
    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    // Build list filter
    const listFilterBuilder = new FilterBuilder<ListToEntityRelation>();
    if (listWhere) {
      listFilterBuilder.where(listWhere);
    }

    let listFilter = listFilterBuilder.build();
    if (listSet) {
      listFilter = new SetFilterBuilder<ListToEntityRelation>(listSet, {
        filter: listFilter,
      }).build();
    }

    // Build entity filter
    const entityFilterBuilder = new FilterBuilder<ListToEntityRelation>();
    if (entityWhere) {
      entityFilterBuilder.where(entityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (entitySet) {
      entityFilter = new SetFilterBuilder<ListToEntityRelation>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(listFilter);
    sanitizeFilterFields(entityFilter);

    return this.listEntityRelationRepository.count(
      filter.where,
      listFilter.where,
      entityFilter.where,
      undefined,
    );
  }

  @get('/relations', {
    operationId: 'findRelations',
    responses: {
      '200': {
        description: 'Array of ListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListToEntityRelation, {
                includeRelations: true,
                exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListToEntityRelation)[],
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(ListToEntityRelation))
    filter?: Filter<ListToEntityRelation>,
    @param.query.object('listFilter', getFilterSchemaFor(ListToEntityRelation))
    listFilter?: Filter<ListToEntityRelation>,
    @param.query.object('listSet')
    listSet?: Set,
    @param.query.object(
      'entityFilter',
      getFilterSchemaFor(ListToEntityRelation),
    )
    entityFilter?: Filter<ListToEntityRelation>,
    @param.query.object('entitySet')
    entitySet?: Set,
  ): Promise<ListToEntityRelation[]> {
    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    if (entitySet) {
      entityFilter = new SetFilterBuilder<ListToEntityRelation>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    if (listSet) {
      listFilter = new SetFilterBuilder<ListToEntityRelation>(listSet, {
        filter: listFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);
    sanitizeFilterFields(listFilter);

    return this.listEntityRelationRepository.find(
      filter,
      entityFilter,
      listFilter,
    );
  }

  @transactional()
  @patch('/relations', {
    operationId: 'updateRelations',
    responses: {
      '200': {
        description: 'ListEntityRelation PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            exclude:
              UNMODIFIABLE_COMMON_FIELDS as (keyof ListToEntityRelation)[],
            includeRelations: false,
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: Omit<ListToEntityRelation, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(ListToEntityRelation)
    where?: Where<ListToEntityRelation>,
    @inject('active.transaction.options', { optional: true })
    options: Options = {},
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<ListToEntityRelation>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    return this.listEntityRelationRepository.updateAll(
      listEntityRelation,
      filter.where,
      options,
    );
  }

  @get('/relations/{id}', {
    operationId: 'findRelationById',
    responses: {
      '200': {
        description: 'ListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation, {
              includeRelations: true,
              exclude: ALWAYS_HIDDEN_FIELDS as (keyof ListToEntityRelation)[],
            }),
          },
        },
      },
      '404': {
        description: 'List-entity relation not found',
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
  async findById(
    @param.path.string('id') id: string,
    @param.query.object('filter', getFilterSchemaFor(ListToEntityRelation))
    filter?: FilterExcludingWhere<ListToEntityRelation>,
  ): Promise<ListToEntityRelation> {
    sanitizeFilterFields(filter);

    return this.listEntityRelationRepository.findById(id, filter);
  }

  @transactional()
  @patch('/relations/{id}', {
    operationId: 'updateRelationById',
    responses: {
      '204': {
        description: 'ListEntityRelation PATCH success',
      },
      '404': {
        description: 'List-entity relation not found',
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
        description: 'Unprocessable relation',
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
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            title: 'PatchListEntityRelation',
            exclude:
              UNMODIFIABLE_COMMON_FIELDS as (keyof ListToEntityRelation)[],
            includeRelations: false,
            partial: true,
          }),
        },
      },
    })
    listEntityRelation: Omit<ListToEntityRelation, UnmodifiableCommonFields>,
    @inject('active.transaction.options', { optional: true })
    options: Options = {},
  ): Promise<void> {
    await this.listEntityRelationRepository.updateById(
      id,
      listEntityRelation,
      options,
    );
  }

  @transactional()
  @put('/relations/{id}', {
    operationId: 'replaceRelationById',
    responses: {
      '204': {
        description: 'ListEntityRelation PUT success',
      },
      '404': {
        description: 'List-entity relation not found',
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
        description: 'Unprocessable relation',
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
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ListToEntityRelation, {
            title: 'ReplaceListEntityRelation',
            exclude:
              UNMODIFIABLE_COMMON_FIELDS as (keyof ListToEntityRelation)[],
            includeRelations: false,
          }),
        },
      },
    })
    listEntityRelation: Omit<ListToEntityRelation, UnmodifiableCommonFields>,
    @inject('active.transaction.options', { optional: true })
    options: Options = {},
  ): Promise<void> {
    await this.listEntityRelationRepository.replaceById(
      id,
      listEntityRelation,
      options,
    );
  }

  @transactional()
  @del('/relations/{id}', {
    operationId: 'deleteRelationById',
    responses: {
      '204': {
        description: 'ListEntityRelation DELETE success',
      },
      '404': {
        description: 'List-entity relation not found',
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
  async deleteById(
    @param.path.string('id') id: string,
    @inject('active.transaction.options', { optional: true })
    options: Options = {},
  ): Promise<void> {
    await this.listEntityRelationRepository.deleteById(id, options);
  }
}
