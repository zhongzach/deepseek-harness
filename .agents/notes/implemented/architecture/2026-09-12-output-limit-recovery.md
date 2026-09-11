# Agent Note: Context-backed output-limit recovery

Status: implemented

English | [中文](2026-09-12-output-limit-recovery.zh.md)

## Problem

A provider output limit can leave useful text or incomplete tool arguments without producing an adapter error. Request-error policies cannot recover that terminal result, while retrying unchanged input can repeat expensive output and leave ambiguous tool execution.

## Decision

The Agent event interface exposes `agent/output-limit` after the partial Assistant settlement and before tool dispatch. A handling policy can retain or replace model-visible context and request another attempt in the same step. The loop rejects a retry with no appended or replaced context, checks cancellation after the callback and never dispatches tool calls from the truncated response. Without a policy, max-tokens retains its existing terminal meaning.

Recovery policy remains outside the loop. It owns partial-output representation, request budgets and bounded continuation; ordinary network errors keep the separate request-error policy. Existing Session events retain both the original provider stream and sourced context changes, so no format generation or synthetic successful completion is needed.

## Alternatives considered

**Unconditional retries** repeat the same request without progress. **Marking truncated output as successful** hides incomplete tools and can advance goals incorrectly. **A second Agent or task queue** adds execution ownership without solving partial-output retention. **Continuation after the turn closes** loses the original active goal's execution interval.

## Consequences

Deployments can finish a recoverable step without copying the loop or changing default SDK behavior. A malformed recovery callback fails with `INVALID_RECOVERY` instead of spending another model request. Policies must preserve author cancellation and file protections and must not execute retained tool fragments. Focused tests cover default termination, same-step recovery, unchanged-context rejection, cancellation and undispatched tools; deployment scenarios own end-to-end writing behavior.
