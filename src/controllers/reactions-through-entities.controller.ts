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
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import { sanitizeFilterFields } from '../extensions/utils/filter-helper';
import { Set, SetFilterBuilder } from '../extensions/utils/set-helper';
import { EntityReaction, HttpErrorResponse } from '../models';
import {
  UNMODIFIABLE_COMMON_FIELDS,
  UnmodifiableCommonFields,
} from '../models/base-types/unmodifiable-common-fields';
import { CustomReactionThroughEntityRepository } from '../repositories/custom-reaction-through-entity.repository';
import { LoggingService } from '../services/logging.service';

export class ReactionsThroughEntitiesController {
  constructor(
    @repository(CustomReactionThroughEntityRepository)
    protected reactionRepository: CustomReactionThroughEntityRepository,
    @inject('services.LoggingService')
    private logger: LoggingService,
  ) {}

  @get('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Array of EntityReaction model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(EntityReaction, {
                includeRelations: true,
                exclude: ['_relationMetadata'],
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
                error: getModelSchemaRef(HttpErrorResponse),
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
    @param.query.object('filter') filter?: Filter<EntityReaction>,
  ): Promise<EntityReaction[]> {
    // Set the source entity ID in the repository
    this.reactionRepository.sourceEntityId = id;

    if (set) {
      filter = new SetFilterBuilder<EntityReaction>(set, {
        filter: filter,
      }).build();
    }

    sanitizeFilterFields(filter);

    return this.reactionRepository.find(filter);
  }

  @post('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'EntityReaction model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(EntityReaction, {
              exclude: ['_relationMetadata'],
            }),
          },
        },
      },
      '429': {
        description: 'Reaction limit is exceeded',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
      '409': {
        description: 'Reaction already exists.',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
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
                error: getModelSchemaRef(HttpErrorResponse),
              },
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
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'NewReactionInEntity',
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    reaction: Omit<EntityReaction, UnmodifiableCommonFields>,
  ): Promise<EntityReaction> {
    // Set the source entity ID in the repository
    this.reactionRepository.sourceEntityId = id;

    return this.reactionRepository.create(reaction);
  }

  @patch('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Entity.Reaction PATCH success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'Entity not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
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
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async updateAll(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EntityReaction, {
            title: 'PatchReactionInEntity',
            partial: true,
            exclude: UNMODIFIABLE_COMMON_FIELDS as (keyof EntityReaction)[],
            includeRelations: false,
          }),
        },
      },
    })
    reaction: Partial<EntityReaction>,
    @param.query.object('set') set?: Set,
    @param.query.object('where') where?: Where<EntityReaction>,
  ): Promise<Count> {
    // Set the source entity ID in the repository
    this.reactionRepository.sourceEntityId = id;

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

    sanitizeFilterFields(filter);

    return this.reactionRepository.updateAll(reaction, filter.where);
  }

  @del('/entities/{id}/reactions', {
    responses: {
      '200': {
        description: 'Entity.Reaction DELETE success count',
        content: { 'application/json': { schema: CountSchema } },
      },
      '404': {
        description: 'Entity not found',
        content: {
          'application/json': {
            schema: {
              properties: {
                error: getModelSchemaRef(HttpErrorResponse),
              },
            },
          },
        },
      },
    },
  })
  async deleteAll(
    @param.path.string('id') id: string,
    @param.query.object('set') set?: Set,
    @param.query.object('where') where?: Where<EntityReaction>,
  ): Promise<Count> {
    // Set the source entity ID in the repository
    this.reactionRepository.sourceEntityId = id;

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

    sanitizeFilterFields(filter);

    return this.reactionRepository.deleteAll(filter.where);
  }
}
