# Big-AGI API Manual

This manual documents the API routes available in the Big-AGI application for SQLite-based data management and OpenAI integration.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All APIs use environment variables for authentication:
- `OPENAI_API_KEY` - Required for OpenAI model fetching

---

## Metrics API

### GET /api/metrics
Retrieve all metrics data from SQLite database.

**Request:**
```http
GET /api/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "liveFilesByWorkspace": {},
    "serviceMetrics": {
      "openai": {
        "costsCents": 1250,
        "savingsCents": 0,
        "inputTokens": 1500,
        "outputTokens": 500,
        "conversationCount": 3
      }
    }
  },
  "timestamp": "2025-07-31T10:30:00.000Z"
}
```

### POST /api/metrics
Add a new cost entry or save complete metrics store.

**Add Cost Entry:**
```http
POST /api/metrics
Content-Type: application/json

{
  "action": "addCostEntry",
  "data": {
    "serviceId": "openai",
    "costsCents": 125,
    "savingsCents": 0,
    "costCode": "gpt-4o",
    "inputTokens": 150,
    "outputTokens": 50,
    "debugCostSource": "chat-completion"
  }
}
```

**Save Store:**
```http
POST /api/metrics
Content-Type: application/json

{
  "action": "saveStore", 
  "data": {
    "serviceMetrics": {
      "openai": {
        "costsCents": 2500,
        "savingsCents": 100,
        "inputTokens": 3000,
        "outputTokens": 1000,
        "conversationCount": 5
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cost entry added successfully"
}
```

### DELETE /api/metrics
Clear all metrics data.

**Request:**
```http
DELETE /api/metrics
```

**Response:**
```json
{
  "success": true,
  "message": "Metrics cleared successfully"
}
```

---

## OpenAI Models API

### GET /api/openai-models
Fetch available OpenAI models with pricing information.

**Request:**
```http
GET /api/openai-models
```

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "id": "gpt-4o",
      "name": "gpt-4o",
      "created": 1677649963,
      "owned_by": "openai",
      "pricing": {
        "input": 2.50,
        "output": 10.00,
        "description": "GPT-4o (Latest)"
      }
    },
    {
      "id": "gpt-4o-mini",
      "name": "gpt-4o-mini", 
      "created": 1677649963,
      "owned_by": "openai",
      "pricing": {
        "input": 0.15,
        "output": 0.60,
        "description": "GPT-4o Mini (Fast & Cheap)"
      }
    }
  ],
  "count": 50,
  "timestamp": "2025-07-31T10:30:00.000Z"
}
```

**Error Response (Missing API Key):**
```json
{
  "success": false,
  "error": "OpenAI API key not configured",
  "models": []
}
```

---

## Chat Store API

### GET /api/chat-store
Retrieve all conversations from SQLite database.

**Request:**
```http
GET /api/chat-store
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": {
      "conv-123": {
        "id": "conv-123",
        "title": "Test Conversation",
        "messages": [
          {
            "id": "msg-1",
            "role": "user", 
            "text": "Hello",
            "created": 1690000000000
          }
        ],
        "created": 1690000000000,
        "updated": 1690000001000
      }
    },
    "conversationIdsOrdered": ["conv-123"]
  },
  "timestamp": "2025-07-31T10:30:00.000Z"
}
```

### POST /api/chat-store
Save complete chat store data.

**Request:**
```http
POST /api/chat-store
Content-Type: application/json

{
  "conversations": {
    "conv-123": {
      "id": "conv-123",
      "title": "Updated Conversation",
      "messages": [
        {
          "id": "msg-1",
          "role": "user",
          "text": "Hello",
          "created": 1690000000000
        },
        {
          "id": "msg-2", 
          "role": "assistant",
          "text": "Hi there!",
          "created": 1690000001000
        }
      ],
      "created": 1690000000000,
      "updated": 1690000002000
    }
  },
  "conversationIdsOrdered": ["conv-123"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Chat store saved successfully"
}
```

### DELETE /api/chat-store
Clear all chat data.

**Request:**
```http
DELETE /api/chat-store
```

**Response:**
```json
{
  "success": true,
  "message": "Chat store cleared successfully"
}
```

---

## Individual Conversation API

### GET /api/chat-store/[id]
Get a specific conversation by ID.

**Request:**
```http
GET /api/chat-store/conv-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv-123",
    "title": "Test Conversation", 
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "text": "Hello",
        "created": 1690000000000
      }
    ],
    "created": 1690000000000,
    "updated": 1690000001000
  }
}
```

**Error Response (Not Found):**
```json
{
  "success": false,
  "error": "Conversation not found"
}
```

### PUT /api/chat-store/[id]
Update a specific conversation.

**Request:**
```http
PUT /api/chat-store/conv-123
Content-Type: application/json

{
  "id": "conv-123",
  "title": "Updated Title",
  "messages": [
    {
      "id": "msg-1", 
      "role": "user",
      "text": "Hello",
      "created": 1690000000000
    },
    {
      "id": "msg-2",
      "role": "assistant", 
      "text": "Updated response",
      "created": 1690000001000
    }
  ],
  "created": 1690000000000,
  "updated": 1690000002000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation updated successfully"
}
```

### DELETE /api/chat-store/[id]
Delete a specific conversation.

**Request:**
```http
DELETE /api/chat-store/conv-123
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

## Error Handling

All APIs return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid data)
- `404` - Not Found
- `500` - Internal Server Error

---

## Data Storage

All data is stored in SQLite databases in the `data/` directory:
- `data/chat.db` - Chat conversations and messages
- `data/metrics.db` - Usage metrics and costs

The databases are automatically created with proper schemas on first use.

---

## Testing

Use the web interface at `http://localhost:3000/chat-test` for interactive testing, or import the Insomnia collection (see insomnia-collection.json) for API testing.