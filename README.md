An unopinionated generic entity persistence backend application.
This application leverages schemaless database (mongodb) to provide a scalable and highly customizable data persistence layer.

Features:
entity crud operations
entity approval
entity uniqueness
hierarchical entities
adding entities to lists
hierarchical lists
tagging entities
reactions to entities and lists like comments, likes
sub reactions to reactions

# Programming Conventions
All database models have id property and it is generated at server side with guid.
DateTime fields names are end with 'dateTime'
Some common field names are:
visibility
ownerUsers
ownerGroups
creationDateTime
validFromDateTime
validUntilDateTime

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

uniqueness_entity=name,kind,ownerUsers
uniqueness_list=name,kind,ownerUsers

autoapprove_entity=false
autoapprove_list=false
autoapprove_entity_reaction=false
autoapprove_list_reaction=false

validation_tag_maxlength=50

These setting limits the number of record can be returned for each data model.
response_limit_entity=50
response_limit_list=50
response_limit_entity_reaction=50
response_limit_list_reaction=50
response_limit_tag=50

These setting affects only the creation operation on data model.
frequency_limits_entity=d10,m5
frequency_limits_list=s3,m5
frequency_limits_entity_reactions=
frequency_limits_list_reactions=

Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.


# Deploying to Kubernetes
* A configmap and secret sample yaml files are provided

# Configuring for Development
For VSCode, dreate a dev.env file at the root of your workspace folder. Add local database configuration as environment variables to this file.
