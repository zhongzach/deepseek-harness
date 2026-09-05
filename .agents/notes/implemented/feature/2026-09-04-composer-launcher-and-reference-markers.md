# Agent Note: Composer launchers and reference markers

Status: implemented

English | [中文](2026-09-04-composer-launcher-and-reference-markers.zh.md)

## Problem

Products need to present skills and files through their own composer launcher without forking the conversation input machine. The default command source, typed command adjudication, reference serialization, textarea selection, and focus behavior are one pipeline, so hiding a menu row by unregistering its source also removes behavior that direct submission still needs. A product-owned popover that edits the textarea independently would bypass the machine's draft-revision check, structured occurrences, undo transaction, and caret restoration.

Products also need distinct reference presentation and localized input guidance. These choices need to remain in their own Cordis packages and bundle configuration while the composer retains focus, editing, and submission ownership.

## Decision

The default trigger vocabulary remains `/` and `@`. A replacement Cordis provider implements source routing through the existing controller interface. The `ui-input-trigger/client/controller` build entry exports the same controller implementation without a plugin body. It is safe to inline this exact entry because each consumer owns its controller instances; its snapshot-store runtime remains shared. A built replacement therefore does not require activating the default provider just to import its class. The default controller, source registry and file-reference service retain their own behavior.

`ReferenceInsert` carries an optional display `marker` and a `skill` appearance. Omission renders the established `@` projection. The input machine owns insertion and stores the occurrence as before. The marker does not change the source trigger, codec, or model text; rendering supports `#` file references while preserving legacy `@` file and session presentation.

The Host conversation plugin accepts optional `inputPlaceholder` and `heroPlaceholder` dictionaries with explicit Chinese and English strings. These become the existing conversation settings base; user settings can override them, and mounted inputs follow settings and language changes. Workspace, blocked-session, plan and queue-steering messages retain their respective precedence. These fields add no model input.

The conversation composer declares the session-maybe single slot `conversation.input.launcher`. Its `ComposerLauncherOwnerProps` provides `locked`, `openSource(source, trigger)`, and `insertReference(reference)`. InputBar captures the live textarea selection, delegates span construction to the session input wiring with the current draft revision, and restores textarea focus and selection or the post-insertion caret. With no occupant, the existing plus button and command-only menu are the slot fallback.

## Alternatives considered

**Fork InputBar in each product.** A fork can draw any launcher, but it duplicates IME handling, selection recovery, attachment admission, accessibility, and every later composer fix.

**Unregister command sources that a product does not show.** Registration owns both discovery and execution. Removing the source also removes Enter and space adjudication, codecs, lexicons, and warmup.

**Let a launcher write draft text directly.** Direct writes cannot atomically mint a reference occurrence or apply the menu-time draft revision, and focus/caret behavior diverges between pointer and keyboard selection.

**Import the default browser plugin solely for its controller.** The module graph activates every module row as a Cordis plugin. Publishing that row together with a replacement provider would register the same service twice. The independent build entry avoids adding module-only activation rules or copying controller source into products.

**Add product marker routing and menu policy to the default provider.** Product providers can adapt the detection view and preserve the official source interface. Shared code only needs the presentation metadata and launcher verbs it owns.

**Override another plugin's locale namespace.** Locale registration has one owner per namespace and locale. The two configuration fields provide product copy without changing dictionary ownership or replacing the entire composer.

## Consequences

Products can replace one launcher seat, compose their own trigger provider and configure input guidance while retaining the shared input machine. The shared defaults do not assume a product-specific marker policy. Model-visible reference instructions belong to the consuming product's prompt plugin, not the default file-reference provider.

The accepted additions are one standalone controller build entry, one launcher slot, reference display metadata and two localized copy fields. The build entry requires a matching Harness artifact before a replacement provider is compiled. Package and composition coverage exercise artifact closure, focus and selection, draft-revision insertion, marker rendering, copy configuration, language updates and guidance precedence.
