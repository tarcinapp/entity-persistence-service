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
limits_entity=10d,5m,
limits_list=3s,2m
autoapprove_entity=true

Auto approve is implemented but can not be configured by user roles as authorization is delegated to gateway.



[![LoopBack](https://github.com/strongloop/loopback-next/raw/master/docs/site/imgs/branding/Powered-by-LoopBack-Badge-(blue)-@2x.png)](http://loopback.io/)

# Deploying to Kubernetes
*
