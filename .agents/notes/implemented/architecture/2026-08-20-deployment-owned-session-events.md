# Agent Note: Deployment-owned session event compatibility

Status: implemented

English | [中文](2026-08-20-deployment-owned-session-events.zh.md)

## Problem

A deployment plugin can merge a product-owned, log-only event into `SessionEventMap`, but the repository-generated `KNOWN_SESSION_EVENT_TYPES` cannot include declarations that live outside this repository. A required record written before its producer stamps `ignorable: true` would therefore make the same deployed composition refuse that session during reconstruction, even though the mounted plugin understands the record.

## Decision

**The running composition explicitly registers each deployment-owned event type.** `registerSessionEventType(type)` adds the type to a process-local registry beside the generated static vocabulary and returns the disposer the owning plugin uses on unload. The composition that writes the event mounts the registration before persistence reconstructs sessions; unregistered unknown required events still refuse.

**Portable product records also carry `ignorable: true`.** `Session.append` accepts `AppendIntent` for log-only events and combines it with `SurfaceIntent` for surface events. A product-owned informational record uses the marker so another same-version composition that lacks its plugin can skip that record safely. Explicit registration remains necessary for records written before the marker existed.

**The persistence generator owns both compatibility paths.** `gen-persistence-catalog` emits the static event set together with the runtime registry, registration function, and combined lookup. The generated file is never patched by hand, so catalog freshness protects the runtime API as well as the event names.

## Alternatives considered

- **Add deployment event names to the repository-generated set** — couples a provider-neutral runtime to one product and still cannot cover independently distributed plugins.
- **Rely only on `ignorable`** — cannot recover required records already written without the marker.
- **Accept every unknown event type** — silently discards a record whose semantics may be required for correct reconstruction.
- **Build the entire known vocabulary from the mounted composition** — makes core event readability depend on plugin selection; the generated repository-wide set remains the stable same-version baseline.

## Consequences

The same product composition can reconstruct legacy product records, while portable informational records remain readable by a stock composition. Registration is process-local and follows plugin lifetime, so each deployment-owned type has an explicit owner and must be registered before session loading. A missing registration fails closed instead of silently changing the reconstructed session. Generator tests pin the runtime API, and persistence catalog freshness pins both generated artifacts.
