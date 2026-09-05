---
description: "Shell layout for the Web GUI: four-column AppFrame, product titlebar, drag handles, panel geometry, and theme presentation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

## Summary

This package provides a four-column AppFrame (sidebar, conversation, optional product shelf, details), a product titlebar slot, resizable panels, and `ctx.layout` geometry actions. When space runs out, the concession chain shrinks shelf then details and finally closes details. The theme presenter projects resolved tokens, content font size, and `theme-color` metadata onto the document. Panel geometry is transient and resets on reload.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin at the root slot. Products register `shelf` and `titlebar` alongside the standard columns; absent occupants leave those regions empty. Users resize visible panels through their handles. A closed sidebar retains a 56px control rail; shelf and details close to zero width while their mounted subtrees retain state.

### Theme presentation

The presenter consumes resolved theme snapshots and projects them onto the document: `html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens and `--dsh-content-font-size` as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background. Disposing the presenter removes its metadata node with its other global writes.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

One `register()` contributes `AppFrame` and declares `sidebar`, `conversation`, `shelf`, `details`, `shell.overlay`, and `titlebar`. Its transient store starts sidebar at the default width and both auxiliary panels closed. All column subtrees stay mounted; the strict details entry uses `SessionProvider`. Document title combines the selected Session title with the preboot presentation title, build title, or localized fallback. The theme presenter separately applies resolved tokens and derives its metadata color from the rendered body.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the layout surface is not enough. They move from the frame to the columns it renders and the theme it presents.

- [ui-sidebar](../ui-sidebar/README.md) — occupies the `sidebar` column and its seats.
- [ui-conversation](../ui-conversation/README.md) — occupies the `conversation` and `details` columns.
- [ui-theme](../ui-theme/README.md) — the theme seam whose resolved snapshots the presenter consumes.
- [Web client architecture](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the current layout behavior. They are current package constraints, not a general window-manager comparison or a task backlog.

- **Panel geometry is transient** — reload restores the sidebar default and details closed; switching between distinct Session ids also closes details and forgets its dragged width, while unselected surfaces render details at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details width as the rendered truth.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The shell viewing-state store behind ctx.layout emits no cordis events; clamp/prune/concession-chain sequencing is asserted directly by this package's columns and service specs.
