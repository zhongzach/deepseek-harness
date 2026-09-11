# Agent Note: Request-scoped provider HTTP middleware

Status: implemented

English | [中文](2026-09-10-request-scoped-provider-http.zh.md)

## Problem

Gateway usage settlement can arrive in SSE metadata after HTTP headers. A provider SDK can discard that metadata, leaving a deployment unable to distinguish an unconfirmed hold from a final charge. Replacing global fetch would also intercept unrelated requests and lose reliable request ownership.

## Decision

The LLM event interface declares `llm/fetch`; the pi-ai Chat Completions adapter dispatches it through the SDK's request-scoped fetch option. Middleware receives the immutable model request and actual HTTP operation, delegates once, and owns any response-stream wrapper it returns. Other provider protocols keep their native transport.

HTTP response metadata remains on `llm/response-meta`; the adapter does not interpret billing fields or represent SSE records as HTTP headers. A deployment consumer owns receipt validation, bounded stream processing, independent accounting events and persistence. The event does not alter model context or Session format.

## Alternatives considered

**Global fetch replacement** loses transport scope and can affect credentials, unrelated providers and plugin teardown. **Gateway-specific fields in the adapter** couple the generic provider implementation to one product's billing rules. **Deriving charges from token statistics** cannot establish final settlement, holds or server-side policy snapshots.

## Consequences

Trusted Host plugins can observe late accounting without sharing mutable per-session request state. They also receive sensitive HTTP inputs and must not log credentials or private endpoint data. Stream wrappers must retain backpressure and cancellation, keep metadata parsing bounded and preserve normal provider output and usage. The event itself offers no recovery of receipts lost to transport or process failure; the gateway ledger remains authoritative.
