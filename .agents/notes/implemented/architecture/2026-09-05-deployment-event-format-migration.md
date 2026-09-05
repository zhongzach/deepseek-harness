# Agent Note: Validated deployment events across Session format generations

Status: implemented

English | [中文](2026-09-05-deployment-event-format-migration.zh.md)

## Problem

Released WriterX logs contain informational billing records absent from the official frozen v0 and v1 event inventories. Some records predate `ignorable`. The official adjacent migration correctly refuses unknown historical payloads because a sequence-remapping edge cannot infer whether an unknown payload contains sequence references. Merely retaining the current-event registry would leave these existing sessions unreadable after upgrading to v2.

## Decision

The product explicitly registers opaque log-only events through `registerOpaqueSessionEvent` in the low-level format package. Each registration declares exact supported generations and validates the complete payload. It guarantees that payloads contain no Session sequence references; event envelopes carrying surface placement or source sequences refuse. Frozen migration inventories continue to own official events, while this narrow extension validates and preserves registered informational records as their enclosing event positions change. The WriterX billing plugin admits only its exact model, charged-count, and nullable-balance payload for v0, v1, and v2.

Current-format registrations live outside the generated vocabulary in the Session package and count overlapping owners. The catalog takes their snapshot at restoration time. This preserves required pre-marker records without making the official static vocabulary composition-dependent. Registration lifetimes follow the owning plugin. The product mounts the billing plugin before opening stored sessions.

This decision extends [deployment-owned event compatibility](2026-08-20-deployment-owned-session-events.md) and narrowly supersedes the unknown-event refusal policy for explicitly classified product information. Arbitrary unknown historical events, including unknown `ignorable` events, still refuse. The [immutable generation publication rule](2026-08-31-released-session-format-migrations.md) is unchanged: migration exclusively creates the versioned successor beside the untouched source.

## Alternatives considered

- Hardcoding WriterX names into official inventories couples the generic runtime to one product and does not validate a separately deployed plugin's payload.
- Trusting every registered name or `ignorable` marker cannot prove that sequence remapping is safe.
- Rewriting legacy files to add markers destroys the original artifact and still does not classify embedded references.
- Discarding information makes migration succeed by losing billing history.

## Consequences

Historical compatibility requires the product validator at session-open time. Tests migrate actual v0 and v1 JSONL through the real provider, retain flagless and marked billing records, verify their remapped positions and payloads, compare source SHA-256 hashes, reopen v2, and reject unknown types, unexpected payload fields, or surface references without publishing a successor. Owner disposal tests cover both registries. The generic runtime does not attempt to repair malformed product history.
