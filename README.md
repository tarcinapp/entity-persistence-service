entity-persistence-service is the backend part of the Tarcinapp microservice family.

This microservice is an unopinionated REST based microservice backend application built on Loopback 4 framework.  entity-persistence-service helps you to build your REST based application just in seconds.

This application leverages schemaless database *(MongoDB)* to provide a scalable and highly customizable data persistence layer. It has a generic data model (entities, lists, reactions, ..) with predefined fields (creationDateTime, ownerUsers, kind, etc..) that can easily be expanded to support many usecases.

*For extended validation support, authentication, authorization, rate limiting capabilities, couple this application with the entity-persistence-gateway application.*
# Overview
Application has prebuilt data models. See *Data Models* section for details. Each data model can hold arbitrarily structed JSON data along with predefined fields, such as `creationDateTime`, `ownerUsers`, `kind`, etc..

![Model Overview](./doc/img/model-overview.png?raw=true "Model Overview")

### Features
- entity crud operations
- entity approval
- entity uniqueness
- entity relationships
- entity ownership
- adding entities to lists
- hierarchical lists
- tagging entities
- reactions to entities and lists like comments, likes
- sub reactions to reactions
- customized validations
- query by location
- prebuilt queries (sets)
- Special gateway application

**Generic Entity**
The most common data model of the application. Simply represents an object. Object kinds can be differentiate with `kind` field.
For example `kind: book` or `kind: author`
**List**
Represents list of a generic entity. A list can have a relationship to many entities. List kinds can be differentiate with `kind` field.
For example, `kind: favorites`  or `kind:science_fiction`
**Entity Reaction**
Represents any event related to an object. For example comment, like, measurement, anger,..
**List Reaction**
Represents any event related to a list. For example comment, like, measurement, anger,..

## Concepts
### Sets
### Kind Specific Configurations

## Sample Use Cases
**User Configuration Storage**
Every user have an entity record kind: config. Name: mobileapp, webui, menu, dashboard, etc. Users can store arbitrary data.
**IoT Platform**
Each list is a solution. Each solution has entities in kind: device. Each measurement is a reaction.
**Movie Database**
Each movie and each director is an entity. A relationship between directors and movies called 'director'. Users have lists, watchlist, watched. Editors prepare lists '10 you must see movies'.

## Data Models
- Generic Entity
- Entity Hierarchy
- Entity Reaction
- Entity Sub Reaction
- List
- List Hierarchy
- List Reaction
- List Sub Reaction
- Tags
### Tags
Tags does not have updateAll operation as tags content is unique and this is the only property that may require an update.
Updating creationDateTime for all tags does not make sense.
## Programming Conventions
All database models have id property and it is generated at server side with guid.
DateTime fields names are end with '`dateTime`'
Here are the list of common field names.

| Field Name | Description | Required | Read Only\*
|--|--|--|--|
| **kind**| A string field represents the kind of the record.  As this application built on top of a schemaless database, objects with different schemas can be considered as different kinds can be stored in same collection. This field is using in order to seggregate objects in same collection. Most of the configuration parameters can be specialized to be applied on specific kind of objects. | Yes | No
| **name**| String field represents the name of the record. Mandatory field. | Yes | No
| **slug** | Automatically filled while create or update with the slug format of the value of the name field.| Yes | Yes
| **ownerUsers\*\***| An array of user ids. |No|No
| **ownerGroups\*\***| An array of user groups. |No|No
| **ownerUsersCount**| A number field keeps the number of items in ownerUsers array |No|Yes
| **ownerGroupsCount**| A number field keeps the number of items in ownerGroups array |No|Yes
| **creationDateTime**| A date time object automatically filled with the datetime of entity create operation. It's not read-only to let administrator users change it over gateway. |No|No
| **lastUpdatedDateTime**| A date time object automatically filled with the datetime of any entity update operation. |No|No
| **lastUpdatedBy**| Id of the user who performed the last update operation |No|No
| **validFromDateTime**| A date time object represents the time when the object is a valid entity. Can be treated as the approval time. There is a configuration to auto approve records at the time of creation. |No|No
| **validUntilDateTime**| A date time object represents the time when the objects validity ends. Can be used instead of deleting records. |No|No

\*Readonly fields are updated and created by the application. That is, whatever the value you send for those fields is ignored and actual values are calculated at the application logic.
\*\*These fields are managed by entity-persistence-gateway. That is, values sent for those fields are subjected to authorization. Gateway decides to ignore the value, or use it as it is.

# Prebuilt Filters (Sets)
As models designed to utilize same set of properties, there may be need of some common queries could be build on top of those properties.
For those could be addressed with complex filter queries, this application introduces prebuilt filters, called 'sets'.
Sets helps you easily build complex filtering queries without stumbling the limits of 'qs' library.
To give an example to such complex queries:
* 'Retrieve all active entities'
* 'Retrieve all public entities and my entities'
* 'Retrieve all entities created in last 7 days'
* 'Retrieve all entities waiting for approval'

You can use following set queries to shorten the given queries above respectively:
- `set[actives]`
- `set[or][][publics]&set[or][][my]`
- `set[week]`
- `set[pendings]`
### Features of Sets
* Sets can be combined using logical operators
* Default filtering can still be applied to the sets. Such as: `set[actives]&filter[where][kind]=config`
* Users can be enforced to work on specific sets. Gateway application helps you to build your sets according to the role based access control policies.
### List of Prebuilt Sets

| Set Name   | Description  |
| ------------ | ------------- |
|  **publics** | Selects all the data where `visibility: public`. |
| **actives**  | Selects all the data where `validFromDateTime` is not null and less than current date time and `validUntilDateTime` field is either null or greater than the current date time. |
| **inactives**  | Selects all data where `validUntilDateTime` field has a value and its less than the current date time.  |
|  **pendings** | Selects all data where `validFromDateTime` fiels is empty. |
|  **owners**  | Selects all data where given user id is in the `ownerUsers` or given group is in the `ownerGroups`. User ID and groups should be provided as comma seperated value of the query variable: `set[owners]=[user1,user2][group1,group2]` |
|  **day** | Selects all data where `creationDateTime` field is in last 24 hours. |
|  **week** | Selects all data where `creationDateTime` field is in last 7 days.  |
|  **month** | Selects all data where `creationDateTime` field is in last 30 days.   |
|  **prod** | Combination of multiple sets. This set is returning 'active' and 'public' records and adds this result to 'actives' and 'pendinds' of the given identity. ((set[valids] and set[actives]) or (set[owners] and (set[actives] or set[pendings]))). Thus, identity must be given: set[prod]=[userid1, userid2, ..][groupname1, groupname2, ...]  |

# Configuration
We can divide configurations into 7 categories:
* Database configurations
* Uniqueness configurations
* Auto approve configurations
* Default visibility configuration
* Validation configurations
* Response limits configurations
* Record limit configurations

### Database
|  Configration |Description|Default Value|
| ------------ | ------------ | ------------ |
|  **db_host** | MongoDB database hostname  | localhost  |
|  **db_port** |  MongoDB database portname |  27017 |
| **db_password**  | MongoDB password. Provide through k8s secrets  |   |
| **db_database**  | Name of the database  |  tarcinapp |
### Uniqueness
Data uniqueness is configurable with giving the composite-index-like set of field names. Optionally, you can make uniqueness valid for a subset of records. To enforce uniqueness in a subset of record, you can configure "set" feature of the application. That is, uniqueness can be enforced only between valid or public records as well. You can combine multiple sets with logical operators.

Field types should be primitive types such as string or number.

Uniqueness configuration is implemented in application logic. MongoDB has composite unique index feature but this feature supports only one array. Thus, it cannot support ownerUsers and ownerGroups together. Furthermore, MongoDB's unique index on arrays cannot be used to implement 'unique per user' approach as it takes arrays contribute to unique index as a whole.

|  Configration |Description|Default Value| Example Value|
| ------------ | ------------ | ------------ |------------ |
| **uniqueness_entity_fields** | Composite index-like comma seperated list of field names of generic entity | -  | slug,kind,ownerUsers |
| **uniqueness_entity_set** | Specify the scope where the uniqueness should be checked with set queries. | -  | set[actives] |
| **uniqueness_entity_fields_for_{kind_name}** | Composite index-like comma seperated list of field names of generic entity. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind. | -  | slug,kind,ownerUsers |
| **uniqueness_entity_set_for_{kind_name}** | Specify the scope where the uniqueness should be checked with set queries. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind.| -  | set[actives] |
| **uniqueness_list_fields** | Composite index-like comma seperated list of field names of list | - | slug,kind,ownerUsers |
| **uniqueness_list_set** | Specify the scope where the uniqueness should be checked with set queries | false  | set[publics] |
| **uniqueness_list_fields_for_{kind_name}** | Composite index-like comma seperated list of field names of list. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind. | - | slug,kind,ownerUsers |
| **uniqueness_list_set_for_{kind_name}** | Specify the scope where the uniqueness should be checked with set queries. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind. | false  | set[publics] |

### Auto Approve
|  Configration | Description  |  Default Value | Example Value  |
| ------------ | ------------ | ------------ | ------------ |
| **autoapprove_entity**  | If true, `validFromDateTime` field of entity record is automatically filled with the creation datetime. | false  | true  |
| **autoapprove_list**  | If true, `validFromDateTime` field of list record is automatically filled with the creation datetime.  |  false |  true |
| **autoapprove_entity_reaction** |  If true, `validFromDateTime` field of entity reaction record is automatically filled with the creation datetime. | false  | true  |
| **autoapprove_list_reaction** | If true, `validFromDateTime` field of list reaction record is automatically filled with the creation datetime.  | false  | true  |
### Visibility
This option only applies when visibility field is not provided. If you want to apply a visibility rule bu user role, please see entity-persistence-gateway.

|  Configuration | Description  |  Default Value | Example Value  |
| ------------ | ------------ | ------------ | ------------ |
| **visibility_entity**  | Default value to be filled for `visibility` field while entity creation. | protected  | public, private  |
| **visibility_list**  | Default value to be filled for `visibility` field while list creation. | protected  | true  |
### Validation
|  Configration | Description  |  Default Value |
| ------------ | ------------ | ------------ |
| **validation_tag_maxlength**  | Max length limit for tag content. | 50  |
| **validation_entityname_maxlength**  | Max length limit for entity name. | 100  |
| **validation_listname_maxlength**  | Max length limit for list name.  | 100  |
| **validation_reactioncontent_maxlength**  | Max length limit for reaction content. | 400  |
### Response Limits
These setting limits the number of record can be returned for each data model. If user asks more items than the limits, it is silently reduced to the limits given the configuration below.

|  Configration | Description  |  Default Value |
| ------------ | ------------ | ------------ |
| **response_limit_entity**  | Max items can be returned from entity response. | 50  |
| **response_limit_list**  | Max items can be returned from list response.  | 50  |
| **response_limit_entity_reaction**  | Max items can be returned from entity reaction response.  | 50  |
| **response_limit_list_reaction**  | Max items can be returned from list reaction response. | 50  |
| **response_limit_tag**  | Max items can be returned from tags response. | 50  |
### Record Limits
These settings limits the number of records can be created for entities and lists. There is no limits for reactions and tags. But you can configure daily or hourly limits from gateway.
Limits can be configured through sets. For instance, you can limit active or public entities a user can have. You can even set these configurations per entity kind by adding `_for_{kindname}` suffix to the configuration name.

|  Configration | Description  |  Example Value |
| ------------ | ------------ | ------------ |
| **record_limit_entity_count**  | Max entities can be created. | 100 |
| **record_limit_entity_set**  | A set string where record limits will be applied. | `set[owners]`  |
| **record_limit_entity_count_for_{kind_name}**  | Max entities can be created for a specific entity kind. | 100  |
| **record_limit_entity_set_for_{kind_name}**  | A set string where record limits will be applied for a specific kind | 50  |
| **record_limit_list_count**  | Max lists can be created. | 50  |
| **record_limit_list_set**  | A set string where record limits will be applied.  | 50  |
| **record_limit_list_count_for_{kind_name}**  | Max lists can be created for a specific entity kind.  | 50  |
| **record_limit_list_set_for_{kind_name}**  | A set string where record limits will be applied for a specific kind  | 50  |

Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.

# Deploying to Kubernetes
* A configmap and secret sample yaml files are provided
# Configuring for Development
For VSCode, dreate a dev.env file at the root of your workspace folder. Add local database configuration as environment variables to this file.
