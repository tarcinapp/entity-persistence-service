import { inject } from '@loopback/core';
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
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  getJsonSchema,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { EntityReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { getFilterSchemaFor } from '../openapi/filter-schemas';
import { EntityReactionsRepository } from '../repositories';
import { LoggingService } from '../services/logging.service';

export class EntityReactionController {
  constructor(
    @repository(EntityReactionsRepository)
    public entityReactionsRepository: EntityReactionsRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @post('/entity-reactions', {
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(EntityReaction) },
        },
      },
      '429': {
        description: 'Entity reaction limit is exceeded',
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
        description: 'Entity reaction already exists.',
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
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewEntityReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.create(entityReaction);
  }

  @get('/entity-reactions/count', {
    responses: {
      '200': {
        description: 'EntityReaction model count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async count(
    @param.query.object('set') set?: Set,
    @param.where(EntityReaction) where?: Where<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.where(EntityReaction) entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<EntityReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build entity filter
    const entityFilterBuilder = new FilterBuilder<EntityReaction>();
    if (entityWhere) {
      entityFilterBuilder.where(entityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.count(
      filter.where,
      entityFilter.where,
    );
  }

  @get('/entity-reactions', {
    responses: {
      '200': {
        description: 'Array of EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
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
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.query.object('entityFilter', getFilterSchemaFor(EntityReaction))
    entityFilter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.find(filter, entityFilter);
  }

  @patch('/entity-reactions', {
    responses: {
      '200': {
        description: 'EntityReaction PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'PartialEntityReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
            optional: ['_name', '_entityId'],
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
    @param.query.object('set') set?: Set,
    @param.where(EntityReaction) where?: Where<EntityReaction>,
    @param.query.object('entitySet') entitySet?: Set,
    @param.where(EntityReaction) entityWhere?: Where<EntityReaction>,
  ): Promise<Count> {
    const filterBuilder = new FilterBuilder<EntityReaction>();

    if (where) {
      filterBuilder.where(where);
    }

    let filter = filterBuilder.build();

    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    // Build entity filter
    const entityFilterBuilder = new FilterBuilder<EntityReaction>();
    if (entityWhere) {
      entityFilterBuilder.where(entityWhere);
    }

    let entityFilter = entityFilterBuilder.build();
    if (entitySet) {
      entityFilter = new SetFilterBuilder<EntityReaction>(entitySet, {
        filter: entityFilter,
      }).build();
    }

    sanitizeFilterFields(filter);
    sanitizeFilterFields(entityFilter);

    return this.entityReactionsRepository.updateAll(
      entityReaction,
      filter.where,
      entityFilter.where,
    );
  }

  @get('/entity-reactions/{id}', {
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityReaction, {
              includeRelations: true,
            }),
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: FilterExcludingWhere<EntityReaction>,
  ): Promise<EntityReaction> {
    sanitizeFilterFields(filter);

    return this.entityReactionsRepository.findById(id, filter);
  }

  @patch('/entity-reactions/{id}', {
    responses: {
      '204': {
        description: 'EntityReaction PATCH success',
      },
      '404': {
        description: 'Entity reaction not found',
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
          schema: getModelSchemaRef(EntityReaction, {
            title: 'PartialEntityReaction',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
            optional: ['_name', '_entityId'],
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityReactionsRepository.updateById(id, entityReaction);
  }

  @put('/entity-reactions/{id}', {
    responses: {
      '204': {
        description: 'EntityReaction PUT success',
      },
      '404': {
        description: 'Entity reaction not found',
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
          schema: getModelSchemaRef(EntityReaction, {
            title: 'ReplaceEntityReaction',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<void> {
    await this.entityReactionsRepository.replaceById(id, entityReaction);
  }

  @del('/entity-reactions/{id}', {
    responses: {
      '204': {
        description: 'EntityReaction DELETE success',
      },
      '404': {
        description: 'Entity reaction not found',
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
    await this.entityReactionsRepository.deleteById(id);
  }

  @get('/entity-reactions/{id}/parents', {
    responses: {
      '200': {
        description: 'Array of parent EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
              }),
            },
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.entityReactionsRepository.findParents(id, filter);
  }

  @get('/entity-reactions/{id}/children', {
    responses: {
      '200': {
        description: 'Array of child EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
              }),
            },
          },
        },
      },
      '404': {
        description: 'Entity reaction not found',
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
    @param.query.object('filter', getFilterSchemaFor(EntityReaction))
    filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.entityReactionsRepository.findChildren(id, filter);
  }

  @post('/entity-reactions/{id}/children', {
    responses: {
      '200': {
        description: 'Child EntityReaction model instance',
        content: {
          'application/json': { schema: getModelSchemaRef(EntityReaction) },
        },
      },
      '429': {
        description: 'Entity reaction limit is exceeded',
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
        description: 'Entity reaction already exists.',
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
        description: 'Parent entity reaction not found',
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
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewChildEntityReaction',
            exclude: [
              ...UNMODIFIABLE_COMMON_FIELDS,
              '_parents',
            ] as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    entityReaction: Omit<EntityReaction, UnmodifiableCommonFields | '_parents'>,
  ): Promise<EntityReaction> {
    return this.entityReactionsRepository.createChild(id, entityReaction);
  }
}
