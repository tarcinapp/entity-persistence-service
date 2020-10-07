An unopinionated generic entity persistence backend with 85 requests. Features:
entity crud operations
entity approval
entity uniqueness
hierarchical entities
adding entities to lists
hierarchical lists
tagging entities
reactions to entities and lists
sub reactions to reactions

# configuration
db_host
db_port
db_user
db_password
db_database
uniqueness_entity=name,kind,ownerUsers,field1
uniqueness_list=name,kind,ownerUsers,field1
autoapprove_entity=true
autoapprove_list=true
autoapprove_entity_reactions=true
autoapprove_list_reactions=true
limits_entity=10d,5m
limits_list=3s,2m
limits_entity_reactions=
limits_list_reactions=


Auto approve configuration is implemented but this implementation provides very simple auto approving capabilities.
In the need of enabling auto approve under certain conditions, users are encouraged to configure it using gateway policies. By the help of gateway policies, auto approve can be configured using 'kind' of the targeted record, user's roles, etc. For example, you can enable autoapprove when an entity is created by the editor or admin, but disable for regular users.


# Deploying to Kubernetes
*
