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

Auto approve is not implemented as it may change user roles. Does not contain any authorization logic. Authorization logic is delegated to gateway application.



[![LoopBack](https://github.com/strongloop/loopback-next/raw/master/docs/site/imgs/branding/Powered-by-LoopBack-Badge-(blue)-@2x.png)](http://loopback.io/)

# Deploying to Kubernetes
* Create a ConfigMap named tarcinapp-config with key app.config.json and value the json configuration
