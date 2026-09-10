# Agent Note: The layout shelf column

Status: implemented

English | [中文](2026-08-14-layout-shelf-column.zh.md)

## Problem

The web shell frame is a three-column grid: sidebar | center | details. A product composition (the NovelStudio desktop app) needs a Codex-style right panel for a novel-project bookshelf and file preview, beside the existing tool-details column. Occupying the `details` slot would collide with ui-conversation's DetailsPanel at load — slot conflicts are the composition model speaking, not something to patch around. The right column therefore has to exist as its own layout slot.

## Decision

`ui-layout` provides an independent `shelf` column between `main` content and the standard `rightbar` track:

- **Slot**: `'shelf': { kind: 'single', scope: 'session' }`, declared by the root registration, with an empty owner share (sessionId arrives as a framework-standard prop). `ctx.layout` exposes `openShelf()` / `closeShelf()` / `toggleShelf()` / `resizeShelf(px)`; `layoutInfo` retains a shelf width preference (0 = closed, `SHELF_DEFAULT = 300`, drag range 300–1040).
- **Concession chain**: keep center >= `CENTER_MIN` by shrinking the shelf first, then the right track, then closing the right track. The shelf never auto-closes — it is a primary product panel, treated like the sidebar. With the shelf preference 0 (the default), the solve uses standard sidebar/main/rightbar geometry: the extra track renders at 0px and the collapsed column paints no border.
- **Occupancy**: no shipped row occupies `shelf`. A product composition (e.g. the NovelStudio shell's `--patch` overlay) inserts its own client plugin into it. The dev web-app bundle does not register the shelf plugin, keeping the development surface untouched.

## Alternatives considered

**Reuse the `details` slot.** Rejected because ui-conversation already occupies that single slot with `DetailsPanel`; making the product shelf compete for it would turn a required product column into a load-order conflict.

## Consequences

- The unoccupied shelf reserves no width: fresh `layoutInfo` has `shelf: 0`, and `data-shelf-collapsed` suppresses the border seam.
- A product panel can now live in a real right column, openable next to tool details, each with its own drag handle.
- The standard rightbar owner controls expansion and fullscreen presentation; the independent shelf does not auto-close on session change.
- The product composition registers its shelf plugin into `shelf`; the official Web composition leaves that slot empty.
