import { inject } from '@loopback/context';
import {
  Count,
  CountSchema,
  Filter,
  FilterBuilder,
  FilterExcludingWhere,
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
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { ListToEntityRelation, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { ListEntityRelationRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class ListEntityRelController {
  constructor(
    @repository(ListEntityRelationRepository)
    public listEntityRelationRepository: ListEntityRelationRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
    @inject(RestBindings.Http.REQUEST)
    private req: Request,
  ) {}

  @post('/list-entity-relations', {
    responses: {
      '200': {
        description: '  ListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation),
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
  ): Promise<ListToEntityRelation> {
    this.logger.debug(
      'Creating new list-entity relation',
      {
        listEntityRelation,
      },
      this.req,
    );

    const result =
      await this.listEntityRelationRepository.create(listEntityRelation);

    this.logger.info(
      'List-entity relation created successfully',
      {
        relationId: result._id,
      },
      this.req,
    );

    return result;
  }

  @get('/list-entity-relations/count', {
    responses: {
      '200': {
        description: 'ListEntityRelation model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.where(ListToEntityRelation)
    where?: Where<ListToEntityRelation>,
    @param.query.object('set') set?: Set,
  ): Promise<Count> {
    this.logger.debug(
      'Counting list-entity relations',
      { set, where },
      this.req,
    );

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

    const result = await this.listEntityRelationRepository.count(filter.where);

    this.logger.info(
      'List-entity relations counted successfully',
      {
        count: result.count,
      },
      this.req,
    );

    return result;
  }

  @get('/list-entity-relations', {
    responses: {
      '200': {
        description: 'Array of ListEntityRelation model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ListToEntityRelation, {
                includeRelations: true,
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
  ): Promise<ListToEntityRelation[]> {
    this.logger.debug(
      'Finding list-entity relations',
      { set, filter },
      this.req,
    );

    if (set) {
      filter = new SetFilterBuilder<ListToEntityRelation>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    const result = await this.listEntityRelationRepository.find(filter);

    this.logger.info(
      'List-entity relations found successfully',
      {
        count: result.length,
      },
      this.req,
    );

    return result;
  }

  @patch('/list-entity-relations', {
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
    );
  }

  @get('/list-entity-relations/{id}', {
    responses: {
      '200': {
        description: 'ListEntityRelation model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(ListToEntityRelation, {
              includeRelations: true,
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

  @patch('/list-entity-relations/{id}', {
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
  ): Promise<void> {
    await this.listEntityRelationRepository.updateById(id, listEntityRelation);
  }

  @put('/list-entity-relations/{id}', {
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
  ): Promise<void> {
    await this.listEntityRelationRepository.replaceById(id, listEntityRelation);
  }

  @del('/list-entity-relations/{id}', {
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
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.listEntityRelationRepository.deleteById(id);
  }
}
