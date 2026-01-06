import { BindingKey } from '@loopback/core';
import type {
  CustomEntityThroughListRepository,
  CustomListThroughEntityRepository,
  CustomReactionThroughEntityRepository,
  CustomReactionThroughListRepository,
} from './index';

export const CustomRepositoriesBindings = {
  CUSTOM_ENTITY_THROUGH_LIST_REPOSITORY:
    BindingKey.create<CustomEntityThroughListRepository>(
      'repositories.custom.entity-through-list',
    ),
  CUSTOM_LIST_THROUGH_ENTITY_REPOSITORY:
    BindingKey.create<CustomListThroughEntityRepository>(
      'repositories.custom.list-through-entity',
    ),
  CUSTOM_REACTION_THROUGH_ENTITY_REPOSITORY:
    BindingKey.create<CustomReactionThroughEntityRepository>(
      'repositories.custom.reaction-through-entity',
    ),
  CUSTOM_REACTION_THROUGH_LIST_REPOSITORY:
    BindingKey.create<CustomReactionThroughListRepository>(
      'repositories.custom.reaction-through-list',
    ),
} as const;
