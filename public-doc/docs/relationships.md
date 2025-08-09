# Managing Relationships

Phantom API supports defining relationships between your resources, similar to foreign keys in a relational database. This allows you to link resources together (e.g., a Post belongs to a User).

## Defining a Relationship

To define a relationship, you use the `relation` type in your resource meta-definition JSON file. This creates a foreign key relationship in the underlying database.

For example, let's define a `Post` resource that belongs to a `User`. First, ensure you have a `phantom-api-backend/meta/User.json` file defining your `User` resource. Then, create or update `phantom-api-backend/meta/Post.json` as follows:

```json
{
  "fields": {
    "title": { "type": "string", "required": true },
    "content": { "type": "text" },
    "published": { "type": "boolean", "default": false },
    "author": {
      "type": "relation",
      "target": "User",
      "onDelete": "CASCADE"
    }
  }
}
```

**Explanation of `relation` properties:**
- `"type": "relation"`: This explicitly marks the field as a relationship.
- `"target": "User"`: This specifies the name of the target resource (e.g., `User`) to which this resource is related. The target resource must have its own meta-definition file (e.g., `phantom-api-backend/meta/User.json`).
- `"onDelete": "CASCADE"`: (Optional) This defines the action to take when the related (parent) record is deleted. Common options include:
    - `"CASCADE"`: If the parent record is deleted, all related child records are also deleted.
    - `"SET NULL"`: If the parent record is deleted, the foreign key in the child record is set to `NULL`.
    - `"RESTRICT"`: Prevents the deletion of the parent record if there are any related child records.

## API Usage Examples

### Creating a Related Resource

When creating a resource that has a relationship, you provide the `id` of the related (parent) resource in the relationship field. The backend will automatically validate the existence of the parent resource.

**Example: Creating a new `Post` associated with an existing `User`**

Assume you have a `User` with `id: "user_12345"`.

```bash
curl -X POST \
  http://localhost:3000/api/Post/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{ "title": "My First Post", "content": "This is the content of my first post.", "author": "user_12345" }'
```

In this example, `"author": "user_12345"` links the new post to the user with that specific ID.

### Populating Relationships (Retrieving Related Data)

When retrieving resources, you can use the `populate` query parameter to include the full related object(s) in the response instead of just their IDs. This is useful for fetching all necessary data in a single API call.

**Example: Retrieving a `Post` and its `author` details**

To get a post and include the full `User` object for its `author` field, you would make a `POST` request to `/api/Post/find` (or `findMany`) and include the `populate` option in the request body:

```bash
curl -X POST \
  http://localhost:3000/api/Post/find \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{ "where": { "id": "post_67890" }, "populate": ["author"] }'
```

**Expected Response:**

```json
{
  "id": "post_67890",
  "title": "My First Post",
  "content": "This is the content of my first post.",
  "authorId": "user_12345", // The foreign key field is still present
  "author": {
    "id": "user_12345",
    "name": "John Doe",
    "email": "john.doe@example.com"
    // ... other user fields
  }
}
```

**Populating Multiple Relationships:**

You can populate multiple relationships by including them in an array in the `populate` option:

```bash
curl -X POST \
  http://localhost:3000/api/Post/findMany \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{ "populate": ["author", "category"] }'
```

This would include both the `author` and `category` objects in the response for each post, assuming you have a `category` relation defined in your `Post` meta-definition.

```
