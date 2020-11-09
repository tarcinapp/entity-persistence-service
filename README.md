
An unopinionated REST based microservice backend application. Helps you to build your REST based application fast and easy.
This application leverages schemaless database (mongodb) to provide a scalable and highly customizable data persistence layer. It has a generic data model that easily configurable through environment variables.

## Features
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

# Pre-built Filters (Sets)
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
| Set Name | Description | Corresponding Filter
publics
actives
inactives
pendings
my
day
week
month
# Data Model
## Tags
Tags does not have updateAll operation as tags content is unique and this is the only property that may require an update.
Updating creationDateTime for all tags does not make sense.
# Configuration

db_host=localhost

db_port=27017

db_user

db_password

db_database



uniqueness_entity=slug,kind,ownerUsers

uniqueness_list=slug,kind,ownerUsers



autoapprove_entity=false

autoapprove_list=false

autoapprove_entity_reaction=false

autoapprove_list_reaction=false



visibility_entity=protected

visibility_list=protected



validation_tag_maxlength=50

validation_entityname_maxlength=100

validation_listname_maxlength=100

validation_reactioncontent_maxlength=400



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
