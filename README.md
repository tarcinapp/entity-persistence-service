- [Entity Persistence Service](#entity-persistence-service)
  - [What is Tarcinapp?](#what-is-tarcinapp)
  - [Features](#features)
  - [Benefits](#benefits)
- [Getting Started](#getting-started)
- [Core Concepts](#core-concepts)
  - [Data Model](#data-model)
    - [Store Any Shape of Data](#store-any-shape-of-data)
    - [Decoration with Managed Fields](#decoration-with-managed-fields)
    - [Using `_kind` to Organize Data Variants](#using-_kind-to-organize-data-variants)
    - [Build Hierarchical Structures Across Models](#build-hierarchical-structures-across-models)
    - [Data Relations](#data-relations)
      - [Types of Relationships](#types-of-relationships)
    - [Entity Model](#entity-model)
    - [List Model](#list-model)
    - [List-Entity Relation Model](#list-entity-relation-model)
    - [Reactions Model](#reactions-model)
      - [List Reactions](#list-reactions)
      - [Entity Reactions](#entity-reactions)
  - [Role \& Responsibilities of the Gateway Component](#role--responsibilities-of-the-gateway-component)
  - [Querying Data](#querying-data)
    - [Standard Filtering Syntax](#standard-filtering-syntax)
      - [`filter[where]` and `where[...]` — Conditional Filtering](#filterwhere-and-where--conditional-filtering)
      - [`filter[fields]` — Field Selection](#filterfields--field-selection)
      - [`filter[include]` — Related Models](#filterinclude--related-models)
      - [`filter[order]` — Sorting](#filterorder--sorting)
      - [`filter[limit]` — Pagination Limit](#filterlimit--pagination-limit)
      - [`filter[skip]` — Offset](#filterskip--offset)
    - [Sets](#sets)
      - [Available Sets](#available-sets)
      - [Usage of Sets](#usage-of-sets)
      - [Example Use Cases](#example-use-cases)
    - [Including and Querying Relations](#including-and-querying-relations)
      - [What Can Be Included](#what-can-be-included)
      - [Apply Scope to Included Relations](#apply-scope-to-included-relations)
      - [Notes](#notes)
    - [Lookup References](#lookup-references)
      - [How Lookups Work in Tarcinapp](#how-lookups-work-in-tarcinapp)
      - [Arrays and Nested Lookups](#arrays-and-nested-lookups)
      - [Lookup Scope](#lookup-scope)
      - [Admin Constraints](#admin-constraints)
      - [System Limits](#system-limits)
      - [Lookups and Hierarchies](#lookups-and-hierarchies)
      - [Summary](#summary)
    - [Querying the List-Entity-Relation Record](#querying-the-list-entity-relation-record)
    - [Using `through` Filters](#using-through-filters)
  - [Relations](#relations)
    - [Lookups](#lookups)
      - [Reference Types](#reference-types)
      - [Query Structure](#query-structure)
      - [Examples](#examples)
      - [Lookup Scope Options](#lookup-scope-options)
      - [Performance Considerations](#performance-considerations)
  - [Programming Conventions](#programming-conventions)
    - [Managed Fields](#managed-fields)
- [Configuration](#configuration)
    - [Database](#database)
    - [Allowed Kinds](#allowed-kinds)
    - [Uniqueness](#uniqueness)
      - [Configuration Syntax](#configuration-syntax)
      - [Examples](#examples-1)
      - [Error Response](#error-response)
    - [Auto Approve](#auto-approve)
    - [Visibility](#visibility)
    - [Response Limits](#response-limits)
    - [Record Limits](#record-limits)
      - [Configuration Mechanism](#configuration-mechanism)
      - [Configuration Schema](#configuration-schema)
      - [Dynamic Value Interpolation](#dynamic-value-interpolation)
      - [Common Use Cases and Examples](#common-use-cases-and-examples)
      - [Filter Expressions](#filter-expressions)
      - [Set Expressions](#set-expressions)
      - [Error Handling](#error-handling)
    - [Idempotency](#idempotency)
- [Deployment](#deployment)
- [Configuring for Development](#configuring-for-development)
- [Known Issues and Limitations](#known-issues-and-limitations)
    - [1. Idempotency and Visibility](#1-idempotency-and-visibility)
    - [2. Field Selection with Arbitrary Fields](#2-field-selection-with-arbitrary-fields)
    - [3. Version Incrementation for Update All operations.](#3-version-incrementation-for-update-all-operations)
    - [4. Dot Notation in Connected Model Filters for List-Entity Relations](#4-dot-notation-in-connected-model-filters-for-list-entity-relations)
- [References](#references)
  - [Endpoints Reference](#endpoints-reference)
    - [EntityController](#entitycontroller)
    - [ListController](#listcontroller)
    - [ListEntityRelController](#listentityrelcontroller)
    - [EntitiesThroughListController](#entitiesthroughlistcontroller)
    - [ListsThroughEntitiesController](#liststhroughentitiescontroller)
    - [EntityReactionController](#entityreactioncontroller)
    - [ReactionsThroughEntityController](#ReactionsThroughEntityController)
    - [ListReactionController](#listreactioncontroller)
    - [ReactionsThroughListsController](#reactionsthroughlistscontroller)
    - [PingController](#pingcontroller)
  - [Error Codes Reference](#error-codes-reference)

# Entity Persistence Service

📌 **Entity Persistence Service** is a REST-based backend microservice and a **core component** of the **Tarcinapp** ([What is Tarcinapp?](#what-is-tarcinapp)).

📌 It is built on a simple yet powerful data model composed of **entities**, **lists**, and **reactions**, each represented as JSON documents stored in MongoDB. See [Data Model](#data-model) or take a look at the [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json) for more information.

📌 This generic, extensible model allows developers to represent a wide variety of use cases across different domains by reusing and configuring the same foundational components.

📌 Each model can store arbitrary properties.

📌 For example:
- **Entities** can represent user profiles, configuration objects, notification, blog posts, products, campaigns, documents, or even IoT devices.
- **Lists** can model playlists, wishlists, saved searches, shopping carts, or collections.
- **Reactions** can track likes, ratings, flags, reviews, bookmarks, follows, or measurement signals from IoT devices.

📌 Each record — whether an entity, list, or reaction — is automatically decorated with a set of **managed fields**, including:
- `_id`
- `_ownerUsers`, `_ownerGroups`
- `_viewerUsers`, `_viewerGroups`
- `_visibility`
- `_parents`
- `_createdBy`
- `_createdDateTime`
- `_lastUpdatedBy`
- `_lastUpdatedDateTime`
- `_version`
- `_idempotencyKey`
- and more...

These fields are used for various purposes, such as traceability, and are evaluated by the gateway to support essential functionality, including access control, idempotency, and distributed locking.

## What is Tarcinapp?

**Tarcinapp** is a modular backend microservices suite designed to streamline common challenges in REST-based backend development, helping teams reduce **Time-to-Value** from concept to deployment.

While many tools exist to generate REST APIs from JSON schemas, they often stop at basic CRUD operations. These solutions typically lack support for more advanced concerns—such as managing **relationships between records**, handling **ownership and access control**, or modeling **user interactions in post-login scenarios**.

Tarcinapp addresses these gaps with **opinionated models**, built-in metadata, and a gateway architecture that enables secure, configurable behaviors out of the box.

The suite is composed of purpose-specific services for different layers of a modern backend system, including:

- `entity-persistence-dos`
- `entity-persistence-gateway`
- `entity-persistence-gateway-policies`
- `entity-persistence-orchestration`
- `entity-persistence-bff`
- `entity-persistence-service` _(you are here)_

<p align="left">
  <img src="./doc/img/high-level-arch.png" alt="Tarcinapp Data Model">
</p>

📘 For a full overview and integration guidance, refer to the [Tarcinapp Suite Documentation](#).

Documentation for each Tarcinapp component is available in their respective repositories:

📄 [entity-persistence-gateway](#)
📄 [entity-persistence-gateway-policies](#)

## Features

- 🔍 **Advanced querying** via flexible query string notation
- 📈 **Record limits** by user, type, or custom context (e.g., number of entities in a list)
- 🔒 **Uniqueness constraints** across user or global scopes
- 📦 **Paginated responses** with configurable limits
- 👥 **Ownership & viewership metadata** to support role-based access enforcement via gateway
- 🌀 **Idempotent operations**, configurable per use case
- 🌐 **Visibility levels** (`public`, `protected`, `private`) with default enforcement
- ✅ **Approval gating** using `validFromDateTime`
- 🗑️ **Soft deletion** via `validUntilDateTime`
- 🕓 **Full audit metadata tracking** (created/updated timestamps and users)

## Benefits
> ⚡ **Tarcinapp dramatically reduces time-to-value** for digital products by delivering a ready-to-use backend built on practical defaults. With generic yet powerful data structures (entities, lists, reactions), configurable authorization, and automation-ready metadata, developers can go from concept to working prototype in days—not weeks.
- **Generic data model** for diverse use cases:  
  - **Entities**: products, users, blog posts, devices  
  - **Lists**: shopping carts, saved searches, collections  
  - **Reactions**: likes, ratings, reviews, measurements

- **Relationship support** between entities and lists enables nested structures like categories, playlists, campaign groups, and workflows.

- **Ownership and access control** with built-in fields like `_ownerUsers`, `_viewerGroups`, `_visibility`—integrated with the gateway for full authorization enforcement.

- **Idempotency and uniqueness** support via configurable fields and scopes.  
  _Example: Prevent duplicate product names per seller._

- **Flexible querying and pagination**, with alias-based filters and response size limits to simplify client logic and protect performance.

- **Approval and soft deletion** using `_validFromDateTime` and `_validUntilDateTime`.  
  _Example: Schedule future-dated articles or auto-expiring invites._

- **Distributed locking** ensures race condition protection when creating or updating data—powered by Redis via the gateway.

- **Custom record constraints** to limit number of entities, reactions, or list items globally, per user, or per context.

- **Optional schema validation** and reference resolution with tapp:// URIs for resolving related records dynamically.

# Getting Started

Once the application is up and running:

- It starts listening on **port 3000** for HTTP requests.
- If database is not provided, it spins up an in-memory MongoDB instance, for non-production environments
- Ready to integrate with entity-persistence-gateway
- Resources created through gateway are kept private to the creator users, and visible only to the creators
- Ready to create and query resources. See [Endpoints Reference](#endpoints-reference) or take a look at the [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json) for more information about the endpoints. 
- An empty request to `POST /entities` will create a new entity with following properties:
  <p align="left">
    <img src="./doc/img/request-response.png" alt="Tarcinapp Data Model">
  </p>
- Some properties (e.g. `_idempotencyKey`) are hidden from the response but can be used for querying and filtering. See [Managed Fields](#managed-fields) for more information.
- `_createdBy`, `_ownerUsers` and `_lastUpdatedBy` are populated with the user id of the creator, **when request is made through the gateway.**
- You can use payload to pass arbitrary properties to the request. Incoming payload will be merged with the managed fields.
- See [Querying Data](#querying-data) for more information about the advanced querying capabilities.
- Configure the behavior of the service, such as default visibility, record limits, and more, through environment variables. See [Configuration](#configuration) for more information.
- Experiment with creating and querying Entities, Lists, ListEntityRelations and Reactions (See [Endpoint Reference](#endpoints-reference) for more information)

# Core Concepts

- [Data Model](#data-model)
- [Role & Responsibilities of the Gateway Component](#role--responsibilities-of-the-gateway-component)
- [Querying Data](#querying-data)
- [Relations](#relations)
- [Sets](#sets)
- [Programming Conventions](#programming-conventions)



## Data Model

Many digital applications—despite differing in purpose—share a set of common data relationships. Based on this observation, Entity Persistence Service defines a generic yet expressive data model consisting of **entities**, **lists**, and **reactions**.

This structure is designed to flexibly represent a wide range of use cases, including startup MVPs, AI-driven tools, internal request systems, feedback collectors, collaborative platforms, user notifications systems, and user preference managers.
  
<p align="left">
  <img src="./doc/img/models.png" alt="Tarcinapp Data Model">
</p>

### Store Any Shape of Data

Each model—Entity, List, Reactions, and even ListEntityRelation—can hold arbitrary JSON structures tailored to your application's needs. This allows you to enrich records with domain-specific fields without rigid schemas.

When structure is needed, the gateway can validate these records against configurable **JSON Schemas** based on their `_kind`, offering the best of both flexibility and consistency.

### Decoration with Managed Fields

When records are created or updated through **Entity Persistence Service**, the system automatically **decorates the incoming JSON data** with a set of managed fields. These fields support core capabilities like:

- Ownership and visibility control (`_ownerUsers`, `_viewerGroups`, `_visibility`)
- Metadata tracking (`_createdBy`, `_lastUpdatedDateTime`, `_version`)
- Query optimizations (`_parentsCount`, `_ownerUsersCount`, etc.)

Managed fields are either:
- **Strictly controlled** by the application (e.g., `_version`, `_idempotencyKey`)
- **Auto-filled** when missing (e.g., `_slug`, `_creationDateTime`)
- **Policy-controlled**: their visibility and mutability depend on security policies evaluated at the gateway level

See the example below for a request to create an entity and the decorated data stored in the database:
<p align="left">
  <img src="./doc/img/request-decoration.png" alt="Tarcinapp Data Model">
</p>

Some fields are returned in API responses, while others are hidden but still play an important role in filtering. For example:  
This query returns all top-level records (i.e., those without parents), thanks to the internally computed `_parentsCount`.  
`GET /entities?filter[where][_parentsCount]=0`  

See [Managed Fields](#managed-fields) or [Querying Data](#querying-data) for more information.

### Using `_kind` to Organize Data Variants

Each model (entity, list, list-entity-relation, list-reaction, entity-reaction) includes an optional `_kind` field used to distinguish different types of data stored within the same MongoDB collection. By default, this field is auto-filled with the model name (`entity`, `list`, `list-entity-relation`, `list-reaction`, `entity-reaction`, etc.), but it can be customized to represent domain-specific subtypes.

This allows applications to store diverse schemas under a shared model—for example, storing `blog-post`, `product`, and `profile` under the same `entity` collection— **while still enabling filtering, validation, or constraints based on kind.**

The `_kind` field is especially helpful when the application needs to apply different logic, limits, or schema validations per subtype. Admins can configure allowed `_kind` values for each model to enforce consistency and avoid accidental misuse.

> In gateway-based deployments, `_kind` also enables **endpoint-level abstraction**. For example, the gateway can expose `/books` and route it to the `/entities` model while automatically scoping all operations to records where `_kind` is `book`. This makes the API feel more domain-specific without duplicating storage or code.

### Build Hierarchical Structures Across Models

Each core model — Entity, List, EntityReaction, ListReaction — supports hierarchy out of the box. A record can define one or more parents using special reference fields (`_parents`), enabling the creation of nested structures.

This allows you to represent:
- Entity taxonomies (e.g., categories and subcategories)
- List groupings (e.g., curated playlist collections)
- Threaded reactions (e.g., nested comments or replies)

Hierarchies are navigable via `{id}/parents` and `{id}/children` endpoints, and can be controlled with configurable constraints to match your application's needs.

### Data Relations

Tarcinapp takes a comprehensive and opinionated approach to handling data relationships, acknowledging that real-world applications almost always involve complex relational data. While many backend tools focus on exposing isolated JSON resources via REST, they often fall short when it comes to solving the real complexities introduced by **resource relationships**—especially in post-login use cases that involve ownership, access control, and user-specific behavior.

Tarcinapp embraces relationships as a **first-class concept**, supporting them out of the box with built-in behavior and authorization logic.

#### Types of Relationships

Tarcinapp supports several types of relationships out of the box:

- **Hierarchical Relations**  
  Entities, lists, and reactions can each reference parent records of the same type. This enables nested structures such as categories, folders, workflows, or threaded comments.  
  > Example: `/entities/{id}/parents`, `/lists/{id}/children`

- **List-Entity Relations**  
  Lists can contain multiple entities, and an entity can belong to many lists. These many-to-many connections are handled by a dedicated `ListEntityRelation` model that also allows storing metadata (e.g., addedAt, position). See [List-Entity Relation Model](#list-entity-relation-model) for more information.
  - Visibility and access are derived from both the list and the entity.  
  - Gateway enforces: user must **own the list** and **see the entity** to create a relation.  
  > Example: `/lists/{id}/entities`, `/entities/{id}/lists`

- **Reactions**  
  Reactions are flexible data records used to represent interactions or events associated with entities or lists. While they can model familiar actions like likes, ratings, and comments, they can also used to represent more technical or domain-specific use cases—such as status updates, event logs, or signals from IoT devices.  
  Users must be able to **view** the target entity or list to create or access a reaction.  
  > Example: `/entities/{id}/reactions`, `/lists/{id}/reactions`

- **Lookups (Reference Resolution)**  
  Any field in a record can act as a pointer to another record using `tapp://` URIs. This supports lightweight references (similar to foreign keys) and can resolve those references at query time, applying filters and access controls.  
  - Works for nested paths, arrays, and scalar fields  
  - Gateway enforces authorization during resolution  
  > Example:  
  > `/entities?filter[lookup][0][prop]=company`  
  > `/lists?filter[lookup][0][prop]=entities&filter[lookup][0][scope][lookup][0][prop]=parents`


### Entity Model
The Entity is the core data model that represents the primary objects in your application. It's typically the starting point when modeling your domain. Whether you're building a book review platform, an e-commerce store, a knowledge base, or a job board—books, products, articles, or job listings would all likely to be stored as entities. Entities hold the core business data and can be extended or connected to other models such as lists or reactions to build richer experiences. 

**Base Endpoint**: `/entities`  
**Entities under a list**: `/lists/{listId}/entities`  
**Parents of an entity**: `/entities/{entityId}/parents`  
**Children of an entity**: `/entities/{entityId}/children`


See [Endpoints Reference - EntityController](#entitycontroller) for overview about the endpoints.  
See [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json#tag/EntityController) for more information about the endpoints.

### List Model

The List model organizes collections of entities into meaningful groups. A single list can contain many entities, and an entity can belong to many lists. This many-to-many relationship is managed through a dedicated [ListEntityRelation](#list-entity-relation-model) model, enabling fine-grained control over each association. Lists themselves are also records that can hold arbitrary data and can be categorized by kind—such as "favorites," "watchlist," or "top_picks." Whether you're modeling playlists, reading lists, or campaign groupings, lists make it easy to structure and reuse related content across your application.

**Base Endpoint**: `/lists`  
**Entities under a list**: `/lists/{listId}/entities`  
**Parents of a list**: `/lists/{listId}/parents`  
**Children of a list**: `/lists/{listId}/children`

See [Endpoints Reference - ListController](#listcontroller) for overview about the endpoints.  
See [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json#tag/ListController) for more information about the endpoints.

### List-Entity Relation Model

The **ListEntityRelation** model manages the many-to-many relationship between entities and lists. It enables associating any entity with one or more lists, and vice versa, allowing you to build collections like "featured products," "reading lists," or "user watchlists."  

Each relation is represented as a separate record, containing mandatory `_listId` and `_entityId` fields. This design not only simplifies management of complex associations but also allows storing **custom metadata** for each relation. For example, when an entity is added to a list, you can attach contextual data like the reason for inclusion, sort order, tags, or notes.  

Thanks to ListToEntityRelation, you can:
- Query all **entities in a list** using `/lists/{listId}/entities`  
- Query all **lists an entity belongs to** using `/entities/{entityId}/lists`  

Additionally, responses for these queries include `_fromMetadata` and `_toMetadata` fields that expose the metadata attached to the relation from both sides (list → entity and entity → list), making it easy to customize display logic and behaviors based on relation context.

**Base Endpoint:** /relations  
**Entities under a list:** /lists/{listId}/entities  
**Lists containing an entity:** /entities/{entityId}/lists  

See [Endpoints Reference - ListEntityRelController](#listentityrelcontroller) for overview about the endpoints.  
See [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json#tag/ListEntityRelController) for more information about the endpoints.

### Reactions Model

The Reactions model enables applications to capture user interactions on both **entities** and **lists** in a structured, extensible way. These reactions are stored as standalone records and can represent a wide range of behaviors, such as likes, ratings, bookmarks, measurements, or comments.

Reactions are flexible:
- Allows arbitrary custom fields
- Supports parent-child hierarchies (e.g., threaded replies)
- Includes managed fields for visibility, ownership, and approval
- Configurable per `_kind`, allowing domain-specific behavior

#### List Reactions
List Reactions represent user interactions related to a **list**.

Each list reaction:
- Is a standalone record referencing a target list via `_listId`
- May include arbitrary metadata, such as scoring, flags, or comments
- Can be categorized using the `_kind` field (e.g., `like`, `flag`, `feedback`)
- Supports nesting through `_parents` for scenarios like threaded discussions
- Obeys access rules defined through `_ownerUsers`, `_viewerGroups`, and `_visibility`

**Base Endpoint**: `/list-reactions`  
**Reactions on a list**: `/lists/{listId}/reactions`  
**Parent reactions**: `/list-reactions/{reactionId}/parents`  
**Child reactions**: `/list-reactions/{reactionId}/children`

See [Endpoints Reference - ListReactionController](#listreactioncontroller)  
See [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json#tag/ListReactionController)

#### Entity Reactions

**Entity Reactions** represent interactions directed at a specific **entity**—such as a product, blog post, campaign, or user profile.

Each entity reaction:
- References a target entity via `_entityId`
- Uses the `_kind` field to define its purpose (e.g., `bookmark`, `measurement`, `review`)
- Can store arbitrary fields to capture custom logic or content
- Supports hierarchical relationships via `_parents`
- Inherits visibility and ownership controls enforced by the gateway

**Base Endpoint**: `/entity-reactions`  
**Reactions on an entity**: `/entities/{entityId}/reactions`  
**Parent reactions**: `/entity-reactions/{reactionId}/parents`  
**Child reactions**: `/entity-reactions/{reactionId}/children`

See [Endpoints Reference - EntityReactionController](#entityreactioncontroller)  
See [OpenAPI Specification](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/tarcinapp/entity-persistence-service/refs/heads/main/openapi.json#tag/EntityReactionController)


## Role & Responsibilities of the Gateway Component
The entity-persistence-service is designed to be a generic and flexible data store. By design, it does not handle access control, authentication, or any user-specific filtering. It responds to all valid queries with matching records, regardless of who the caller is or whether they are authorized to see the data.

Security, access control, and response shaping are handled by the entity-persistence-gateway, which sits in front of this service and evaluates incoming requests against authorization policies.

**What the Entity Persistence Service Does Not Do**

- It does not authenticate requests (no JWT verification)
- It does not evaluate roles or permissions
- It does not restrict records based on ownership, visibility, or viewer settings
- It does not perform field masking or redaction
- It does not check whether a user is allowed to see or modify a record

If queried directly, entity-persistence-service will return all records and all fields that match the request filter, regardless of visibility or access settings.

The **entity-persistence-gateway** performs all access-related responsibilities:

**Authentication and Role Validation**  
- Verifies JWTs to authenticate the user  
- Uses the user's roles to determine whether a request is allowed (e.g., whether a `visitor` can `PATCH /entities`)  

**Query Scope Enforcement**  
- Restricts results to only those records the user is authorized to see  
- Evaluates fields like `_visibility`, `_ownerUsers`, `_viewerGroups`, etc.  
- Ensures that even if a user requests all entities, lists, or reactions, they only receive records visible to them
- Even for the included relations or resolved lookups, the gateway will filter the records based on what the user is authorized to see

**Field-Level Access Control**  
- Removes fields from the response that the user is not authorized to see  
- This applies even if the user explicitly requests those fields via a `fields` filter  

**Record-Level Filtering**  
- Entire records are excluded from the response if the user does not have access, based on ownership, viewership, or visibility constraints  
- For example, if a user queries by ID for a private record they do not own or cannot view, the gateway blocks access—even if the record exists  

**Policy Enforcement**  
- Leverages Open Policy Agent (OPA) to enforce fine-grained access rules:  
  - Who can access which endpoints  
  - What fields are readable or writable  
  - When a record is visible or mutable based on `_kind`, user role, or metadata  

## Querying Data
All endpoints support advanced, structured querying via query string parameters. These allow clients to precisely control which records are returned, what fields are included, how results are filtered or sorted, and how relationships are traversed.

### Standard Filtering Syntax

The API supports a powerful and expressive query system using structured query string syntax. Standard filters are passed using the `filter[...]` parameter and can be combined to control which records are returned, which fields are included, how results are sorted, and more.

#### `filter[where]` and `where[...]` — Conditional Filtering

Defines constraints on which records to include in the result set.

You can use logical operators (`and`, `or`) and comparison operators (`gt`, `inq`, `like`, etc.) to filter on any field—including nested fields via dot notation.

**Examples:**

```http
GET /entities?filter[where][_kind]=product
GET /entities?filter[where][and][0][_kind]=product&filter[where][and][1][_visibility]=public
GET /entities?filter[where][views][gte]=100
GET /entities?filter[where][metadata.createdBy]=user123
GET /entities?filter[where][score][between][]=10&filter[where][score][between][]=20
```

**Note on where[...] for Count, UpdateAll, and DeleteAll**
In some operations where the filter object is not supported—such as count, updateAll, or deleteAll—you can use the shorthand syntax where[...] directly in the query string. This syntax uses the same operators and structure as filter[where], just without the wrapping filter.

**Examples:**

```http
GET /entities/count?where[status]=active
PATCH /entities?where[status]=draft
DELETE /entities?where[_kind]=temporary
```

This provides consistent filtering logic across all endpoints, regardless of whether a full filter object is accepted.

You can use comparison operators within `filter[where]` to match complex conditions:

| Operator  | Description                  | Example                                                                 |
| --------- | ---------------------------- | ----------------------------------------------------------------------- |
| `eq`      | Equal to (implicit)          | `filter[where][status]=active`                                          |
| `neq`     | Not equal to                 | `filter[where][status][neq]=archived`                                   |
| `gt`      | Greater than                 | `filter[where][score][gt]=100`                                          |
| `gte`     | Greater than or equal to     | `filter[where][score][gte]=100`                                         |
| `lt`      | Less than                    | `filter[where][score][lt]=100`                                          |
| `lte`     | Less than or equal to        | `filter[where][score][lte]=100`                                         |
| `inq`     | Value is in the list         | `filter[where][tag][inq][]=foo&filter[where][tag][inq][]=bar`           |
| `nin`     | Value is not in the list     | `filter[where][status][nin][]=archived`                                 |
| `between` | Between two values           | `filter[where][score][between][]=10&filter[where][score][between][]=20` |
| `like`    | Case-sensitive pattern match | `filter[where][name][like]=admin%25`                                    |
| `nlike`   | Not like (case-sensitive)    | `filter[where][name][nlike]=test%25`                                    |
| `ilike`   | Case-insensitive like        | `filter[where][name][ilike]=hello%25`                                   |
| `nilike`  | Case-insensitive not like    | `filter[where][name][nilike]=demo%25`                                   |
| `exists`  | Field exists or not          | `filter[where][metadata.field][exists]=true`                            |
| `regexp`  | Regular expression match     | `filter[where][email][regexp]=^.+@domain.com$`                          |

**Type Hinting for Non-String Fields**

Since all query string values are interpreted as strings by default, filtering on numeric or boolean fields requires explicit type annotation—unless the field is managed or the request passes through the gateway.

For example, the query below **will not work correctly** if `views` is a numeric field, because `"100"` is a string:

```http
GET /entities?filter[where][views][gt]=100
```

To ensure correct type conversion, include a type hint alongside the field:

```http
GET /entities?filter[where][views][gt]=100&filter[where][views][type]=number
```

Supported type hints:
- `number`
- `boolean`

If the request is made through the **gateway**, the gateway will automatically detect unmanaged field types based on the JSON schema for the `_kind`, and apply the necessary type conversions on behalf of the caller.

This automatic conversion allows clients to submit simplified queries while still benefiting from correct backend filtering.

**Special Case: Boolean and Null Literals**

Equality conditions involving certain literal values behave differently:

- If the right-hand side is the string `true` or `false`, it is **always interpreted as a boolean**.
  ```http
  GET /entities?filter[where][isActive]=true
  ```

- If the right-hand side is the string `"null"`, it is **interpreted as an actual `null` value** in filtering.
  ```http
  GET /entities?filter[where][deletedBy]=null
  ```

These behaviors allow for more natural and predictable querying, especially when checking for presence or absence of values.


#### `filter[fields]` — Field Selection

Controls which fields are included in the response. Fields not listed will be excluded.

**Examples:**

```http
GET /entities?filter[fields][name]=true&filter[fields][score]=true
GET /lists?filter[fields][_id]=false&filter[fields][title]=false
```

You can use this to reduce payload size or limit data exposure. See [2. Field Selection with Arbitrary Fields](#2-field-selection-with-arbitrary-fields) for the limitation with the arbitrary fields.

#### `filter[include]` — Related Models

The `filter[include]` option allows you to include related records (such as reactions or contained entities) directly within the response of a primary resource. This can reduce roundtrips and simplify client-side logic.

The available relations to include depend on the endpoint being queried. Each inclusion adds a new field (prefixed with `_`) to the response, populated with related data.

Find the detailed information about the `filter[include]` parameter in the [Including and Querying Relations](#including-and-querying-relations) section.

**Available Relations by Resource**

- **For Lists (`/lists`)**
  - `_entities`: All entities contained in the list
  - `_reactions`: All reactions attached to the list

  ```http
  GET /lists?filter[include][0][relation]=_entities&filter[include][1][relation]=_reactions
  ```

- **For Entities (`/entities`)**
  - `_reactions`: All reactions attached to the entity

  ```http
  GET /entities?filter[include][0][relation]=_reactions
  ```

**Response Behavior**

When `include` is used, the resulting records will have additional fields named after the relation (e.g., `_entities`, `_reactions`) that contain the related data.

**Example Response for `/lists` with `_entities` and `_reactions` included:**

```json
[
  {
    "_id": "list123",
    "_name": "Top Picks",
    "_slug": "top-picks",
    "_kind": "playlist",
    "_entities": [
      {
        "_id": "ent1",
        "_name": "Item A",
        "_slug": "item-a",
        "_kind": "product"
      },
      {
        "_id": "ent2",
        "_name": "Item B",
        "_slug": "item-b",
        "_kind": "product"
      }
    ],
    "_reactions": [
      {
        "_id": "react1",
        "_kind": "like",
        "_createdBy": "user123"
      }
    ]
  }
]
```

**Scoped Includes with `scope`**

You can apply filters to the related records using a `scope` sub-filter. This allows for precise inclusion of only matching related data.

**Example: Return lists with their contained entities, but only if the entity's `_kind` is `product`:**

```http
GET /lists?filter[include][0][relation]=_entities&filter[include][0][scope][where][_kind]=product
```

**Example: Include only public reactions on each entity:**

```http
GET /entities?filter[include][0][relation]=_reactions&filter[include][0][scope][where][_visibility]=public
```

**Scope supports all standard filters**, including:
- `where`
- `fields`
- `limit`, `skip`, `order`
- Nested `include` (where applicable)

This mechanism is useful for structured queries like:
- "Fetch a list and include only entities of a certain kind"
- "Get entities and only include visible reactions"
- "List playlists and show top 3 most recent included entities" 

#### `filter[order]` — Sorting

Sort results by one or more fields in ascending (`ASC`) or descending (`DESC`) order.

**Examples:**

```http
GET /entities?filter[order]=_createdDateTime DESC
GET /lists?filter[order]=title ASC
```

Multiple sorting levels can be chained:

```http
GET /entities?filter[order]=_kind ASC&filter[order]=name DESC
```

---

#### `filter[limit]` — Pagination Limit

Restricts the number of records returned in the response.

**Example:**

```http
GET /entities?filter[limit]=10
```

---

#### `filter[skip]` — Offset

Skips a number of records. Commonly used for pagination in combination with `limit`.

**Example:**

```http
GET /entities?filter[skip]=20&filter[limit]=10
```

This would return the third "page" if your page size is 10.

You can freely combine all of these filters in the same query to express powerful and precise logic.

**Example combining all:**

```http
GET /entities?filter[where][and][0][_kind]=article&filter[where][and][1][_visibility]=public&filter[fields][title]=true&filter[fields][summary]=true&filter[order]=_createdDateTime DESC&filter[limit]=5&filter[skip]=10
```

### Sets

Sets are predefined named filters that simplify common and reusable data selection patterns. Instead of writing long or complex filter conditions, users can use concise set names to apply meaningful filtering logic.

They are useful for quickly retrieving commonly scoped data like public items, active records, recently created entities, or ownership-based access views.

#### Available Sets

| Set Name    | Description                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `publics`   | Records where `_visibility` is `public`                                                                                |
| `privates`  | Records where `_visibility` is `private`                                                                               |
| `protecteds`| Records where `_visibility` is `protected`                                                                             |
| `actives`   | Records where `_validFromDateTime` is not null and in the past, and `_validUntilDateTime` is null or in the future     |
| `expireds`  | Records where `_validUntilDateTime` is in the past                                                                     |
| `pendings`  | Records where `_validFromDateTime` is null or in the future                                                            |
| `owners`    | Records where `_ownerUsers` or `_ownerGroups` contain the given user or group IDs. Requires `userIds` and `groupIds`   |
| `viewers`   | Records where `_viewerUsers` or `_viewerGroups` contain the given user or group IDs. Requires `userIds` and `groupIds` |
| `audience`  | Combines `actives`, `publics`, and ownership/viewership filters. Requires `userIds` and `groupIds`                     |
| `roots`     | Records where `_parentsCount` is 0 (i.e., not a child of any other record)                                             |


#### Dynamic Sets

Dynamic sets let you express time-bounded queries with flexible durations. Use the syntax:

```text
set[<base>-<N><unit>]=true
```

Where:
- `<base>` is one of `createds`, `expireds`, `actives`, `pendings`
- `<N>` is a positive integer
 - `<unit>` is one of (synonyms accepted):
   - `min` or `m` — minutes
   - `d` or `day`   — days
   - `w`   — weeks
   - `mon` or `mo` — months

Semantics:
- `createds-Nunit` — records created within the last N units
- `expireds-Nunit` — records that expired within the last N units (`_validUntilDateTime` in past and within the window)
- `actives-Nunit` — records that are currently active and whose `_validFromDateTime` falls within the last N units
- `pendings-Nunit` — records that are pending now (no validFrom or start is in future) and were created within the last N units

Examples:
```http
GET /entities?set[expireds-10min]=true    # expired in the last 10 minutes
GET /entities?set[expireds-10m]=true      # expired in the last 10 minutes (shortcut unit `m`)
GET /lists?set[createds-7d]=true          # created within the last 7 days
GET /lists?set[createds-7day]=true        # created within the last 7 days (synonym `day`)
GET /entities?set[actives-30d]=true       # became active within the last 30 days
GET /entities?set[createds-1mon]=true     # created within the last 1 calendar month
GET /entities?set[createds-1mo]=true      # created within the last 1 calendar month (synonym `mo`)
GET /entities?set[pendings-2w]=true       # pending and created within the last 2 weeks
```

#### Usage of Sets

- **Simple Named Filters**  
  Use sets like `?set[publics]` or `?set[actives]` to apply predefined filter logic without repeating full filter expressions.

- **Combining Sets with Logical Operators**  
  Use logical expressions like `and`, `or`, and `not` to compose multiple sets:
  
  ```http
  GET /entities?set[and][0][actives]&set[and][1][publics]
  ```

- **Mixing Sets with Other Filters**  
  Sets can be combined with standard filter clauses to refine results further:
  
  ```http
  GET /entities?set[actives]&filter[where][_kind]=config
  ```

- **Sets Inside Include Filters**  
  You can apply sets inside `filter[include]` to filter related records.  
  Example: Include only active and public entities in each list:
  
  ```http
  GET /lists?filter[include][0][relation]=_entities&filter[include][0][set][and][0][actives]&filter[include][0][set][and][1][publics]
  ```

- **Sets with User and Group Context**  
  The `owners`, `viewers`, and `audience` sets require you to specify which user and group IDs the filtering should consider.  
  Use the following query parameters to provide those identifiers:

  ```http
  GET /entities?set[owners][userIds]=user1,user2&set[owners][groupIds]=group1,group2
  GET /entities?set[viewers][userIds]=user1&set[viewers][groupIds]=group1
  GET /entities?set[audience][userIds]=user1&set[audience][groupIds]=group1
  ```

  These parameters are used to check whether the caller is listed in the `_ownerUsers`, `_ownerGroups`, `_viewerUsers`, or `_viewerGroups` fields of a record.

- **Role-Based Enforcement**  
  Sets can be automatically enforced by the gateway depending on the user's role or scope.  
  For example, a read-only user might always receive data filtered by the `audience` set, regardless of the filters provided in the query.

#### Example Use Cases

- **Fetch active and public blog entities**

  ```http
  GET /entities?set[and][0][actives]&set[and][1][publics]&filter[where][_kind]=blog
  ```

- **Get all root-level public items**

  ```http
  GET /entities?set[and][0][roots]&set[and][1][publics]
  ```

- **Retrieve lists created in the last week**

  ```http
  GET /lists?set[createds-7d]=true
  ```

- **Fetch entities owned by specific users or groups**

  ```http
  GET /entities?set[owners][userIds]=user1,user2&set[owners][groupIds]=group1,group2
  ```

- **Fetch entities viewable by specific users or groups**

  ```http
  GET /entities?set[viewers][userIds]=user3&set[viewers][groupIds]=groupX
  ```

- **Fetch records visible to a user's audience scope (active, public, or owned/viewable)**

  ```http
  GET /entities?set[audience][userIds]=user5&set[audience][groupIds]=groupZ
  ```

  - **Fetch private items only**

    ```http
    GET /entities?set[privates]
    ```

  - **Fetch protected items only**

    ```http
    GET /entities?set[protecteds]
    ```


Sets provide a convenient and secure abstraction for filtering data while keeping API requests short and expressive.
### Including and Querying Relations

Tarcinapp allows you to include related records in the response of a query—so that one HTTP request can return not only the main resource but also its associated data. This is called **inclusion**, and it helps reduce the number of API calls required by your frontend or client.

For example, when querying a list, you can include its related entities and reactions in the same response:

```json
{
  "_id": "list-id",
  "_name": "My List",
  "_entities": [
    { "_id": "entity-1", "title": "Example Entity" }
  ],
  "_reactions": [
    { "_id": "reaction-1", "type": "like" }
  ]
}
```

This is done using `filter[include]` parameters in your request.

#### What Can Be Included

The following inclusions are supported:

* **When querying lists: `GET /lists`**
  * "_entities" — include entities under the list
  * "_reactions" — include reactions posted to the list
* **When querying entities: `GET /entities`**
  * "_reactions" — include reactions posted to the entity

**Example: Include Reactions in Entity Query**  
```http
GET /entities?filter[include][][relation]=_reactions
```

**Example: Include Reactions and Entities in List Query**  
```http
GET /lists?filter[include][0][relation]=_entities&filter[include][1][relation]=_reactions
```

**Example: Include Reactions in Single Entity Fetch**  
```http
GET /entities/{entityId}?filter[include][][relation]=_reactions
```

**Filtering Included Relations with scope**  
You can also filter the included related data using the scope parameter. This applies a filter to the included relation, similar to how you filter the main resource.

**Example: Include only reactions of type like**  

```http
GET /entities?filter[include][0][relation]=_reactions&filter[include][0][scope][where][type]=like
```

**Example: Include related entities sorted by name**  
```http
GET /lists?filter[include][0][relation]=_entities&filter[include][0][scope][order]=name ASC
```

#### Apply Scope to Included Relations

* **where** — filter the included records
* **fields** — include only selected fields
* **order** — sort the included records
* **limit**, **skip** — pagination of included records
* **set** — predefined sets
* **lookup** — resolve references inside the included relation
* **include** — include nested related records (lists → entities → reactions)

See [Standard Filtering Syntax](#standard-filtering-syntax) for more details.

#### Notes

* Relation names like _entities and _reactions are predefined by Tarcinapp for inclusion.
* Inclusion works with both GET /{model} (list) and GET /{model}/{id} (single record).
* Use scope to narrow or customize the included related data.

### Lookup References

In JSON-based APIs, it's common to relate one record to another by storing an identifier as a field. For example:

~~~json
{
  "title": "Laptop",
  "supplierId": "abc123"
}
~~~

This `supplierId` acts as a foreign key to another object (e.g., a supplier entity). However, such references alone are not useful unless they can be **resolved**—i.e., turned into full objects on demand.

Tarcinapp provides a powerful **lookup mechanism** to enable this.

#### How Lookups Work in Tarcinapp

Instead of plain string IDs, Tarcinapp uses a standardized URI-like reference format:

~~~json
{
  "supplierCompany": "tapp://localhost/entities/abc123"
}
~~~

- `tapp://` is the protocol
- `localhost` is the host (future-proofing for resolving across instances)
- `entities` is the resource type (`entities`, `lists`, `entity-reactions`, or `list-reactions`)
- `abc123` is the unique ID of the referenced record

When querying, you can **resolve** such references into full objects using the `filter[lookup]` query parameter:

~~~http
GET /entities?filter[lookup][0][prop]=supplierCompany
~~~

Response:

~~~json
{
  "_id": "product-id",
  "supplierCompany": {
    "_id": "abc123",
    "_name": "ACME Inc."
  }
}
~~~

#### Arrays and Nested Lookups

References can also be stored as arrays or nested fields. Tarcinapp resolves these too:

~~~json
{
  "suppliers": [
    "tapp://localhost/entities/supplier1",
    "tapp://localhost/entities/supplier2"
  ]
}
~~~

Query:

~~~http
GET /entities?filter[lookup][0][prop]=suppliers
~~~

Or for a nested property:

~~~http
GET /entities?filter[lookup][0][prop]=metadata.references.parent
~~~

#### Lookup Scope

Lookups support advanced query options via the `scope` parameter, similar to relation includes. This allows filtering, selecting fields, pagination, sorting, and even nested lookups within the resolved objects.

**Examples**:

- **Filter resolved objects**:

  ~~~http
  GET /entities?filter[lookup][0][prop]=suppliers&filter[lookup][0][scope][where][_kind]=company
  ~~~

- **Only include selected fields**:

  ~~~http
  GET /entities?filter[lookup][0][prop]=suppliers&filter[lookup][0][scope][fields][name]=true
  ~~~

- **Sort resolved results**:

  ~~~http
  GET /entities?filter[lookup][0][prop]=suppliers&filter[lookup][0][scope][order]=name ASC
  ~~~

- **Nested lookups**:

  ~~~http
  GET /entities?filter[lookup][0][prop]=suppliers&filter[lookup][0][scope][lookup][0][prop]=parent
  ~~~

#### Admin Constraints

Admins can configure **lookup constraints** for specific fields:

- Limit **what types** of records a property can reference (e.g., only `entities`).
- Enforce **specific `_kind` values** on the target objects (e.g., only entities of kind `company`).
- Specify **which fields** are allowed to contain lookups.

This ensures schema integrity while maintaining flexibility.

See [Lookup Configuration](#lookup-configuration) for constraint options.

#### System Limits

- Lookup resolution is subject to the **response size limits** defined for the entity kind.

#### Lookups and Hierarchies

Tarcinapp uses lookups internally to manage **parent-child hierarchies** between records. Every record can contain a `_parents` array of references:

~~~json
{
  "_parents": [
    "tapp://localhost/entities/parent-id-1",
    "tapp://localhost/entities/parent-id-2"
  ]
}
~~~

When you call:

~~~http
GET /entities/{id}/parents
~~~

The system performs a lookup on the `_parents` field and returns the resolved objects. This enables tree-like structures, category hierarchies, and nested relationships.

#### Summary

- Tarcinapp allows you to define and resolve rich object relationships using tapp:// reference strings.
- Lookups are safe, secure (via gateway-based access control), and flexible.
- Powerful query syntax lets you shape resolved data exactly as needed.
- The same mechanism powers internal features like hierarchy traversal.
- Admins can restrict and validate lookup behavior via configuration.


### Querying the List-Entity-Relation Record

List-Entity-Relation records (model `ListToEntityRelation`) represent the membership of an `Entity` in a `List`. Each relation is a first-class record with at least `_listId` and `_entityId` and can store arbitrary metadata (for example, position, reason, addedAt, or a relation `_kind`).

You can query relations directly via `/relations`, or use "through" endpoints to query one side via the relation (for example, `/lists/{id}/entities` and `/entities/{id}/lists`). The relation query surface exposes two layers of filters:

- relation-level filters: filter the relation documents themselves (fields like `_listId`, `_entityId`, `_kind`, or any custom metadata stored on the relation)
- connected-resource filters: filter the joined `list` or `entity` documents that the relation refers to

Key parameters and their semantics:

- `filter` (or `where` for non-GET operations) — filter the primary resource returned by the endpoint (e.g., when calling `/lists/{id}/entities` this filters the `Entity` documents)
- `filterThrough` / `whereThrough` — filter the relation document that connects the resources (applies to through endpoints such as `/lists/{id}/entities`)
- `listFilter` / `listWhere` / `listSet` — when querying `/relations`, use these to filter properties of the connected `List` documents
- `entityFilter` / `entityWhere` / `entitySet` — when querying `/relations` or reactions endpoints, use these to filter properties of the connected `Entity` documents

Examples

- Get relations where the connected entity is public:

```http
GET /relations?entityFilter[where][_visibility]=public
```

- Get entity reactions that are tied to public entities ("get me reactions of public entities"):

```http
GET /entity-reactions?entityFilter[where][_visibility]=public
```

- Combine reaction-level and entity-level conditions (likes on public entities):

```http
GET /entity-reactions?filter[where][_kind]=like&entityFilter[where][_visibility]=public&filter[limit]=20
```

- Get entities inside a list but only where the relation record has `_kind=consists`:

```http
GET /lists/{listId}/entities?filterThrough[where][_kind]=consists
```

- Update all entities in a list where the relation kind is `consists` and the entity has `status=draft` (PATCH uses `where` / `whereThrough`):

```http
PATCH /lists/{listId}/entities?where[status]=draft&whereThrough[_kind]=consists
Body: { "status": "published" }
```

Notes and tips

- `filterThrough` / `whereThrough` only filter fields present on the relation document (they run before lookups in the aggregation pipeline). To filter by properties of the connected `List` or `Entity`, use `listFilter` / `entityFilter` instead.
- For `GET` endpoints the controllers accept `filter` and `filterThrough` objects. For bulk update or delete operations the controllers accept `where` and `whereThrough` shorthand variants that behave the same but fit LoopBack's update/delete API patterns.
- Use `listSet` / `entitySet` or `setThrough` to apply predefined named sets (for example `publics`, `actives`) to connected resources or to the relation itself.


### Using `through` Filters

Through endpoints and relation-aware endpoints accept both the standard LoopBack-style `filter`/`where` parameters and a set of extended parameters that allow targeting the relation layer or the connected resource layer explicitly. Below is a concise map of the parameters you will encounter and when to use each one.

- `filter` (GET) / `where` (PATCH/DELETE): filters applied to the primary resource returned by the endpoint.
- `filterThrough` (GET) / `whereThrough` (PATCH/DELETE): filters applied to the through/relation record. Use to restrict results by relation metadata (for example relation `_kind`, timestamps on the relation, or custom relation fields).
- `listFilter`, `listWhere`, `listSet`: apply filters or sets to the connected `List` documents when querying relations or performing counts against relations.
- `entityFilter`, `entityWhere`, `entitySet`: apply filters or sets to the connected `Entity` documents when querying relations or reactions.
- `set`, `setThrough`: use predefined named sets (for example `publics`, `actives`, `roots`) to apply common scopes. `setThrough` applies these named sets to relation records; `entitySet`/`listSet` apply to connected resources.

Examples (common patterns):

- Filter by relation metadata (relation-level filter):

```http
GET /lists/{listId}/entities?filterThrough[where][_kind]=positioned
```

- Filter by target resource properties (target-level filter):

```http
GET /lists/{listId}/entities?filter[where][_visibility]=public
```

- Filter relations by connected list properties (useful when listing relations themselves):

```http
GET /relations?listFilter[where][_kind]=featured
```

- Filter reactions by properties of the connected entity (get reactions on public entities):

```http
GET /entity-reactions?entityFilter[where][_visibility]=public
```

Encoding nested properties in query strings

When you need to target nested properties prefer the nested-object query form rather than raw dot-notation in the query key. For example, to filter by `metadata.status.current` on an entity prefer:

```http
GET /entities?filter[where][metadata][status][current]=active
```

This form is reliably parsed into a nested `where` object by the server. In some endpoints and clients direct dot-notation keys (for example `filter[where][metadata.status.current]`) may not be parsed consistently—see Known Issue #4 for details about limitations when using dot-notation against connected models in relation queries.

Summary (quick cheat-sheet):

- GET /relations — use `filter` for relation fields, `entityFilter` to filter the connected entity, `listFilter` to filter the connected list.
- GET /lists/{id}/entities — use `filter` to filter the returned entities, `filterThrough` to filter the relation records that connect the list and entities.
- GET /entities/{id}/lists — same as above with roles swapped.




## Relations

Relations are individual records just like entities and lists. Relations can hold arbitrary data along with the managed fields. Each time a relation is queried existence of the source and the target record is always checked. With the help of the relations entities under specific list, or reactions under specific list or entity can be queried.  
`/lists/{listId}/entities`  
`/entities/{entityId}/reactions`  
While querying the target record with the notation above, users can filter by the relation object using the `filterThrough` extension. For instance:  
`/lists/{listId}/entities?filterThrough[where][kind]=consists`  

### Lookups

The application provides a powerful lookup mechanism that allows you to resolve entity references in your queries. This feature supports various types of relationships and nested property lookups.

#### Reference Types

The lookup mechanism supports different types of references based on the reference string format:

- Entity References: `tapp://localhost/entities/{entityId}`
- List References: `tapp://localhost/lists/{listId}`

#### Query Structure

Lookups can be specified in the filter query string using the `lookup` parameter. The structure is similar to Loopback's relation queries:

Basic lookup:

```http
GET /entities?filter[lookup][0][prop]=parents
```

Lookup with field selection:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][0][scope][fields][name]=true
```

Lookup with where conditions:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][0][scope][where][_kind]=category
```

Lookup with sets:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][0][set][actives]
```

Multiple lookups:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][1][prop]=children
```

Nested lookups:

```http
GET /entities?filter[lookup][0][prop]=parents.foo.bar
```

#### Examples

1. **Basic Entity Lookup**

Get entities with their parent entities resolved:

```http
GET /entities?filter[lookup][0][prop]=parents
```

2. **List-Entity Lookup**

Get lists with their entities resolved:

```http
GET /lists?filter[lookup][0][prop]=entities
```

3. **Nested Property Lookup**

Get entities with nested references resolved:

```http
GET /entities?filter[lookup][0][prop]=metadata.references.parent
```

4. **Lookup with Field Selection**

Get entities with specific fields from their parents:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][0][scope][fields][name]=true
```

5. **Lookup with Conditions**

Get entities with active parents only:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][0][set][actives]
```

6. **Multiple Lookups**

Get entities with both parents and children resolved:

```http
GET /entities?filter[lookup][0][prop]=parents&filter[lookup][1][prop]=children
```

7. **List with Entity Lookups**

Get lists with their entities and entity parents resolved:

```http
GET /lists?filter[lookup][0][prop]=entities&filter[lookup][0][scope][lookup][0][prop]=parents
```

#### Lookup Scope Options

The `scope` parameter in lookups supports various options:

- `fields`: Select specific fields to include in the resolved entities
- `where`: Apply conditions to filter the resolved entities
- `set`: Apply predefined sets to filter the resolved entities
- `lookup`: Define nested lookups for the resolved entities
- `limit`: Limit the number of resolved entities
- `skip`: Skip a number of resolved entities
- `order`: Sort the resolved entities

#### Performance Considerations

- Lookups are resolved in batches to minimize database queries
- Field selection helps reduce data transfer
- Nested lookups are processed recursively

## Programming Conventions

1. All database models have id property and it is generated at server side with guid.
2. DateTime fields names are end with '`dateTime`'
3. All managed fields are prefixed with underscore.
Here are the list of common field names.

### Managed Fields

| Field Name               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **_id**                  | A string field represents the id of the record.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **_kind**                | A string field represents the kind of the record.  As this application built on top of a schemaless database, objects with different schemas can be considered as different kinds can be stored in same collection. This field is using in order to seggregate objects in same collection. Most of the configuration parameters can be specialized to be applied on specific kind of objects. **This field is immutable and cannot be changed after creation.** |
| **_name**                | String field represents the name of the record. Mandatory field.                                                                                                                                                                                                                                                                                                                                                                                                |
| **_slug**                | Automatically filled while create or update with the slug format of the value of the name field.                                                                                                                                                                                                                                                                                                                                                                |
| **_visibility**          | Record's visibility level. Can be either `private`, `protected` or `public`. Gateway enforces query behavior based on the visibility level and caller's authorization.                                                                                                                                                                                                                                                                                          |
| **_version**             | A number field that automatically incremented each update and replace operation. Note: `_version` is not incremented if record is updated with `updateAll` operation. Callers are not allowed to modify this field.                                                                                                                                                                                                                                             |
| **_entityId**            | A string field represents the id of the entity. Only used in list-entity-relation and entity-reaction models.                                                                                                                                                                                                                                                                                                                                                   |
| **_listId**              | A string field represents the id of the list. Only used in list-entity-relation and list-reaction models.                                                                                                                                                                                                                                                                                                                                                       |
| **_fromMetadata**        | An object field that used to store metadata of the source list, when querying list-entity-relation models. Only used in list-entity-relation models.                                                                                                                                                                                                                                                                                                            |
| **_toMetadata**          | An object field that used to store metadata of the target entity, when querying list-entity-relation models. Only used in list-entity-relation models.                                                                                                                                                                                                                                                                                                          |
| **_relationMetadata**    | An object field that used to store metadata of the source record (either entity or list), when querying entity-reaction or list-reaction models. Only used in entity-reaction and list-reaction models.                                                                                                                                                                                                                                                         |
| **_ownerUsers**          | An array of user ids.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **_ownerGroups**         | An array of user groups.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **_ownerUsersCount**     | A number field keeps the number of items in ownerUsers array. Facilitates querying records with no-owners with allowing queries like: `/lists?filter[where][_ownerUsersCount]=0`                                                                                                                                                                                                                                                                                |
| **_ownerGroupsCount**    | A number field keeps the number of items in ownerGroups array. Facilitates querying records with no-owners with allowing queries like: `/lists?filter[where][_ownerGroupsCount]=0`                                                                                                                                                                                                                                                                              |
| **_viewerUsers**         | An array of user ids.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **_viewerGroups**        | An array of user groups.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **_viewerUsersCount**    | A number field keeps the number of items in viewerUsers array. Facilitates querying records with no-viewers with allowing queries like: `/lists?filter[where][_viewerUsersCount]=0`                                                                                                                                                                                                                                                                             |
| **_viewerGroupsCount**   | A number field keeps the number of items in viewerGroups array. Facilitates querying records with no-viewers with allowing queries like: `/lists?filter[where][_viewerGroupsCount]=0`                                                                                                                                                                                                                                                                           |
| **_parentsCount**        | A number field keeps the number of parents of the record. Facilitates retrieving only parents by this usage: `/entities?filter[where][_parentsCount]=0`                                                                                                                                                                                                                                                                                                         |
| **_createdBy**           | Id of the user who created the record. Gateway *may* allow caller to modify this field. By default only admin users can modify this field.                                                                                                                                                                                                                                                                                                                      |
| **_creationDateTime**    | A date time object automatically filled with the datetime of entity create operation. Gateway *may* allow caller to modify this field. By default only admin users can modify this field.                                                                                                                                                                                                                                                                       |
| **_lastUpdatedDateTime** | A date time object automatically filled with the datetime of any entity update operation. Gateway *may* allow caller to modify this field. By default only admin users can modify this field.                                                                                                                                                                                                                                                                   |
| **_lastUpdatedBy**       | Id of the user who performed the last update operation. Gateway *may* allow caller to modify this field. By default only admin users can modify this field.                                                                                                                                                                                                                                                                                                     |
| **_validFromDateTime**   | A date time object represents the time when the object is a valid entity. Can be treated as the approval time. There is a configuration to auto approve records at the time of creation.                                                                                                                                                                                                                                                                        |
| **_validUntilDateTime**  | A date time object represents the time when the objects validity ends. Can be used instead of deleting records.                                                                                                                                                                                                                                                                                                                                                 |
| **_idempotencyKey**      | A hashed string field should be computed using the record's fields, which are designed to enhance the record's uniqueness.                                                                                                                                                                                                                                                                                                                                      |

**(\*)** Required fields

**Strictly Managed Fields**: `_version`, `_idempotencyKey`, `_parentsCount`,  `_viewerUsersCount`, `_viewerGroupsCount`, `_ownerUsersCount` and `_ownerGroupsCount` fields are calculated at the application logic no matter what value is sent by the caller.  

**Fields Set by Application when Empty**: `_kind`, `_visibility`, `_validFromDateTime`, `_slug`, `_creationDateTime` and `_lastUpdatedDateTime` are calculated at the application logic if it is not specified in the request body. entity-persistence-gateway decides if user is authorized to send these fields by evaluating authorization policies.   

**Gateway Managed Fields**: `_viewerUsers`, `_viewerGroups`, `_ownerUsers`, `_ownerGroups`, `_createdBy`, `_createdDateTime`, `_lastUpdatedBy`, `_lastUpdatedDateTime`, `_validFromDateTime` fields *may* be modified by entity-persistence-gateway. Gateway decides whether it accepts the given value, modifies it, or allows the caller to modify it by evaluating security policies.

**Always Hidden Fields**: `_parentsCount`, `_ownerUsersCount`, `_ownerGroupsCount`, `_viewerUsersCount`, `_viewerGroupsCount` and `_idempotencyKey` fields are hidden from the caller in the response. Yet, these fields can be used while querying records. Gateway decides if caller is authorized to read and query by these fields by evaluating security policies.

**Immutable Fields**: The `_id`, and `_kind` fields are immutable and cannot be changed after record creation. This constraint is enforced because many system configurations and data integrity rules are based on the `_kind` value. Changing the `_kind` of an existing record could lead to inconsistencies in uniqueness constraints, validation rules, visibility settings, and other kind-specific configurations. Any attempt to modify the `_kind` field during update or replace operations will result in a 422 error (Unprocessable Entity) with the code `IMMUTABLE-ENTITY-KIND`.

**Note:** entity-persistence-gateway can decide if *caller* is authorized to change the value of a field by evaluating security policies. Any field can be subjected to the authorization policies. By configuring the authorization policy, you can allow or disallow the caller to change, modify or read the value of any field.

# Configuration

We can divide configurations into 9 categories:

* [Database configurations](#database)
* [Kind configurations](#allowed-kinds)
* [Uniqueness configurations](#uniqueness)
* [Auto approve configurations](#auto-approve)
* [Default visibility configuration](#visibility)
* [Response limits configurations](#response-limits)
* [Record limit configurations](#record-limits)
* [Lookup Configuration](#lookup-configuration)
* [Idempotency configurations](#idempotency)

### Database

| Configration                        | Description                                                                      | Default Value       |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| **mongodb_host**                    | MongoDB database hostname                                                        | localhost           |
| **mongodb_port**                    | MongoDB database port number                                                     | 27017               |
| **mongodb_user**                    | MongoDB database user                                                            | tappuser            |
| **mongodb_password**                | MongoDB password. Provide through k8s secrets                                    | tapppass123!        |
| **mongodb_database**                | Name of the database                                                             | tappdb              |
| **mongodb_url**                     | Connection URL can be used instead of host, port and user                        | localhost           |
| **collection_entity**               | Name of the collection which generic entities are persisted                      | GenericEntities     |
| **collection_list**                 | Name of the collection which generic lists are persisted                         | Lists               |
| **collection_list_entity_rel** | Name of the collection which relationships between list and entity are persisted | ListEntityRelations |
| **collection_entity_reactions**     | Name of the collection which entity reactions are persisted                      | EntityReactions     |
| **collection_list_reactions**       | Name of the collection which list reactions are persisted                        | ListReactions       |

### Allowed Kinds

You can limit acceptable values for `kind` fields for the records.

| Configuration             | Description                                                                            | Default Value |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------- |
| **entity_kinds**          | Comma seperated list of allowed values for kind field of entities.                     |               |
| **list_kinds**            | Comma seperated list of allowed values for kind field of lists.                        |               |
| **list_entity_rel_kinds** | Comma seperated list of allowed values for kind field of list to entity relationships. | relation      |
| **entity_reaction_kinds** | Comma seperated list of allowed values for kind field of entity reactions.             |               |
| **list_reaction_kinds**   | Comma seperated list of allowed values for kind field of list reactions.               |               |

### Uniqueness

Data uniqueness is configurable using a query-like syntax that allows defining uniqueness rules based on field values and scopes. You can define multiple uniqueness rules by separating them with commas. Each rule consists of:
- Field conditions using `where` clauses that specify which fields must match exactly
- Optional scope conditions using either `where` clauses or predefined `set` expressions
- Template variables that get replaced with actual field values using `${fieldName}` syntax

The configuration supports various uniqueness scenarios:
- Global uniqueness based on specific fields
- Uniqueness within a subset of records (e.g., only active records)
- Uniqueness scoped by field values (e.g., within approved records)
- Multiple uniqueness rules for different combinations

| Configuration                  | Description                                                                                                         | Default Value | Example Value                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| **ENTITY_UNIQUENESS**          | Defines uniqueness rules for entities. Multiple rules can be specified by separating them with commas.              | -             | `where[_name]=${_name},where[_slug]=${_slug}&set[actives]`                       |
| **LIST_UNIQUENESS**            | Defines uniqueness rules for lists. Multiple rules can be specified by separating them with commas.                 | -             | `where[_name]=${_name}&where[_kind]=${_kind},where[_slug]=${_slug}&set[publics]` |
| **RELATION_UNIQUENESS**        | Defines uniqueness rules for list-entity relations. Multiple rules can be specified by separating them with commas. | -             | `where[_listId]=${_listId}&where[_entityId]=${_entityId}`                        |
| **ENTITY_REACTION_UNIQUENESS** | Defines uniqueness rules for entity reactions. Multiple rules can be specified by separating them with commas.      | -             | `where[_entityId]=${_entityId}&where[type]=${type}&set[actives]`                 |
| **LIST_REACTION_UNIQUENESS**   | Defines uniqueness rules for list reactions. Multiple rules can be specified by separating them with commas.        | -             | `where[_listId]=${_listId}&where[type]=${type}&set[actives]`                     |

#### Configuration Syntax

The uniqueness configuration uses a query-like syntax with these components:

1. **Field Uniqueness** (using `where` clauses):
   ```bash
   where[field_name]=${field_name}
   ```
   This specifies which fields must be unique.

2. **Scope Definition**:
   - Using predefined sets:
     ```bash
     set[actives]  # Only check uniqueness among active records
     set[publics]  # Only check uniqueness among public records
     ```
   - Using where clauses:
     ```bash
     where[status]=approved  # Only check uniqueness among approved records
     ```

3. **Template Variables**:
   ```bash
   ${_name}, ${_slug}, ${_kind}, etc.
   ```
   These get replaced with actual field values from the record.

#### Examples

1. **Simple Field Uniqueness**:
   ```bash
   # Only one record can exist with a given name
   ENTITY_UNIQUENESS="where[_name]=${_name}"
   ```

2. **Multiple Field Uniqueness**:
   ```bash
   # Name must be unique within each kind
   ENTITY_UNIQUENESS="where[_name]=${_name}&where[_kind]=${_kind}"
   ```

3. **Uniqueness Within Active Records**:
   ```bash
   # Only one active record can exist with a given name
   ENTITY_UNIQUENESS="where[_name]=${_name}&set[actives]"
   ```

4. **Uniqueness Within Approved Records**:
   ```bash
   # Only one record with status=approved can exist with a given name
   ENTITY_UNIQUENESS="where[_name]=${_name}&where[status]=approved"
   ```

5. **Multiple Uniqueness Rules**:
   ```bash
   # Rule 1: Name must be unique globally
   # Rule 2: Slug must be unique among active records
   ENTITY_UNIQUENESS="where[_name]=${_name},where[_slug]=${_slug}&set[actives]"
   ```

6. **Complex Scoping**:
   ```bash
   # Name must be unique among active and public records
   ENTITY_UNIQUENESS="where[_name]=${_name}&set[actives]&set[publics]"
   ```

7. **Combined Where and Set Scoping**:
   ```bash
   # Name must be unique within each department among active records
   ENTITY_UNIQUENESS="where[_name]=${_name}&where[department]=${department}&set[actives]"
   ```

For available sets and their behaviors that can be used in uniqueness rules, see the [Sets](#sets) section.

#### Error Response

When a uniqueness violation occurs, the API returns a detailed error response:

```json
{
  "error": {
    "statusCode": 409,
    "name": "UniquenessViolationError",
    "message": "Entity already exists",
    "code": "ENTITY-UNIQUENESS-VIOLATION",
    "status": 409,
    "details": [
      {
        "code": "ENTITY-UNIQUENESS-VIOLATION",
        "message": "Entity already exists",
        "info": {
          "scope": "where[_name]=example&set[actives]"
        }
      }
    ]
  }
}
```

The error response includes:
- The specific uniqueness rule that was violated
- The scope where the violation occurred
- The field values that caused the conflict

### Auto Approve

| Configration                                         | Description                                                                                                          | Default Value | Example Value |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| **autoapprove_entity**                               | If true, `validFromDateTime` field of entity record is automatically filled with the creation datetime.              | false         | true          |
| **autoapprove_entity_for_{kindName}**                | If true, `validFromDateTime` field of entity record in this kind is automatically filled with the creation datetime. | false         | true          |
| **autoapprove_list**                                 | If true, `validFromDateTime` field of list record is automatically filled with the creation datetime.                | false         | true          |
| **autoapprove_list_for_{kindName}**                  | If true, `validFromDateTime` field of list record in this kind is automatically filled with the creation datetime.   | true          | false         |
| **autoapprove_list_entity_relations**                | If true, `validFromDateTime` field of relation record is automatically filled with the creation datetime.            | false         | true          |
| **autoapprove_list_entity_relations_for_{kindName}** | If true, `validFromDateTime` field of relation record is automatically filled with the creation datetime.            | false         | true          |
| **autoapprove_entity_reaction**                      | If true, `validFromDateTime` field of entity reaction record is automatically filled with the creation datetime.     | false         | true          |
| **autoapprove_list_reaction**                        | If true, `validFromDateTime` field of list reaction record is automatically filled with the creation datetime.       | false         | true          |

### Visibility

This option only applies when visibility field is not provided. If you want to apply a visibility rule bu user role, please see entity-persistence-gateway.

| Configuration                                  | Description                                                                                                                                      | Default Value | Example Values  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | --------------- |
| **visibility_entity**                          | Default value to be filled for `visibility` field while entity creation.                                                                         | protected     | public, private |
| **visibility_entity_for_{kind_name}**          | Default value to be filled for `visibility` field while entity creation. This configuration will only be applied to that specific kind.          | protected     | public, private |
| **visibility_list**                            | Default value to be filled for `visibility` field while list creation.                                                                           | protected     | public, private |
| **visibility_list_for_{kind_name}**            | Default value to be filled for `visibility` field while list creation. This configuration will only be applied to that specific kind.            | protected     | public, private |
| **visibility_entity_reaction**                 | Default value to be filled for `visibility` field while entity reaction creation.                                                                | protected     | public, private |
| **visibility_entity_reaction_for_{kind_name}** | Default value to be filled for `visibility` field while entity reaction creation. This configuration will only be applied to that specific kind. | protected     | public, private |
| **visibility_list_reaction**                   | Default value to be filled for `visibility` field while list reaction creation.                                                                  | protected     | public, private |
| **visibility_list_reaction_for_{kind_name}**   | Default value to be filled for `visibility` field while list reaction creation. This configuration will only be applied to that specific kind.   | protected     | public, private |

### Response Limits

These setting limits the number of record can be returned for each data model. If user asks more items than the limits, it is silently reduced to the limits given the configuration below.

| Configration                       | Description                                              | Default Value |
| ---------------------------------- | -------------------------------------------------------- | ------------- |
| **response_limit_entity**          | Max items can be returned from entity response.          | 50            |
| **response_limit_list**            | Max items can be returned from list response.            | 50            |
| **response_limit_list_entity_rel** | Max items can be returned from list response.            | 50            |
| **response_limit_entity_reaction** | Max items can be returned from entity reaction response. | 50            |
| **response_limit_list_reaction**   | Max items can be returned from list reaction response.   | 50            |

### Record Limits

The record limit mechanism allows you to control the number of records that can be created in the system. It provides a flexible way to define limits based on various criteria such as record type, kind, ownership, and state.

#### Configuration Mechanism

Record limits are configured through environment variables using a JSON-based notation. Each type of record (entity, list, relation, reactions) has its own configuration variable:

| Environment Variable            | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `ENTITY_RECORD_LIMITS`          | Configures limits for entity records        |
| `LIST_RECORD_LIMITS`            | Configures limits for list records          |
| `RELATION_RECORD_LIMITS`        | Configures limits for list-entity relations |
| `ENTITY_REACTION_RECORD_LIMITS` | Configures limits for entity reactions      |
| `LIST_REACTION_RECORD_LIMITS`   | Configures limits for list reactions        |

#### Configuration Schema

Each environment variable accepts a JSON array of limit configurations:

```json
[
  {
    "scope": "string",  // Where clauses or set expressions defining where the limit applies
    "limit": number    // Maximum number of records allowed in this scope
  }
]
```

The `scope` field supports:
- Empty string (`""`) for global limits
- Where clause expressions (`where[field]=value`)
- Set expressions (`set[setname]`)
- Combined expressions using `&` and logical `AND`, `OR` operators

#### Dynamic Value Interpolation

The scope field supports interpolation of record values using `${fieldname}` syntax:
- `${_kind}` - Record's kind
- `${_ownerUsers}` - Record's owner users
- `${_listId}` - Relation's list ID
- Any other field from the record being created

#### Common Use Cases and Examples

1. **Global Record Limit**
   ```bash
   # Limit total entities to 1000
   ENTITY_RECORD_LIMITS='[{"scope":"","limit":1000}]'
   ```

2. **Kind-Specific Limits**
   ```bash
   # Limit book entities to 100, movie entities to 50
   ENTITY_RECORD_LIMITS='[
     {"scope":"where[_kind]=book","limit":100},
     {"scope":"where[_kind]=movie","limit":50}
   ]'
   ```

3. **Active Records Limit**
   ```bash
   # Limit active entities to 50
   ENTITY_RECORD_LIMITS='[{"scope":"set[actives]","limit":50}]'
   ```

4. **Per-User Limits**
   ```bash
   # Limit each user to 10 lists
   LIST_RECORD_LIMITS='[{"scope":"set[owners][userIds]=${_ownerUsers}","limit":10}]'
   ```

5. **Combined Criteria**
   ```bash
   # Limit active public book entities to 20
   ENTITY_RECORD_LIMITS='[{
     "scope":"set[actives]&set[publics]&where[_kind]=book",
     "limit":20
   }]'
   ```

6. **List-Entity Relations**
   ```bash
   # Limit each list to 100 entities
   RELATION_RECORD_LIMITS='[{
     "scope":"where[_listId]=${_listId}",
     "limit":100
   }]'

   # Different limits for different list kinds
   RELATION_RECORD_LIMITS='[
     {"scope":"where[_listId]=${_listId}&where[_kind]=reading-list","limit":10},
     {"scope":"where[_listId]=${_listId}&where[_kind]=watch-list","limit":20}
   ]'
   ```

7. **Multiple Limits**
   ```bash
   # Combined global and kind-specific limits
   LIST_RECORD_LIMITS='[
     {"scope":"","limit":1000},
     {"scope":"where[_kind]=featured","limit":10},
     {"scope":"set[actives]&set[publics]","limit":50}
   ]'
   ```

#### Filter Expressions

Filter expressions use the Loopback query syntax:
- Simple equality: `where[field]=value`
- Multiple conditions: `where[field1]=value1&where[field2]=value2`
- Nested fields: `where[field.nested]=value`

#### Set Expressions

Available sets for filtering:
- `set[actives]` - Currently active records (based on validity dates)
- `set[expireds]` - Records where `_validUntilDateTime` is in the past
- `set[publics]` - Public records
- `set[privates]` - Private records
- `set[protecteds]` - Protected records
- `set[owners]` - Records by owner
- `set[viewers]` - Records by viewer
- `set[audience]` - Records by combined owners and viewers

#### Error Handling

When a limit is exceeded, the service returns a 429 error with details:
```json
{
  "statusCode": 429,
  "name": "LimitExceededError",
  "message": "Record limit exceeded for [type]",
  "code": "[TYPE]-LIMIT-EXCEEDED",
  "status": 429,
  "details": [{
    "code": "[TYPE]-LIMIT-EXCEEDED",
    "message": "Record limit exceeded for [type]",
    "info": {
      "limit": number,
      "scope": "string"
    }
  }]
}
```

Where `[type]` is one of: entity, list, relation, entity-reaction, list-reaction.

### Lookup Configuration

You can restrict and validate tapp:// lookup references using environment-driven constraints. The service reads JSON arrays from environment variables and validates referenced records during create/replace operations.

Environment variables (JSON array of constraint objects):

| Environment Variable                          | Applies to | Description |
| --------------------------------------------- | ---------- | ----------- |
| `ENTITY_LOOKUP_CONSTRAINT`                    | Entities   | Lookup constraints for entity records. |
| `LIST_LOOKUP_CONSTRAINT`                      | Lists      | Lookup constraints for list records. |
| `ENTITY_REACTION_LOOKUP_CONSTRAINT`           | Entity reactions | Lookup constraints for entity-reaction records. |
| `LIST_REACTION_LOOKUP_CONSTRAINT`             | List reactions   | Lookup constraints for list-reaction records. |

Constraint object shape (examples):

```json
[
  {
    "propertyPath": "_parents",
    "record": "entity",
    "targetKind": "category"
  },
  {
    "propertyPath": "metadata.supplier.company",
    "record": "entity",
    "sourceKind": "product",
    "targetKind": "company"
  }
]
```

Keys and semantics:
- `propertyPath` (string): path to the field on the source record that contains tapp:// references (for example `_parents`, `supplier.company`, or `metadata.references.parent`). Property paths support dot-notation and bracket-notation (e.g. `items[0].supplier`) and are evaluated using lodash.get semantics — nested fields and arrays are handled transparently.
- `record` (optional): identifies the expected target resource type for the tapp:// references found at `propertyPath`. Valid values: `entity`, `list`, `entity-reaction`, `list-reaction`.
  - When provided the service validates the reference format (for example `tapp://localhost/entities/{id}` for `entity`) and uses the corresponding repository to fetch referenced records for `targetKind` checks and parent-specific validations.
  - If omitted, format validation is skipped. If `targetKind` is present but `record` is omitted, the service currently defaults to the `entity` repository for kind checks — therefore it is recommended to always specify `record` when constraining target kinds.
- `sourceKind` (optional): apply this constraint only when the source record has this `_kind` value.
- `targetKind` (optional): require the referenced target record to have this `_kind` value. When present the service will resolve referenced records (using the repository chosen by `record`) and verify their `_kind`. If `propertyPath` points to an array of references, every referenced record must satisfy the constraint.

Notes:
- The service automatically merges a default `_parents` constraint for the relevant record types if the administrator does not provide one.
- When a constraint targets `_parents` for reaction records the service performs additional checks to ensure the referenced parent reaction matches the expected `_entityId` or `_listId` (depending on whether it is an entity-reaction or list-reaction).
- Invalid or non-conforming references will result in `422` responses with error names such as `InvalidLookupReferenceError`, `InvalidLookupConstraintError`, or `InvalidParentEntityIdError`. Error codes are prefixed by the affected record type (for example `ENTITY-INVALID-LOOKUP-KIND`).
- Always prefer to explicitly set `record` when using `targetKind` or when the property path may contain heterogeneous reference types.

Examples:
- Constrain `_parents` to reference only entities of kind `category`:

```json
[{"propertyPath":"_parents","record":"entity","targetKind":"category"}]
```

- Validate nested references stored at `metadata.references.company` that must point to kind `company`:

```json
[{"propertyPath":"metadata.references.company","record":"entity","targetKind":"company"}]
```

### Idempotency

entity-persistence-service ensures data creation is efficient and predictable. You can define JSON field paths, and the system generates a unique key based on these values. When clients attempt to create records, the system checks if a matching record exists using this key. If found, it returns the result as if it were a new record.

| Configuration                                  | Description                                                                                                                                               | Default Value | Example Values         |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| **idempotency_entity**                         | comma seperated list of field names for entity records that are contributing to the calculation of idempotency key                                        | -             | kind, slug, author     |
| **idempotency_entity_for_{kindName}**          | comma seperated list of field names for entity records with kind value is {kindName} that are contributing to the calculation of idempotency key          | -             | kind, slug, author     |
| **idempotency_list**                           | comma seperated list of field names for list records that are contributing to the calculation of idempotency key                                          | -             | kind, slug             |
| **idempotency_list_for_{kindName}**            | comma seperated list of field names for list records with kind value is {kindName} that are contributing to the calculation of idempotency key            | -             | kind, slug, author     |
| **idempotency_list_entity_rel**                | comma seperated list of field names for entity records that are contributing to the calculation of idempotency key                                        | -             | kind, listId, entityId |
| **idempotency_list_entity_rel_for_{kindName}** | comma seperated list of field names for entity records with kind value is {kindName} that are contributing to the calculation of idempotency key          | -             | kind, listId, entityId |
| **idempotency_entity_reaction**                | comma seperated list of field names for entity reaction records that are contributing to the calculation of idempotency key                               | -             | kind, entityId, type   |
| **idempotency_entity_reaction_for_{kindName}** | comma seperated list of field names for entity reaction records with kind value is {kindName} that are contributing to the calculation of idempotency key | -             | kind, entityId, type   |
| **idempotency_list_reaction**                  | comma seperated list of field names for list reaction records that are contributing to the calculation of idempotency key                                 | -             | kind, listId, type     |
| **idempotency_list_reaction_for_{kindName}**   | comma seperated list of field names for list reaction records with kind value is {kindName} that are contributing to the calculation of idempotency key   | -             | kind, listId, type     |

Please note that idempotency calculation takes place before populating managed fields. Thus, do not use managed fields as contributor to the idempotency. For instance, use `name` instead of `slug`.

# Deployment

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

# Known Issues and Limitations

### 1. Idempotency and Visibility

If a user creates a record idempotently, they may receive a success response, even if the previously created idempotent record is set as private. However, due to the visibility settings, the user who attempted to create idempotent record won't be able to view private records created by someone else. This can create a situation where it appears as if the data was created successfully, but it may not be visible to whom created it because of the privacy settings. It's essential to be aware of this behavior when working with idempotent data creation and privacy settings.
This issue is going to be addressed with making `set`s can contribute to the idempotency calculation.

### 2. Field Selection with Arbitrary Fields

All models in the application (entities, lists, relations, and reactions) allow arbitrary fields through `additionalProperties: true` in their model definitions. When using field selection with these models, there is a limitation in Loopback's behavior:

- If you explicitly set any arbitrary field to `false` in the field selection filter, all other arbitrary fields will also be excluded from the response, even if they weren't explicitly mentioned in the filter.
- This behavior affects all arbitrary fields (fields not defined in the model schema) in all models (entities, lists, relations, and reactions).
- Built-in fields (those defined in the model schema, like `_id`, `_name`, `_kind`, etc.) are not affected by this behavior.

Example:

All models allow arbitrary fields. The following client call requests that `customField` be excluded from the response:

```javascript
const response = await client.get('/entities').query({
  filter: {
    fields: {
      customField: false
    }
  }
});
```

Result: All arbitrary fields (customField, description, and any other custom fields) will be excluded from the response, even if not explicitly mentioned in the filter. Built-in fields defined in the model schema will be returned by default.

This is a known limitation in Loopback's implementation of field selection when dealing with models that allow arbitrary fields.

### 3. Version Incrementation for Update All operations.
When performing PATCH or PUT operations on a single record, the version field (_version) is automatically incremented by 1. However, for bulk update operations (updateAll), version tracking is not supported. The version field remains unchanged even when records are modified.

### 4. Dot Notation in Connected Model Filters for List-Entity Relations
When querying list-entity relations, dot notation filtering (e.g., `metadata.status.current`) is not supported in `listFilter` and `entityFilter` parameters for connected models. While other filtering approaches work normally, nested property filtering using dot notation specifically for connected List and Entity models through their relations is not available.

# References


  ## Endpoints Reference

  ### EntityController
  | Method | Endpoint                  | Description              |
  | ------ | ------------------------- | ------------------------ |
  | POST   | `/entities`               | Create new entity        |
  | GET    | `/entities`               | List all entities        |
  | GET    | `/entities/{id}`          | Get entity by ID         |
  | PATCH  | `/entities/{id}`          | Update entity partially  |
  | PUT    | `/entities/{id}`          | Replace entity           |
  | PATCH  | `/entities`               | Update multiple entities |
  | GET    | `/entities/count`         | Get entity count         |
  | POST   | `/entities/{id}/children` | Add child to entity      |
  | GET    | `/entities/{id}/children` | Get entity children      |
  | GET    | `/entities/{id}/parents`  | Get entity parents       |
  | DELETE | `/entities/{id}`          | Delete entity            |

  ### ListController
  | Method | Endpoint               | Description           |
  | ------ | ---------------------- | --------------------- |
  | POST   | `/lists`               | Create new list       |
  | GET    | `/lists`               | List all lists        |
  | GET    | `/lists/{id}`          | Get list by ID        |
  | PATCH  | `/lists/{id}`          | Update list partially |
  | PUT    | `/lists/{id}`          | Replace list          |
  | PATCH  | `/lists`               | Update multiple lists |
  | GET    | `/lists/count`         | Get list count        |
  | POST   | `/lists/{id}/children` | Add child to list     |
  | GET    | `/lists/{id}/children` | Get list children     |
  | GET    | `/lists/{id}/parents`  | Get list parents      |
  | DELETE | `/lists/{id}`          | Delete list           |

  ### ListEntityRelController
  | Method | Endpoint                       | Description                           |
  | ------ | ------------------------------ | ------------------------------------- |
  | POST   | `/relations`       | Create new list-entity relation       |
  | GET    | `/relations`       | List all list-entity relations        |
  | GET    | `/relations/{id}`  | Get list-entity relation by ID        |
  | PATCH  | `/relations/{id}`  | Update list-entity relation partially |
  | PUT    | `/relations/{id}`  | Replace list-entity relation          |
  | PATCH  | `/relations`       | Update multiple list-entity relations |
  | GET    | `/relations/count` | Get list-entity relation count        |
  | DELETE | `/relations/{id}`  | Delete list-entity relation           |

  ### EntitiesThroughListController
  | Method | Endpoint               | Description          |
  | ------ | ---------------------- | -------------------- |
  | POST   | `/lists/{id}/entities` | Add entities to list |
  | GET    | `/lists/{id}/entities` | Get list entities    |
  | PATCH  | `/lists/{id}/entities` | Update list entities |
  | DELETE | `/lists/{id}/entities` | Delete list entities |

  ### ListsThroughEntitiesController
  | Method | Endpoint               | Description          |
  | ------ | ---------------------- | -------------------- |
  | GET    | `/entities/{id}/lists` | Get lists for entity |

  ### EntityReactionController
  | Method | Endpoint                          | Description                      |
  | ------ | --------------------------------- | -------------------------------- |
  | POST   | `/entity-reactions`               | Create new entity reaction       |
  | GET    | `/entity-reactions`               | List all entity reactions        |
  | GET    | `/entity-reactions/{id}`          | Get entity reaction by ID        |
  | PATCH  | `/entity-reactions/{id}`          | Update entity reaction partially |
  | PUT    | `/entity-reactions/{id}`          | Replace entity reaction          |
  | PATCH  | `/entity-reactions`               | Update multiple entity reactions |
  | GET    | `/entity-reactions/count`         | Get entity reaction count        |
  | POST   | `/entity-reactions/{id}/children` | Add child to entity reaction     |
  | GET    | `/entity-reactions/{id}/children` | Get entity reaction children     |
  | GET    | `/entity-reactions/{id}/parents`  | Get entity reaction parents      |
  | DELETE | `/entity-reactions/{id}`          | Delete entity reaction           |

  ### ReactionsThroughEntityController
  | Method | Endpoint                   | Description             |
  | ------ | -------------------------- | ----------------------- |
  | POST   | `/entities/{id}/reactions` | Add reaction to entity  |
  | GET    | `/entities/{id}/reactions` | Get entity reactions    |
  | PATCH  | `/entities/{id}/reactions` | Update entity reactions |
  | DELETE | `/entities/{id}/reactions` | Delete entity reactions |

  ### ListReactionController
  | Method | Endpoint                | Description                    |
  | ------ | ----------------------- | ------------------------------ |
  | POST   | `/list-reactions`       | Create new list reaction       |
  | GET    | `/list-reactions`       | List all list reactions        |
  | GET    | `/list-reactions/{id}`  | Get list reaction by ID        |
  | PATCH  | `/list-reactions/{id}`  | Update list reaction partially |
  | PUT    | `/list-reactions/{id}`  | Replace list reaction          |
  | PATCH  | `/list-reactions`       | Update multiple list reactions |
  | GET    | `/list-reactions/count` | Get list reaction count        |
  | DELETE | `/list-reactions/{id}`  | Delete list reaction           |

  ### ReactionsThroughListsController
  | Method | Endpoint                | Description           |
  | ------ | ----------------------- | --------------------- |
  | POST   | `/lists/{id}/reactions` | Add reaction to list  |
  | GET    | `/lists/{id}/reactions` | Get list reactions    |
  | PATCH  | `/lists/{id}/reactions` | Update list reactions |
  | DELETE | `/lists/{id}/reactions` | Delete list reactions |

  ### PingController
  | Method | Endpoint | Description   |
  | ------ | -------- | ------------- |
  | GET    | `/ping`  | Ping endpoint |

  ## Error Codes Reference
