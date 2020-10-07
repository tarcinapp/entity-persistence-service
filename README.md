An unopinionated generic entity persistence backend application.
This application leverages schemaless database with 84 requests.
Features:
entity crud operations
entity approval
entity uniqueness
hierarchical entities
adding entities to lists
hierarchical lists
tagging entities
reactions to entities and lists
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
db_host
db_port
db_user
db_password
db_database
uniqueness_entity=name,kind,ownerUsers,field1
uniqueness_list=name,kind,ownerUsers,field1
autoapprove_entity=true
autoapprove_list=true
autoapprove_entity_reaction=true
autoapprove_list_reaction=true
limits_entity=10d,5m
limits_list=3s,2m
limits_entity_reactions=
limits_list_reactions=
validation_tag_length=50


Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.


# Deploying to Kubernetes
* A configmap and secret sample yaml files are provided

# Configuring for Development
Create a dev.env file at the root of your workspace folder. Add local database configuration as environment variables to file.
