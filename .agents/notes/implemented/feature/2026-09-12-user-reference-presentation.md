# Agent Note: Product-owned user reference presentation

Status: implemented

English | [中文](2026-09-12-user-reference-presentation.zh.md)

## Problem

A product can show a localized skill title in the composer while its sent message exposes the serialized invocation ID. Replacing the entire user-message renderer to fix this would duplicate attachment handling, copy actions and timestamps. Changing serialized references would instead affect model input and historical replay.

## Decision

The Chat view owns one `conversation.message.user-text` chain. Its authorized renderer reaches durable user and steering nodes plus immediate submission echoes through the optional `renderUserText` owner callback. The original text, associated session labels, loaded skill names and optional file-opening callback enter the chain. Declining the chain preserves native rendering. Attachments and original-text actions remain outside it. A stable `data-user-message-bubble` attribute permits product styling scoped to its own child content.

The shared `projectUserText` matcher accepts an optional reference renderer. It passes category, display label, exact matched token and unwrapped value; unmatched plain runs retain their text and order. This keeps reference parsing shared while letting a product use readable titles and clickable file capsules. Neither extension changes Session events, reference serialization, copy payloads or model requests.

## Alternatives considered

**Serialize localized labels instead of invocation IDs.** This changes execution rather than presentation and makes identity depend on a mutable title. The display layer can resolve titles without changing invocation authority.

**Replace the complete keyed user renderer.** The product would inherit responsibility for images, files, copy actions and immediate echoes. A text-only chain keeps those native behaviors in one owner.

**Rewrite the rendered DOM after each update.** This bypasses the slot lifecycle and React ownership, risks stale nodes after history replay, and cannot share the matching rules with other text consumers.

## Consequences

Products can localize sent references and style their bubbles without copying Chat internals. Title availability remains a product metadata concern; an unavailable title must not prevent displaying the original reference. Focused tests retain matching, fallback, attachment and copy behavior. The consuming WriterX browser scenario checks localized sent messages, exact model input, file navigation, reload and dark/light theme presentation using only synthetic data and a local model fixture.
