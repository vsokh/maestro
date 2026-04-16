# WebSocket Protocol

Connect to `ws://<host>:<port>/ws` (default `ws://127.0.0.1:4545/ws`).

All messages are **server → client** JSON frames. The server broadcasts to every connected client. There is no client → server messaging over WebSocket — all mutations go through the HTTP API.

## Message Types

Every message has a `type` discriminator field.

```typescript
type WebSocketMessage =
  | StateMessage
  | ProgressMessage
  | QualityMessage
  | ErrorsMessage
  | ProjectSwitchedMessage
  | OutputMessage
  | ExitMessage;
```

---

### `state`

Broadcast when `.maestro/state.json` changes on disk (debounced, deduped by content hash, version-guarded).

```json
{
  "type": "state",
  "data": { /* StateData — see openapi.yaml #/components/schemas/StateData */ },
  "lastModified": 1712937600000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `StateData` | Full task state |
| `lastModified` | `number` | File mtime in ms — use for optimistic locking on next PUT |

**Dedup:** The watcher hashes file content; identical consecutive writes are suppressed.

**Version guard:** If the incoming `_v` is less than or equal to the last broadcast version, the message is suppressed (prevents echoing back a client's own write).

---

### `progress`

Broadcast when any file in `.maestro/progress/` changes. Agents write `{taskId}.json` here while executing.

```json
{
  "type": "progress",
  "data": {
    "42": {
      "status": "in-progress",
      "progress": "Implementing feature X — 3/5 files done",
      "branch": "task-42"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `Record<string, ProgressEntry>` | Map of task ID → progress entry. See `openapi.yaml` for `ProgressEntry` schema. |

The client merges progress into state locally (via `mergeProgressIntoState` from `taskgraph`). Progress files are ephemeral — deleted after the task completes and state is reconciled.

---

### `quality`

Broadcast when `.maestro/quality/latest.json` changes.

```json
{
  "type": "quality",
  "data": {
    "overallScore": 82,
    "grade": "B+",
    "dimensions": { "...": "..." },
    "scannedAt": "2026-04-12T10:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `QualityReport` | Full quality report. See `openapi.yaml` for schema. |

---

### `errors`

Broadcast when any file in `.maestro/errors/` changes.

```json
{
  "type": "errors",
  "data": {
    "scannedAt": "2026-04-12T10:00:00Z",
    "period": "24h",
    "environment": "production",
    "summary": { "totalEvents": 12, "uniqueIssues": 3, "crashFreeRate": 99.2, "..." : "..." },
    "issues": [],
    "timeline": [],
    "typeBreakdown": {}
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `ErrorsReport` | Full errors report. See `openapi.yaml` for schema. |

---

### `project-switched`

Broadcast when the active project changes (via `PUT /api/project`). Clients should reconnect — re-fetch state, skills, and progress for the new project.

```json
{
  "type": "project-switched",
  "projectPath": "/home/user/projects/my-app",
  "projectName": "my-app"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `projectPath` | `string` | Absolute path to the new project |
| `projectName` | `string` | Directory basename |

---

### `output`

Broadcast when a spawned agent process writes to stdout or stderr. The server buffers the last 500 lines per process.

```json
{
  "type": "output",
  "taskId": 42,
  "text": "Reading task instructions...\n",
  "stream": "stdout",
  "pid": 12345
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `number` | Task the process is executing |
| `text` | `string` | Output chunk (may contain newlines) |
| `stream` | `"stdout" \| "stderr"` | Which stream (defaults to `"stdout"` if omitted) |
| `pid` | `number` | OS process ID |

Reconnecting clients can fetch buffered output via `GET /api/launch/output`.

---

### `exit`

Broadcast when a spawned agent process exits.

```json
{
  "type": "exit",
  "taskId": 42,
  "code": 0
}
```

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | `number` | Task the process was executing |
| `code` | `number` | Exit code (0 = success) |
| `error` | `string` | Error message if the process crashed |

---

## Connection Lifecycle

1. **Connect** — open WebSocket to `/ws`
2. **Receive state** — the watcher triggers a `state` broadcast on connect if a state file exists
3. **Receive progress** — any active agents will produce `progress` messages
4. **Receive output/exit** — if processes are running, their output streams through
5. **Reconnect** — on disconnect, reconnect and call `GET /api/launch/output` to catch up on missed output

## Broadcast Behavior

- All connected clients receive all messages (no filtering/subscriptions)
- Messages are JSON-stringified once, sent to each client with `readyState === 1` (OPEN)
- Failed sends are caught and logged; the client is not removed (WebSocket close handler handles cleanup)

## CORS / Origin

The HTTP server (which upgrades to WebSocket) allows CORS from `http://localhost:*` and `http://127.0.0.1:*` origins. For Android/remote clients connecting over LAN or tunnel, set `DM_HOST=0.0.0.0` to bind on all interfaces.
