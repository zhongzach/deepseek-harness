# Agent Note: The layout shelf column

Status: implemented

English | [中文](2026-08-14-layout-shelf-column.zh.md)

## Problem

The web shell frame is a three-column grid: sidebar | center | details. A product composition (the NovelStudio desktop app) needs a Codex-style right panel for a novel-project bookshelf and file preview, beside the existing tool-details column. Occupying the `details` slot would collide with ui-conversation's DetailsPanel at load — slot conflicts are the composition model speaking, not something to patch around. The right column therefore has to exist as its own layout slot.

## Decision

`ui-layout` grows a fourth column, `shelf`, between center and details:

- **Slot**: `'shelf': { kind: 'single', scope: 'session' }`, declared by the same root `register()` call as the other three, with an empty owner share (sessionId arrives as a framework-standard prop). `ctx.layout` gains `openShelf()` / `closeShelf()`; the layout store gains a `shelf` width preference (0 = closed, `SHELF_DEFAULT = 400`, drag range 300–560).
- **Concession chain**: keep center >= `CENTER_MIN` by shrinking the shelf first, then details, then auto-closing details. The shelf never auto-closes — it is a primary product panel, treated like the sidebar. With the shelf preference 0 (the dev default) the chain reduces exactly to the previous three-column behavior, so the development GUI is bit-for-bit unchanged: the extra track renders at 0px and the collapsed column paints no border.
- **Occupancy**: no shipped row occupies `shelf`. A product composition (e.g. the NovelStudio shell's `--patch` overlay) inserts its own client plugin into it. The dev web-app bundle does not register the shelf plugin, keeping the development surface untouched.

## Consequences

- The dev GUI is visually unchanged: fresh store state has `shelf: 0`, the fourth grid track is 0px, and `data-shelf-collapsed` suppresses the border seam.
- A product panel can now live in a real right column, openable next to tool details, each with its own drag handle.
- Details behavior (session-change auto-close, drag semantics, concession) is preserved; the shelf deliberately does not auto-close on session change.
- The shelf plugin package (`@deepseek-ai/dsh-client-ui-novel-shelf`) is a follow-up; it registers into `shelf` via `slots.inject` and ships only in the product composition.
