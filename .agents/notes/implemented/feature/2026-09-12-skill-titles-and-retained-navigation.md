# Agent Note: Human-facing skill titles and retained navigation

Status: implemented

English | [中文](2026-09-12-skill-titles-and-retained-navigation.zh.md)

## Problem

A writing composition needs readable skill titles without changing invocation IDs. Its manuscript directory must remain reachable beside open documents. A one-View conversation also reserves space for a nonexistent selector row. These are reusable catalog and shell concerns, not chapter-workflow state.

## Decision

`SkillSummary.displayName` carries an optional non-empty title through registry collection and loading. The filesystem provider reads `display-name` frontmatter, and `skills/list` forwards the title without activating an Agent. Lookup, duplicate resolution and model invocation still use the kebab-case `name`. Product importers own any conversion of human-authored names; the filesystem provider does not rewrite skill files.

A page type with a guide entry may opt into `retainAsDefault`. The lowest guide order selects the retained default, with registration order resolving ties. The right-sidebar store retains that page first in every expanded docked pane, refuses closing or replacing it, and backfills navigation after moves or floating without stealing the active document's focus. The same close predicate controls the chip and menu. Floating copies remain closable. Removing the option releases protection; ordinary compositions keep their existing default and close rules.

The conversation header reserves the selector row only while the selector exists. A single-View composition uses a compact single row. Multiple Views retain their tab row.

## Verification

Filesystem and cold-session catalog tests assert title propagation without changing invocation lookup. Retained-navigation tests cover direct file opens, close and replacement refusal, split panes, floating, policy removal, default selection, ordering and undo/redo. The consuming WriterX browser smoke exercises Chinese skill import and real invocation, a 51-pixel single-row header, and returning to the retained manuscript tab after closing a file.

## Alternatives considered

**Replace invocation IDs with localized titles.** This changes tool lookup and duplicate resolution, and breaks existing references. Keeping title and identity separate avoids that coupling.

**Hide the navigation close button with product CSS.** Keyboard, context-menu and programmatic closes could still remove the page. A store-owned opt-in keeps all paths consistent and leaves ordinary tab types unchanged.

**Reserve both header rows unconditionally.** A composition that exposes one View would continue to show an empty second row. Selector presence already supplies the necessary layout condition.

## Consequences

Consumers can display localized titles without translating skill instructions or changing durable session formats. A retained navigation page occupies one tab per docked pane; its floating copies are not protected. Product-specific names, word counts, goal controls and compaction presentation remain outside the native shell packages.
