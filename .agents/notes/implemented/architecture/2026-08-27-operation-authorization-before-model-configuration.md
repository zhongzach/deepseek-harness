# Agent Note: Operation authorization before model configuration

Status: implemented

English | [中文](2026-08-27-operation-authorization-before-model-configuration.zh.md)

## Problem

Deployments need to restrict model selection and custom-provider configuration without putting account or billing policy in the agent loop. A disabled client control cannot protect direct RPC calls, and a default-save callback runs after the session selection has changed. Model-directory eligibility must also remain distinct from provider routing and from permission to execute a later model request.

## Decision

The API gateway owns a serial pre-operation authorization event. It awaits deployment policy before mutating a resolved session selection, changing settings or credentials, or invoking model discovery. Listeners receive detached metadata without credential values; settings metadata uses the owning schema's secret redactor and retains mutation paths. Rejection leaves the operation's state unchanged and returns `operation-denied`, a public reason code and a non-retryable marker. An unexpected listener failure denies rather than continuing.

Directory projection is a separate serial event over the shared Host catalog. A deployment can filter visible provider groups, models and provider-failure rows, and publish selection eligibility on retained models without changing model identities or provider routing. The composer, `/model` popup and directory controller refuse disabled rows that remain visible.

When authorization changes, the deployment invalidates the shared directory through its resolver and closes matching `/model` popups through `CommandUiContract.dismissPopups`. Directory invalidation clears selectable rows while retaining the current selection; popup dismissal aborts pending option reads and revokes late results' write access without consuming command text, moving focus or closing other commands' popups. Model identities, saved provider configuration and credentials remain unchanged. Neither directory metadata nor a successful selection reserves credits or authorizes future model requests; execution authorization remains the operation owner's responsibility.

Optional availability actions supply deployment-owned labels and opaque ids. The model picker emits a local help event from independent enabled buttons while model rows remain disabled. The command popup deduplicates actions from its filtered rows and closes before dispatching help, preserving command text and allowing the destination dialog to take focus. Product account UI owns login, membership and checkout; the generic picker neither parses account codes nor retries the refused operation.

## Alternatives considered

**Check only in client controls.** Direct RPC callers and stale open menus bypass client presentation. The gateway checks before its executor, and deployed LLM policy owns the final model-call check.

**Reject inside default persistence.** The session has already switched by then; storage refusal intentionally leaves a successful session-local switch intact. Authorization therefore runs before the assignment.

**Add a competing RPC interceptor.** Interceptor ordering would decide whether authorization is reached, and gateway methods would still remain directly callable. The operation itself emits the event.

**Embed subscription and credit policy in harness.** Those decisions belong to each deployment. Generic operation descriptors, refusal fields and catalog availability cover the existing consumers without importing a product account service.

**Treat help as another selectable model row.** Model selection and account navigation have different effects. Separate help callbacks prevent accidental model RPCs, and a footer keeps the remedy visible when a large catalog scrolls or a model-name search filters the options.

## Consequences

The gateway keeps ordinary behavior when no policy is mounted, so a restricted product must compose its authorization plugin. Raw settings-file edits and direct provider-service calls are outside this API event; deployments still validate protected routes and authorize actual model execution. Secret redaction inherits the settings schema's supported containers rather than adding a second secret model.

Executor tests exercise selection through the in-process fetch carrier and verify that refusal changes neither the session nor its default. Configuration tests verify unchanged settings, retained credentials, no discovery invocation and secret-free metadata. Client tests cover disabled pointer, keyboard and controller selection, visible reasons and shared-directory invalidation. Popup lifecycle tests cover command-scoped dismissal, unchanged command text and focus, and ignored late option results; product wiring tests cover account invalidation. Real picker and popup components exercise click, Enter and Space through the plugin's action event, verifying no selection RPC, no command consumption, and dismissal before help dispatch. Product compositions own account-lifecycle and final-call verification; no external model requests are required for these generic tests.
