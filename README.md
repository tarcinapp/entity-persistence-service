
An unopinionated REST based microservice backend application built on Loopback 4 framework.  entity-persistence-service Helps you to build your REST based application just in seconds.  
This application leverages schemaless database *(MongoDB)* to provide a scalable and highly customizable data persistence layer. It has a generic data model (entities, lists, reactions, ..) that easily be expanded and configurable through environment variables.  
This approach would support many use case scenarios.  
*For extended validation support, authentication, authorization, rate limiting capabilities, couple this application with the entity-persistence-gateway application.*  
### Overview
Application has prebuilt data models. See *Data Models* section for details. Each data model can hold arbitrarily structed JSON data along with predefined fields, such as `creationDateTime`, `ownerUsers`, `kind`, etc..

![Model Overview](./doc/img/model-overview.png?raw=true "Model Overview")

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

### Sample Use Cases
**User Configuration Storage**  
Every user have an entity record kind: config. Name: mobileapp, webui, menu, dashboard, etc. Users can store arbitrary data.  
**IoT Platform**  
Each list is a solution. Each solution has entities in kind: device. Each measurement is a reaction.  
**Movie Database**  
Each movie and each director is an entity. A relationship between directors and movies called 'director'. Users have lists, watchlist, watched. Editors prepare lists '10 you must see movies'.  
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
# Programming Conventions
All database models have id property and it is generated at server side with guid.
DateTime fields names are end with '`dateTime`'
Some common field names are:

| Field Name | Description |
|--|--|
| name| String field represents the name of the record. Mandatory field. |
| slug | Automatically filled while create or update with the slug format of the value of the name field.|
| ownerUsers| An array of user ids. |
| ownerGroups| An array of user groups. |
| creationDateTime| A date time object automatically filled with the datetime of entity create operation. |
| validFromDateTime| A date time object represents the time when the object is a valid entity. Can be treated as the approval time. There is a configuration to auto approve records at the time of creation. |
| validUntilDateTime| A date time object represents the time when the objects validity ends. Can be used instead of deleting records. |

# Prebuilt Filters (Sets)
As models designed to utilize same set of properties, there may be need of some common queries could be built on top of those properties.
For those could be addressed with complex filter queries, this application introduces prebuilt filters, called 'sets'.
Sets helps you easily built complex filtering queries without stumbling the limits of 'qs' library.
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
### List of Prebuilt Sets

| Set Name   | Description  |
| ------------ | ------------- |
|  publics | Selects all the data where `visibility: public`. |
| actives  | Selects all the data where `validFromDateTime` is not null or less than current date time and `validUntilDateTime` field is either null or greater than the current date time. |
| inactives  | Selects all data where `validUntilDateTime` field has a value and its less than the current date time.  |
|  pendings | Selects all data where `validFromDateTime` fiels is empty. |
|  my  | Selects all data where given user id is in the `ownerUsers` or given group is in the `ownerGroups`. User ID and groups should be provided through HTTP header. |
|  day | Selects all data where `creationDateTime` field is in last 24 hours. |
|  week | Selects all data where `creationDateTime` field is in last 7 days.  |
|  month | Selects all data where `creationDateTime` field is in last 30 days.   |


# Configuration
### Database
|  Configration |Description|Default Value|
| ------------ | ------------ | ------------ |
|  db_host | MongoDB database hostname  | localhost  |
|  db_port |  MongoDB database portname |  27017 |
| db_password  | MongoDB password. Provide through k8s secrets  |   |
| db_database  |   |  tarcinapp |
### Uniqueness
Data uniqueness is configurable with giving the composite-index-like set of field names. Field types should be primitive types such as string or number. Only exception to this is you can use predesigned field `ownerUsers`.

By the help of this configuration you can make a entity record unique per user. In other words, you can define a constraint, for example, saying that a user can only have one record with same kind.

|  Configration |Description|Default Value| Example Value|
| ------------ | ------------ | ------------ |------------ |
| uniqueness_entity | Composite index-like comma seperated list of field names of generic entity | -  | slug,kind,ownerUsers |
| uniqueness_list | Composite index-like comma seperated list of field names of list | - | slug,kind,ownerUsers |

### Auto Approve
autoapprove_entity=false
autoapprove_list=false
autoapprove_entity_reaction=false
autoapprove_list_reaction=false
### Visibility
visibility_entity=protected
visibility_list=protected
### Validation
validation_tag_maxlength=50

validation_entityname_maxlength=100

validation_listname_maxlength=100

validation_reactioncontent_maxlength=400
### Response Limits
These setting limits the number of record can be returned for each data model.

response_limit_entity=50

response_limit_list=50

response_limit_entity_reaction=50

response_limit_list_reaction=50

response_limit_tag=50

Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.

# Deploying to Kubernetes
* A configmap and secret sample yaml files are provided
# Configuring for Development
For VSCode, dreate a dev.env file at the root of your workspace folder. Add local database configuration as environment variables to this file.
