# Agent Note: Product presentation boundaries for preboot and durable context

Status: implemented

English | [中文](2026-08-25-product-presentation-boundaries.zh.md)

## Problem

The Web client persists implementation identities for reconstruction: Loader
entry ids are package names, and context message sources name their producing
plugin. A wrapped product must not rewrite those durable identities, but it also
must not copy the complete context renderer merely to replace one technical
producer's public presentation. The framework-free boot page has the same
problem before any client plugin can mount.

## Decision

The `context` Chat Node declares the session-scoped chain
`conversation.chat.context.presentation`. It dispatches the cache-stable context
data as common owner currency and retains `ContextInjectionRow` as the all-decline
fallback. Product entries use pure `select` functions to claim only the sources
they present; every unclaimed context keeps the built-in form-aware renderer.

The framework-free `BootPage` separately accepts optional, pre-injected
`BootPresentation` copy. Namespace aliases redact complete scoped-package tokens
only in the displayed failure projection. Loader ids, thrown errors, session
events, context sources, and model-facing bytes stay unchanged.

## Invariants

- Presentation selectors never mutate or rename durable sources.
- A declined context renders byte-for-byte through the existing fallback.
- A claimed presentation must not put the raw source into text, accessibility
  names, titles, or diagnostic attributes.
- Preboot branding is optional; an unwrapped Harness deployment keeps the
  original wordmark, loading copy, and failure details.
- Raw diagnostics remain available in logs and developer tooling.

## Verification

Client tests cover all-decline fallback, product takeover, accessible names,
source immutability, default preboot copy, branded preboot copy, and namespace
redaction in both failed entry ids and aggregate failure reports.

## Consequences

Wrapped products can own technical context and preboot copy without changing
replay identity or forking the complete context renderer. The added cost is one
chain dispatch for context nodes and one small parser-blocking presentation
object in branded index pages; unwrapped deployments pay no visible change.

## Alternatives considered

| Rejected | Reason |
|---|---|
| Rename durable plugin sources | Breaks runtime-context ownership, replacement, and replay semantics |
| Shadow the keyed `context` renderer | Cannot decline by source and would force products to copy every context form |
| CSS text replacement | Leaves the private name in accessibility text and expanded bodies |
| Hardcode one product in BootPage | Pollutes the generic Web kernel and makes other wrappers fork it again |
