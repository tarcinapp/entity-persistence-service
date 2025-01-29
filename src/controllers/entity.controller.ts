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
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { GenericEntity, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { GenericEntityRepository } from '../repositories';

export class GenericEntityController {
  constructor(
    @repository(GenericEntityRepository)
    public genericEntityRepository: GenericEntityRepository,
  ) {}

  @post('/entities', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
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
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewGenericEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<GenericEntity> {
    return this.genericEntityRepository.create(genericEntity);
  }

  @get('/entities/count', {
    responses: {
      '200': {
        description: 'GenericEntity model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(GenericEntity) where?: Where<GenericEntity>,
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

    return this.genericEntityRepository.count(filter.where);
  }

  @get('/entities', {
    responses: {
      '200': {
        description: 'Array of GenericEntity model instances',
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
    },
  })
  async find(
    @param.query.object('set') set?: Set,
    @param.filter(GenericEntity) filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.genericEntityRepository.find(filter);
  }

  @patch('/entities', {
    responses: {
      '200': {
        description: 'GenericEntity PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewGenericEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(GenericEntity) where?: Where<GenericEntity>,
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

    return this.genericEntityRepository.updateAll(genericEntity, filter.where);
  }

  @get('/entities/{id}', {
    responses: {
      '200': {
        description: 'GenericEntity model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(GenericEntity, {
              includeRelations: true,
            }),
          },
        },
      },
    },
    '404': {
      description: 'Entity not found',
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
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(GenericEntity, { exclude: 'where' })
    filter?: FilterExcludingWhere<GenericEntity>,
  ): Promise<GenericEntity> {
    return this.genericEntityRepository.findById(id, filter);
  }

  @patch('/entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity PATCH success',
      },
      '404': {
        description: 'Entity not found',
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
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'PatchGenericEntity',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.genericEntityRepository.updateById(id, genericEntity);
  }

  @put('/entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity PUT success',
      },
      '404': {
        description: 'Entity not found',
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
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'ReplaceGenericEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.genericEntityRepository.replaceById(id, genericEntity);
  }

  @del('/entities/{id}', {
    responses: {
      '204': {
        description: 'GenericEntity DELETE success',
      },
      '404': {
        description: 'Entity not found',
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
    await this.genericEntityRepository.deleteById(id);
  }
}
