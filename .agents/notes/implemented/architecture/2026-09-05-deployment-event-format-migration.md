# Agent Note: Validated deployment events across Session format generations

Status: implemented

English | [中文](2026-09-05-deployment-event-format-migration.zh.md)

## Problem

Released WriterX logs contain informational billing records absent from the official frozen historical event inventories. Some records predate `ignorable`. The official adjacent migration correctly refuses unknown historical payloads because a sequence-remapping edge cannot infer whether an unknown payload contains sequence references. A current-event registry alone cannot classify those records during restoration through historical formats.

## Decision

The product explicitly registers opaque log-only events through `registerOpaqueSessionEvent` in the low-level format package. Each registration declares exact supported generations and validates the complete payload. It guarantees that payloads contain no Session sequence references; event envelopes carrying surface placement or source sequences refuse. Frozen migration inventories continue to own official events, while each streaming adjacent migration stage validates and preserves registered informational records as their enclosing event positions change. The WriterX billing plugin admits only its exact model, charged-count, and nullable-balance payload for v0, v1, v2, and v3.

Current-format registrations live outside the generated vocabulary in the Session package and count overlapping owners. The catalog takes their snapshot at restoration time. This preserves required pre-marker records without making the official static vocabulary composition-dependent. Registration lifetimes follow the owning plugin. The product mounts the billing plugin before opening stored sessions.

The persistence verifier captures known current-format event names before its bounded Worker queue. That immutable snapshot accompanies the private verification request; the Worker validates and registers the names only during full generation verification, then releases every registration. A Worker has no access to the parent registry, so an implicit lookup there would reject legitimate flagless deployment records. The snapshot comes from the initiating runtime, not from names encountered in the file; historical payload validation remains in the migration chain.

This decision extends [deployment-owned event compatibility](2026-08-20-deployment-owned-session-events.md) and narrowly supersedes the unknown-event refusal policy for explicitly classified product information. Arbitrary unknown historical events, including unknown `ignorable` events, still refuse. The [immutable generation publication rule](2026-08-31-released-session-format-migrations.md) is unchanged: migration exclusively creates the versioned successor beside the untouched source.

## Alternatives considered

- Hardcoding WriterX names into official inventories couples the generic runtime to one product and does not validate a separately deployed plugin's payload.
- Trusting every registered name or `ignorable` marker cannot prove that sequence remapping is safe.
- Rewriting legacy files to add markers destroys the original artifact and still does not classify embedded references.
- Discarding information makes migration succeed by losing billing history.

## Consequences

Historical compatibility requires the product validator at session-open time. Tests migrate v0, v1, and v2 records through the V3 chain, retain flagless and marked billing records, and reject unknown types, unexpected payload fields, or surface references. Provider tests compare source SHA-256 hashes and open the current successor without changing predecessor files. Owner disposal tests cover both registries. The generic runtime does not attempt to repair malformed product history.
