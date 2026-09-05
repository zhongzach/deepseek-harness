---
description: "在不向策略监听器暴露密钥值的前提下，为 Remote 模型选择、设置、凭据和模型发现提供部署授权。"
kind: "package-library"
---

# @deepseek-ai/dsh-api-operation-authorization

[English](README.md) | 中文

## 概述

本库让独立挂载的 Remote 操作归属方，在改变受保护状态或发现模型之前询问部署策略。策略收到独立、不含机密的操作元数据。拒绝会在执行器运行前停止操作；意外的策略错误会变成固定、可公开的拒绝信息。本库本身不提供账号、会员、支付或模型执行策略。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

### 何时使用

在 Remote 操作归属方导入本库，在解析目标后、实际执行写入或发现之前调用 `authorizeApiOperation`。本库没有 Cordis 挂载行。部署插件订阅 `api/authorize-operation`，可抛出 `ApiAuthorizationError`，其中只包含可公开消息、原因码和可选的公开详情。

### 入口

[设置与凭据归属方](../settings-controller/README.zh.md)和[LLM 发现归属方](../../llm/llm/README.zh.md)直接调用同一个授权函数。即使方法在没有网络载体的情况下被调用，检查仍然有效。函数会在串行派发前复制描述符，因此修改元数据不能改变实际请求。

设置归属方移除 schema 声明的机密，并保留修改路径；如果结构化脱敏无法检查含机密的复合 schema 分支，则只保留提交的属性名和 undefined 值，因此受保护路由检测仍可看到触及的键。凭据描述符只包含引用名称，发现描述符排除一次性 API key。调用方必须在调用授权函数之前完成这些脱敏。

显式策略拒绝返回 `api/operation-denied`、公开原因和 `retryable: false`。其他异常均返回固定的 `AUTHORIZATION_UNAVAILABLE` 原因与通用恢复提示，不把内部消息或 cause 附到 wire 错误中。没有监听器时，操作会被允许。目录过滤使用独立的 `api/model-catalog` 事件，不授予执行权限。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本库只依赖 Cordis、带品牌的标识和 Remote 错误协议，不导入 settings、sessions 或 LLM 服务，因此独立操作归属方可共享策略词汇而不产生依赖环。归属方仍负责在提交前执行授权，并为后续模型执行授权。本库不发布运行时不变式伴生入口，因为授权函数不保留状态或派生缓存。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [操作授权决策](../../../.agents/notes/implemented/architecture/2026-08-27-operation-authorization-before-model-configuration.zh.md)
- [Settings Controller](../settings-controller/README.zh.md)

-----

<a id="model-experience"></a>
## 模型体验

### API 授权

#### 模型看到什么

没有直接内容。归属方向调用的用户界面返回 `api/operation-denied`；本库不注册提示词或工具。

#### Token 影响

没有。授权不会调用模型。

#### KV Cache 影响

没有。授权函数不改变模型上下文或进行中的请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 直接调用提供方服务或编辑设置文件不经过 Remote 授权。受限产品必须组合策略插件，并独立检查实际模型执行。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

暂无。

</details>
