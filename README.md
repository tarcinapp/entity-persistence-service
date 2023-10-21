The Entity Persistence Service serves as the backend for the Tarcinapp microservice family.

This microservice is a flexible and REST-based backend application built on the Loopback 4 framework. With the Entity Persistence Service, you can effortlessly develop your REST-based application within seconds.

The application utilizes a schemaless database (MongoDB) to create a scalable and highly customizable data persistence layer. It comes with a generic data model (entities, lists, reactions, etc.) containing predefined fields (creationDateTime, ownerUsers, kind, etc.) that can easily adapt to various use cases.

For enhanced validation support, authentication, authorization, and rate-limiting capabilities, you can integrate this application with the Entity Persistence Gateway.
# Overview
The application includes prebuilt data models, which are detailed in the *Data Models* section. Each data model can store JSON data with arbitrary structures and comes with predefined fields like `creationDateTime`, `ownerUsers`, `kind`, etc.


![Model Overview](./doc/img/model-overview.png?raw=true "Model Overview")

### Features
The application offers the following features:

 * Entity CRUD operations
 * Entity approval
 * Entity uniqueness
 * Entity relationships
 * Entity ownership
 * Adding entities to lists
 * Hierarchical lists
 * Tagging entities
 * Reactions to entities and lists, such as comments and likes
 * Sub-reactions to reactions
 * Customized validations
 * Query by location
 * Prebuilt queries (sets)
 * Special gateway application

### Data Model
The application comes with the following data models:
- Generic Entity
- Entity Hierarchy
- Entity Reaction
- Entity Sub Reaction
- List
- List Hierarchy
- List Reaction
- List Sub Reaction
- Tags

**Generic Entity**
The primary data model used in this application is the Generic Entity, which represents a basic object. The `kind` field is utilized to differentiate between different types of objects. For instance, an object can have a `kind` value of `book` or `author`. This allows for easy categorization and organization of data within the application.

**List**
The List data model represents a collection of generic entities. A list can have relationships with many entities. List kinds can be distinguished using the `kind` field. For example, a list could have a `kind` value of `favorites` or `science_fiction`. This feature allows for easy categorization and organization of lists within the application.

**Entity Reaction**
The Entity Reaction data model represents any event related to an object. For example, it can represent actions such as comments, likes, measurements, anger, and more. This flexible feature allows the application to handle a wide range of reactions and interactions associated with entities.

**List Reaction**
The List Reaction data model represents any event related to a list. For example, it can represent actions such as comments, likes, measurements, anger, and more. This versatile feature enables the application to handle various reactions and interactions associated with lists.

**Tags**
The Tags data model represents a collection of tags. Tags can be used to categorize and organize entities and lists. For example, a book can have tags such as `science_fiction` or `fantasy`. This feature allows for easy categorization and organization of data within the application.

## Sample Use Cases

1. **User Configuration Storage**  
  Every user has an entity record with the kind 'config.' Entities are labeled as 'mobileapp,' 'webui,' 'menu,' 'dashboard,' etc., to store arbitrary data for personalized user configurations. For example, the 'menu' entity stores the user's menu preferences, and the 'dashboard' entity stores the user's dashboard preferences.  
2. **IoT Platform**  
  Each list in the application represents a solution, and each solution contains entities representing IoT devices with the kind 'device.' The application records measurements as reactions, enabling real-time data tracking and analytics.

3. **Movie Database**  
  The application manages movies and directors as separate entities. Each movie and director has its own entity, and a relationship named 'director' connects directors with the movies they have directed. Users can create lists like 'watchlist' and 'watched' to organize their movie preferences. Editors can curate special lists like '10 Must-See Movies' for user recommendations.

4. **Task Management System**  
  The application serves as a task management system, allowing users and teams to efficiently manage tasks and projects. Each task is represented as an entity with attributes like name, description, due date, and assignee. Users can create lists to categorize tasks based on projects or priority levels.

5. **Recipe Management Application**  
  The application functions as a recipe management tool, helping users discover, save, and organize recipes. Each recipe is represented as an entity with details such as title, ingredients, instructions, and preparation time. Users can create lists like 'favorites' and 'tried recipes' to bookmark recipes they love or have tested.

6. **Fitness Tracker**  
  The application acts as a fitness tracker, assisting users in monitoring their workouts and progress. Each workout session is represented as an entity with attributes like date, exercise type, duration, and intensity. Users can create lists to categorize workouts based on specific activities or fitness goals.

## Concepts
### Sets
Sets are a powerful feature introduced in the application, designed to streamline data filtering and selection. They provide a convenient and flexible way to retrieve specific subsets of data based on predefined conditions or custom logical combinations.

**Features of Sets:**

1. **Combining Sets with Logical Operators:** Sets can be combined using logical operators such as AND, OR, and NOT, enabling users to construct complex queries tailored to their specific needs.
2. **Default Filtering with Sets:** Users can still apply default filtering to sets. For example, using the query parameter **`set[actives]&filter[where][kind]=config`** allows users to select all active data with a **`kind`** value of **`config`**.
3. **Enforced Sets for Role-Based Access Control:** Sets can be enforced, ensuring that users work on specific predefined sets. The Gateway application facilitates the creation of sets according to role-based access control policies, enhancing data security and access control.

**List of Prebuilt Sets:**
The application comes with a set of prebuilt sets to simplify common data selections. Each set is designed to retrieve specific subsets of data based on predefined conditions. Here are the prebuilt sets:

| Set Name  | Description                                                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| publics   | Selects all data with a visibility value of public.                                                                                                                                                                                       |
| actives   | Selects all data where the validFromDateTime is not null, less than the current date time, and the validUntilDateTime field is either null or greater than the current date time.                                                         |
| inactives | Selects all data where the validUntilDateTime field has a value and is less than the current date time.                                                                                                                                   |
| pendings  | Selects all data where the validFromDateTime field is empty.                                                                                                                                                                              |
| owners    | Selects all data where the given user ID is in the ownerUsers or the given group is in the ownerGroups. User IDs and groups should be provided as comma-separated values in the query variable: set[owners]=[user1,user2][group1,group2]. |
| day       | Selects all data where the creationDateTime field is within the last 24 hours.                                                                                                                                                            |
| week      | Selects all data where the creationDateTime field is within the last 7 days.                                                                                                                                                              |
| month     | Selects all data where the creationDateTime field is within the last 30 days.                                                                                                                                                             |
| audience  | A combination of multiple sets. This set returns 'active' and 'public' records along with a user's own active and pending records. As a result, it requires user and group IDs similar to the owners set.                                 |

The introduction of sets enhances the application's querying capabilities, allowing users to easily access and manage specific subsets of data based on predefined conditions or customized logical combinations.


### Tags
The updateAll operation is not available for tags since their content is unique, and the only property that might need updating is the "content" property itself. Updating the creationDateTime for all tags would not be meaningful in this context.

## Programming Conventions
1. All database models have id property and it is generated at server side with guid.
2. DateTime fields names are end with '`dateTime`'
Here are the list of common field names.

| Field Name              | Description                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **kind\***              | A string field represents the kind of the record.  As this application built on top of a schemaless database, objects with different schemas can be considered as different kinds can be stored in same collection. This field is using in order to seggregate objects in same collection. Most of the configuration parameters can be specialized to be applied on specific kind of objects. |
| **name\***              | String field represents the name of the record. Mandatory field.                                                                                                                                                                                                                                                                                                                              |
| **slug**                | Automatically filled while create or update with the slug format of the value of the name field.                                                                                                                                                                                                                                                                                              |
| **visibility**          | Record's visibility level. Can be either `private`, `protected` or `public`.                                                                                                                                                                                                                                                                                                                  |
| **version**             | A number field that automatically incremented each update and replace operation. Note: `version` is not incremented if record is updated with `updateAll` operation.                                                                                                                                                                                                                          |
| **ownerUsers**          | An array of user ids.                                                                                                                                                                                                                                                                                                                                                                         |
| **ownerGroups**         | An array of user groups.                                                                                                                                                                                                                                                                                                                                                                      |
| **ownerUsersCount**     | A number field keeps the number of items in ownerUsers array                                                                                                                                                                                                                                                                                                                                  |
| **ownerGroupsCount**    | A number field keeps the number of items in ownerGroups array                                                                                                                                                                                                                                                                                                                                 |
| **creationDateTime**    | A date time object automatically filled with the datetime of entity create operation. It's not read-only to let administrator users change it over gateway.                                                                                                                                                                                                                                   |
| **lastUpdatedDateTime** | A date time object automatically filled with the datetime of any entity update operation.                                                                                                                                                                                                                                                                                                     |
| **lastUpdatedBy**       | Id of the user who performed the last update operation                                                                                                                                                                                                                                                                                                                                        |
| **validFromDateTime**   | A date time object represents the time when the object is a valid entity. Can be treated as the approval time. There is a configuration to auto approve records at the time of creation.                                                                                                                                                                                                      |
| **validUntilDateTime**  | A date time object represents the time when the objects validity ends. Can be used instead of deleting records.                                                                                                                                                                                                                                                                               |
| **idempotencyKey**      | A hashed string field should be computed using the record's fields, which are designed to enhance the record's uniqueness. The gateway application has the capability to calculate this and transmit it to the backend.                                                                                                                                                                       |

**(\*)** Required fields

**Calculated Fields**: `version`, `ownerUsersCount` and `ownerGroupsCount` fields are calculated at the application logic ignoring the sent value.  
**Fields Calculated when Empty**: `slug`, `creationDateTime` and `lastUpdatedDateTime` are calculated at the application logic if it is not specified in the request body. entity-persistence-gateway decides if user is authorized to send these fields by evaluating security policies.  
**Gateway Managed Fields**: `ownerUsers`, `ownerGroups`, `lastUpdatedBy` fields *may* be modified by entity-persistence-gateway. Gateway decides whether it accepts the given value or modify it by evaluating security policies.

**Note:** entity-persistence-gateway can decide if *caller* is authorized to change the value of a field by evaluating security policies.

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
| Configration         | Description                                   | Default Value |
| -------------------- | --------------------------------------------- | ------------- |
| **mongodb_host**     | MongoDB database hostname                     | localhost     |
| **mongodb_port**     | MongoDB database port number                  | 27017         |
| **mongodb_user**     | MongoDB database user                         | tappuser      |
| **mongodb_password** | MongoDB password. Provide through k8s secrets | tapppass123!  |
| **mongodb_database** | Name of the database                          | tappdb        |

### Allowed Kinds
You can limit acceptable values for `kind` fields for the records.

| Configuration    | Description                                                        | Default Value |
| ---------------- | ------------------------------------------------------------------ | ------------- |
| **entity_kinds** | Comma seperated list of allowed values for kind field of entities. | authors,books |

### Uniqueness
Data uniqueness is configurable with giving the composite-index-like set of field names. Optionally, you can make uniqueness valid for a subset of records. To enforce uniqueness in a subset of record, you can configure "set" feature of the application. That is, uniqueness can be enforced only between valid or public records as well. You can combine multiple sets with logical operators.

Field types should be primitive types such as string or number.

Uniqueness configuration is implemented in application logic. MongoDB has composite unique index feature but this feature supports only one array. Thus, it cannot support ownerUsers and ownerGroups together. Furthermore, MongoDB's unique index on arrays cannot be used to implement 'unique per user' approach as it takes arrays contribute to unique index as a whole.

| Configration                                 | Description                                                                                                                                                                                 | Default Value | Example Value        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------- |
| **uniqueness_entity_fields**                 | Composite index-like comma seperated list of field names of generic entity                                                                                                                  | -             | slug,kind,ownerUsers |
| **uniqueness_entity_set**                    | Specify the scope where the uniqueness should be checked with set queries.                                                                                                                  | -             | set[actives]         |
| **uniqueness_entity_fields_for_{kind_name}** | Composite index-like comma seperated list of field names of generic entity. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind. | -             | slug,kind,ownerUsers |
| **uniqueness_entity_set_for_{kind_name}**    | Specify the scope where the uniqueness should be checked with set queries. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind.  | -             | set[actives]         |
| **uniqueness_list_fields**                   | Composite index-like comma seperated list of field names of list                                                                                                                            | -             | slug,kind,ownerUsers |
| **uniqueness_list_set**                      | Specify the scope where the uniqueness should be checked with set queries                                                                                                                   | false         | set[publics]         |
| **uniqueness_list_fields_for_{kind_name}**   | Composite index-like comma seperated list of field names of list. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind.           | -             | slug,kind,ownerUsers |
| **uniqueness_list_set_for_{kind_name}**      | Specify the scope where the uniqueness should be checked with set queries. Specify a valid kind name in configuration name. This configuration will only be applied to that specific kind.  | false         | set[publics]         |

### Auto Approve
| Configration                          | Description                                                                                                          | Default Value | Example Value |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| **autoapprove_entity**                | If true, `validFromDateTime` field of entity record is automatically filled with the creation datetime.              | false         | true          |
| **autoapprove_entity_for_{kindName}** | If true, `validFromDateTime` field of entity record in this kind is automatically filled with the creation datetime. | false         | true          |
| **autoapprove_list**                  | If true, `validFromDateTime` field of list record is automatically filled with the creation datetime.                | false         | true          |
| **autoapprove_entity_reaction**       | If true, `validFromDateTime` field of entity reaction record is automatically filled with the creation datetime.     | false         | true          |
| **autoapprove_list_reaction**         | If true, `validFromDateTime` field of list reaction record is automatically filled with the creation datetime.       | false         | true          |
### Visibility
This option only applies when visibility field is not provided. If you want to apply a visibility rule bu user role, please see entity-persistence-gateway.

| Configuration                         | Description                                                                                                                             | Default Value | Example Values  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------- |
| **visibility_entity**                 | Default value to be filled for `visibility` field while entity creation.                                                                | protected     | public, private |
| **visibility_entity_for_{kind_name}** | Default value to be filled for `visibility` field while entity creation. This configuration will only be applied to that specific kind. | protected     | public, private |
| **visibility_list**                   | Default value to be filled for `visibility` field while list creation.                                                                  | protected     | public, private |
| **visibility_list_for_{kind_name}**   | Default value to be filled for `visibility` field while list creation. This configuration will only be applied to that specific kind.   | protected     | public, private |
### Validation
| Configuration                            | Description                            | Default Value |
| ---------------------------------------- | -------------------------------------- | ------------- |
| **validation_tag_maxlength**             | Max length limit for tag content.      | 50            |
| **validation_entityname_maxlength**      | Max length limit for entity name.      | 100           |
| **validation_listname_maxlength**        | Max length limit for list name.        | 100           |
| **validation_reactioncontent_maxlength** | Max length limit for reaction content. | 400           |
### Response Limits
These setting limits the number of record can be returned for each data model. If user asks more items than the limits, it is silently reduced to the limits given the configuration below.

| Configration                       | Description                                              | Default Value |
| ---------------------------------- | -------------------------------------------------------- | ------------- |
| **response_limit_entity**          | Max items can be returned from entity response.          | 50            |
| **response_limit_list**            | Max items can be returned from list response.            | 50            |
| **response_limit_entity_reaction** | Max items can be returned from entity reaction response. | 50            |
| **response_limit_list_reaction**   | Max items can be returned from list reaction response.   | 50            |
| **response_limit_tag**             | Max items can be returned from tags response.            | 50            |
### Record Limits
These settings limits the number of records can be created for entities and lists. There is no limits for reactions and tags. But you can configure daily or hourly limits from gateway.
Limits can be configured through sets. For instance, you can limit active or public entities a user can have. You can even set these configurations per entity kind by adding `_for_{kindname}` suffix to the configuration name.

| Configration                                  | Description                                                          | Example Value   |
| --------------------------------------------- | -------------------------------------------------------------------- | --------------- |
| **record_limit_entity_count**                 | Max entities can be created.                                         | 100             |
| **record_limit_entity_set**                   | A set string where record limits will be applied.                    | `set[audience]` |
| **record_limit_entity_count_for_{kind_name}** | Max entities can be created for a specific entity kind.              | 100             |
| **record_limit_entity_set_for_{kind_name}**   | A set string where record limits will be applied for a specific kind | 50              |
| **record_limit_list_count**                   | Max lists can be created.                                            | 50              |
| **record_limit_list_set**                     | A set string where record limits will be applied.                    | `set[audience]` |
| **record_limit_list_count_for_{kind_name}**   | Max lists can be created for a specific entity kind.                 | 50              |
| **record_limit_list_set_for_{kind_name}**     | A set string where record limits will be applied for a specific kind | 50              |

Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.

# Deploying to Kubernetes
* A configmap and secret sample yaml files are provided

# Configuring for Development
Prepare a mongodb instance. Create a database and a user/pass who is authorized to access to the database. Note the name of the database, username and password. 
For example, create a database called tarcinappdb.
```javascript
db.createUser({
  user: "tappuser",
  pwd: "tapppass123!",
  roles: [
    {
      role: "readWrite",
      db: "tappdb"
    }
  ]
})
```

For VSCode, create a dev.env file at the root of your workspace folder. Add local database configuration as environment variables to this file. This file will be read once you start the application in debug mode. Sample .env files can be found under /doc/env folder.

# Development Status
* Uniqueness, kind limiting (allowed kinds), auto approve, validation, response limits and record limits are fully implemented for generic-entities.
