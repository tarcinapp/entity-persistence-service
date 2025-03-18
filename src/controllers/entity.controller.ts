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
  RestBindings,
  Request,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { GenericEntity, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { EntityRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class EntityController {
  constructor(
    @repository(EntityRepository)
    public entityRepository: EntityRepository,
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @inject('services.LoggingService') private logger: LoggingService,
  ) {}

  @post('/entities', {
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
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<GenericEntity> {
    return this.entityRepository.create(genericEntity);
  }

  @get('/entities/count', {
    responses: {
      '200': {
        description: 'Entity model count',
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

    return this.entityRepository.count(filter.where);
  }

  @get('/entities', {
    responses: {
      '200': {
        description: 'Array of Entity model instances',
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
    @param.query.object('filter', getFilterSchemaFor(GenericEntity))
    filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.entityRepository.find(filter);
  }

  @patch('/entities', {
    responses: {
      '200': {
        description: 'Entity PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewEntity',
            partial: true,
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

    return this.entityRepository.updateAll(genericEntity, filter.where);
  }

  @get('/entities/{id}', {
    responses: {
      '200': {
        description: 'Entity model instance',
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
    @param.query.object('filter', getFilterSchemaFor(GenericEntity))
    filter?: FilterExcludingWhere<GenericEntity>,
  ): Promise<GenericEntity> {
    sanitizeFilterFields(filter);

    return this.entityRepository.findById(id, filter);
  }

  @patch('/entities/{id}', {
    responses: {
      '204': {
        description: 'Entity PATCH success',
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
            title: 'PatchEntity',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityRepository.updateById(id, genericEntity);
  }

  @put('/entities/{id}', {
    responses: {
      '204': {
        description: 'Entity PUT success',
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
            title: 'ReplaceEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityRepository.replaceById(id, genericEntity);
  }

  @del('/entities/{id}', {
    responses: {
      '204': {
        description: 'Entity DELETE success',
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
    await this.entityRepository.deleteById(id);
  }

  @get('/entities/{id}/parents', {
    responses: {
      '200': {
        description: 'Array of parent Entity model instances',
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
  async findParents(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(GenericEntity))
    filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.entityRepository.findParents(id, filter);
  }

  @get('/entities/{id}/children', {
    responses: {
      '200': {
        description: 'Array of child Entity model instances',
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
  async findChildren(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('filter', getFilterSchemaFor(GenericEntity))
    filter?: Filter<GenericEntity>,
  ): Promise<GenericEntity[]> {
    if (set) {
      filter = new SetFilterBuilder<GenericEntity>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.entityRepository.findChildren(id, filter);
  }

  @post('/entities/{id}/children', {
    responses: {
      '200': {
        description: 'Child Entity model instance',
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
        description: 'Parent entity not found',
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
  async createChild(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(GenericEntity, {
            title: 'NewChildEntity',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_parents',
            ] as (keyof GenericEntity)[],
            includeRelations: false,
          }),
        },
      },
    })
    genericEntity: Omit<GenericEntity, UnmodifiableCommonFields | '_parents'>,
  ): Promise<GenericEntity> {
    return this.entityRepository.createChild(id, genericEntity);
  }
}
