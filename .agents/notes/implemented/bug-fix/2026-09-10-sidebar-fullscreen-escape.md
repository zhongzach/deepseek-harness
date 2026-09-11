# Agent Note: Escape returns from sidebar fullscreen

Status: implemented

English | [中文](2026-09-10-sidebar-fullscreen-escape.zh.md)

## Problem

An editable file tab can cover the conversation in fullscreen. A missing keyboard exit makes the user depend on the panel's chrome to return, including when focus remains inside the editor.

## Decision

The right-sidebar UI plugin owns Escape while its current session's panel is shown fullscreen. Escape and the exit button share one action: wide viewports return to push mode; automatic narrow fullscreen collapses the panel. Neither operation removes tab records or remounts document bodies.

The listener handles unmodified, non-repeating Escape after editor handlers. IME composition and consumed events are excluded. A capture listener records open semantic overlays before they can synchronously disappear, so an overlay's Escape does not also exit fullscreen. Both listeners are released when the panel leaves fullscreen, switches sessions or unmounts.

## Alternatives considered

**Implement Escape in each file plugin.** The public tab actions do not expose presentation changes, and multiple split bodies would own competing window listeners.

**Close and reopen the current file.** Removing a tab changes its lifetime and can discard editor state; leaving fullscreen is a layout action, not a document close.

## Consequences

The correction remains inside the right-sidebar UI plugin. It adds no public API, Session events, model calls or Agent-loop changes. Events consumed by embedded editors remain theirs; keyboard events in isolated iframe documents do not reach the parent listener.

## Verification

The sidebar seat tests cover wide and narrow exit, tab identity, overlay precedence, native selects, IME, modifiers, repeats and listener disposal. WriterX's real-sidebar editor regression also checks that the focused textarea, unsaved text and selection survive Escape.
