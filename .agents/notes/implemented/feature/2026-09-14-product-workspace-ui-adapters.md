# Agent Note: Product Workspace UI adapters

Status: implemented

English | [中文](2026-09-14-product-workspace-ui-adapters.zh.md)

## Problem

Products that organize domain documents need the native Workspace tree and Session navigation without forcing users to manage filesystem terminology. Copying the tree duplicates drafts, selection and directory adoption; sharing one cwd across documents weakens ownership.

## Decision

The native controls retain their layout and default behavior. A reversible navigation policy can handle an empty New Session and retain drafts in their original Workspace. Directory-flow callbacks carry optional preparation to a Session resolved by the existing cancellable navigation. An optional rename slot lets a product edit document metadata instead of a disambiguated Workspace alias. Explicit locale overrides replace selected labels while base dictionaries remain single-owner.

## Alternatives considered

**Replace the entire sidebar and composer.** This duplicates ownership and makes visual and interaction behavior diverge.

**Re-register the base dictionary.** This violates dictionary ownership and couples product activation order to translated copy.

**Put domain-specific names in native packages.** This couples the engine UI to a writing product; the extensions instead carry callbacks and strings.

## Consequences

Session paths, logs, membership and model dispatch remain unchanged. An owning product may submit a normal message from the preparation callback, but this package does not invent a message. Native users retain draft-transfer behavior unless a product policy disables it. Product unload restores native navigation, rename fallback and translations.

## Testing

Locale tests cover layered overrides and disposal. Workspace service tests cover policy replacement refusal and restoration. Native picker and browser tests retain default adoption and rename behavior; a product real-composition browser test exercises the new callback, rename slot and cross-Workspace drafts.
