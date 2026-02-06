# Unified Logging System Guide

## Overview

This workspace uses a unified JSON Lines (`.jsonl`) logging system with end-to-end correlation ID tracing across:
- **Frontend**: Angular 21 (Port 4200)
- **Water Billing Backend**: NestJS (Port 3332)
- **Real Estate Backend**: NestJS (Port 3333)

## Log Location

All logs are stored in `work_space/logs/`:
```
logs/
├── frontend/               # Angular logs (browser console)
├── water-backend/          # Water Billing API logs
└── realestate-backend/     # Real Estate API logs
```

## For Claude Code: How to Analyze Logs

### Quick Commands

```bash
# Tail logs in real-time (with JSON formatting)
tail -f logs/water-backend/*.jsonl | jq .
tail -f logs/realestate-backend/*.jsonl | jq .

# Find all logs for a specific correlation ID
grep "correlation-id-uuid" logs/*/*.jsonl | jq .

# Find all errors today
jq 'select(.level == "error")' logs/*/*.jsonl

# Find slow requests (>1000ms)
jq 'select(.context.httpResponse.duration > 1000)' logs/*/*.jsonl

# Trace a request across all apps
grep "YOUR-CORRELATION-ID" logs/*/*.jsonl | jq -s 'sort_by(.timestamp)'
```

### Common Claude Prompts

> "Read the logs and find all HTTP errors with correlation IDs that appear in both frontend and backend logs."

> "Show me all GraphQL mutations that failed today, including the error messages."

> "Find all requests that took longer than 1 second and show their correlation IDs."

> "Trace the full lifecycle of correlation ID xxx: show the frontend request, backend processing, and response."

## Log Entry Schema

```json
{
  "timestamp": "2025-01-14T12:34:56.789Z",
  "level": "info|warn|error|debug",
  "message": "Human-readable message",
  "app": "frontend|water-backend|realestate-backend",
  "environment": "local|dev|production",
  "correlationId": "uuid-v4",
  "context": {
    "httpRequest": { "method": "GET", "url": "..." },
    "httpResponse": { "statusCode": 200, "duration": 45 },
    "graphql": { "operationName": "GetProperties", "operationType": "query" },
    "error": { "name": "Error", "message": "...", "stack": "..." }
  }
}
```

## Correlation ID Flow

```
Angular → Generate UUID
   │
   ├─→ HTTP Request (X-Correlation-ID header)
   │     │
   │     └─→ Water Backend (3332) → Logs with same ID
   │     └─→ Real Estate Backend (3333) → Logs with same ID
   │
   └─→ GraphQL Request (X-Correlation-ID header)
         │
         └─→ Both Backends → Logs with same ID
```

## Key Files

| Project | File | Purpose |
|---------|------|---------|
| Frontend | `app/shared/services/correlation-id.service.ts` | UUID generation |
| Frontend | `app/shared/services/json-logger.service.ts` | Structured logging |
| Frontend | `app/shared/interceptors/logging.interceptor.ts` | HTTP logging |
| Frontend | `app/shared/interceptors/graphql-logging.link.ts` | GraphQL logging |
| Water Backend | `app/src/app.module.ts` | Pino file transport |
| Real Estate Backend | `app/src/app.module.ts` | Pino file transport |
