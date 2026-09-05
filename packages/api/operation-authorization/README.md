---
description: "Deployment authorization for Remote model selection, settings, credentials, and model discovery without exposing secret values to policy listeners."
kind: "package-library"
---

# @deepseek-ai/dsh-api-operation-authorization

English | [中文](README.zh.md)

## Summary

This library lets independently mounted Remote owners ask deployment policy before changing protected state or discovering models. Policy receives detached, non-secret operation metadata. A refusal stops the operation before its executor; an unexpected policy error becomes a fixed public-safe refusal. The library supplies no account, membership, payment, or model-execution policy itself.

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

### When to use it

Import this library in a Remote operation owner and call `authorizeApiOperation` after resolving its target but before performing the write or discovery. It has no Cordis mount row. Deployment plugins subscribe to `api/authorize-operation` and may throw `ApiAuthorizationError` containing a public-safe message, reason code, and optional public details.

### Entry point

The [settings and credential owners](../settings-controller/README.md) and [LLM discovery owner](../../llm/llm/README.md) call the same admission helper directly. This remains effective when their methods are invoked without a network carrier. Metadata mutation cannot change the actual request because the helper clones the descriptor before serial dispatch.

The settings owner removes schema-declared secrets and retains mutation paths; a compound schema branch containing secrets retains only submitted property names and undefined values when structural redaction cannot inspect it. Protected-route detection therefore still sees touched keys. Credential descriptors contain only their reference name, and discovery descriptors exclude the one-shot API key. Owners must perform this redaction before calling the helper.

An explicit policy refusal returns `api/operation-denied` with its public reason and `retryable: false`. All other exceptions return the fixed `AUTHORIZATION_UNAVAILABLE` reason and generic recovery message; their internal message and cause are not attached to the wire error. No listeners means the operation is admitted. Catalog filtering uses the separate `api/model-catalog` event and does not grant execution authority.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The library depends only on Cordis, branded identifiers, and the Remote error protocol. It does not import settings, sessions, or LLM services, so independent operation owners can share the policy vocabulary without creating a dependency cycle. The owner remains responsible for running admission before its commit and for authorizing later model execution. No runtime invariant companion is published because the helper retains no state or derived cache.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Operation authorization decision](../../../.agents/notes/implemented/architecture/2026-08-27-operation-authorization-before-model-configuration.md)
- [Settings Controller](../settings-controller/README.md)

-----

<a id="model-experience"></a>
## Model Experience

### API admission

#### What the model sees

Nothing directly. Owners return `api/operation-denied` to the calling user interface; this library registers no prompt or tool.

#### Token effect

None. Admission does not invoke a model.

#### KV Cache effect

None. The helper does not change model context or in-flight requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Direct provider-service calls and settings-file edits do not pass through Remote admission. Restricted products must compose the policy plugin and independently check actual model execution.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
