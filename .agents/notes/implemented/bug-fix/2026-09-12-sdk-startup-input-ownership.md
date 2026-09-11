# Agent Note: SDK startup input ownership

Status: implemented

English | [中文](2026-09-12-sdk-startup-input-ownership.zh.md)

## Problem

An SDK server can activate before the complete plugin tree finishes loading. If it consumes initialize while the tree subsequently fails or replaces that server, the pending handler can resume on a disposed context and mask the actual startup failure.

## Decision

The transport subscribes to the launcher's successful `appReady` notification before reading stdin. Loader-only embeddings use a cancellable settlement wait; bare in-process embeddings retain immediate startup. Disposal cancels readiness and drains startup work before closing the transport and owned sessions. Initialize still validates the current route after admission.

The SDK snapshot controller hydrates workspace tokens with forward slashes, preserving JSON validity on Windows. POSIX and PowerShell tool schemas have distinct recorded header owners rather than normalizing away real platform differences.

## Alternatives considered

**Only waiting inside initialize** lets a retired server consume the request before readiness. **Sleeping before startup** does not prove that loading succeeded. **Ignoring context or fixture errors** hides incomplete startup and weakens the replay oracle.

## Consequences

Failed startup retains its launcher error instead of being masked by an inactive-context RPC failure. Requests sent before readiness stay buffered for the active server. Unit tests cover delayed providers, server replacement and cleanup; the PowerShell SDK snapshot exercises truncation and continuation through the real CLI without changing default SDK output-limit policy.
