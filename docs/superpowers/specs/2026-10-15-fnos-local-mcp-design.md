# fnOS local MCP design

## Goal

Expose Qingye's conversion operations to native AI agents installed on the same fnOS device. OpenClaw is one such client, but the interface must use the standard MCP Streamable HTTP transport so compatible local agents can use it as well.

## Endpoint and access boundary

The application starts a second HTTP server bound only to `127.0.0.1` on port `32180`, with one endpoint: `POST /mcp`. It implements stateless Streamable HTTP MCP. It does not bind to the NAS LAN address, does not register through the fnOS web gateway, and has no public URL, CORS response, token, OAuth flow, or browser login dependency. Native clients use `http://127.0.0.1:32180/mcp`.

The operating-system loopback boundary is the access control selected by the user. Each MCP call independently applies the same canonical-path authorization that the fnOS app uses: inputs and output directory must lie inside directories granted to Qingye by fnOS. Application-private data, runtime files, symlink escapes, arbitrary command execution, directory browsing, deletion, upload and configuration changes remain unavailable.

## MCP behavior

A shared `JobService` instance runs both UI and MCP work, preserving the existing one-active-job rule. The MCP server exposes four tools:

- `capabilities`: available conversion operations, authorized directories and component status.
- `submit_task`: submit one approved conversion/compression operation.
- `task_status`: obtain progress, per-file result and output paths for a submitted job.
- `cancel_task`: cancel the active submitted job.

MCP job ownership is scoped to an in-memory local client identity for the duration of the connection. It may read or cancel only its own jobs. UI jobs remain unavailable through MCP. Application restart clears MCP job history, consistent with existing UI task behavior.

The HTTP service uses the installed MCP SDK's `StreamableHTTPServerTransport` in stateless mode. Each request gets a short-lived MCP server/transport connected to the same adapter that registers the four tools. POST is the supported method; other methods respond with a standard JSON-RPC method error. Requests are size-limited before JSON parsing and produce JSON-RPC error responses rather than crashing the app.

## User experience

The fnOS settings page shows the local MCP URL and a copyable OpenClaw configuration example. It clearly says that only agents on the NAS can connect and that configured agents can process only Qingye-authorized folders. The existing desktop-only MCP controls remain hidden in the fnOS UI.

Example:

```json
{
  "mcp": {
    "servers": {
      "qingye": {
        "url": "http://127.0.0.1:32180/mcp",
        "transport": "streamable-http",
        "enabled": true
      }
    }
  }
}
```

## Lifecycle and validation

The local MCP listener starts after the fnOS gateway socket is ready; failure to acquire the loopback port stops the app with a clear log message. Shutdown closes both listeners, terminates MCP transports and cancels the active job through the existing shutdown path.

Tests cover loopback-only binding, MCP initialize/tool discovery, all four tools, path/symlink denial, UI/MCP job ownership, cancellation, unsupported HTTP methods, server shutdown and a real Streamable HTTP client exchange. Browser validation confirms the configuration is visible without exposing an external route. Package validation confirms the endpoint is not bound beyond `127.0.0.1`.
