# Agent Note: Settings navigation icon contributions

Status: implemented

English | [中文](2026-09-15-settings-navigation-icon-slot.zh.md)

## Problem

Product plugins add settings sections whose meaning is not represented by the shell's built-in icon lookup. Requiring the shell to recognize each downstream section id couples generic navigation to product-specific pages.

## Decision

The [settings slots](../../../../packages/client/ui-settings/src/client/contract/slots.ts) expose an optional root-scoped keyed `settings.section.icon` contribution. The [settings shell](../../../../packages/client/ui-settings-general/src/client/SettingsRoot.tsx) renders each icon using its section id as `entryKey` and passes the icon size. A missing contribution retains the built-in icon for that section.

The shell owns the decorative wrapper and keeps the navigation label as the accessible name. Product plugins register icon components through the existing slot lifecycle; navigation selection and section content remain independent of icon registration.

## Alternatives considered

**Product-specific ids in the shell.** This requires a generic package change whenever a downstream product adds or renames a page, so the product owns its icon registration instead.

**React nodes in section metadata.** Slot composition already carries UI contributions. Adding renderable values to section metadata would introduce a parallel rendering mechanism and mix view elements with section data.

## Consequences

The extension changes only presentation. It does not alter settings values, agent state, model-visible inputs, or session logs. Products without icon contributions retain the built-in appearance. The renderer's keyed dispatch and fallback are covered by the [settings component tests](../../../../packages/client/ui-settings-general/tests/settings-root.client.spec.tsx).
