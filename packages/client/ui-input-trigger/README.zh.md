---
description: "Web GUI 的输入触发流水线：光标处的 / 与 @ 检测、分组候选菜单，以及把 pick 路由到已注册 source；供斜杠命令与引用的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-input-trigger

[English](README.md) | 中文

## 概述

当用户在 Web GUI 的光标处键入 `/` 或 `@` 时，本包会为斜杠命令、文件引用和会话引用打开分组菜单。它支持键盘和指针选择，包括下钻候选项，以及在当前选区上打开单个候选分组的 launcher。pick 会触发命令流程或插入引用，具体结果由消费它的输入表面处理。本包只影响浏览器呈现；它既不组装也不发送模型请求。

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

替换提供方可内联仅构建使用的 `./client/controller` 入口，无需挂载默认插件或将其加入浏览器模块表。该入口导出调用方拥有的控制器类与类型，共享静态 Client store 库，不注册服务。实际装配的提供方负责每个控制器的 Session 生命周期。

与 `ui-conversation` 一起挂载本插件；用户在光标处键入触发器时，菜单随即出现在输入浮层中。分组候选项渲染在标题行之下；pick 路由到 source，消费方表面应用其结果——斜杠命令打开其弹窗或执行，引用插入其行内 token。

### 键盘与鼠标

菜单打开期间 composer 表面保持焦点：行在 mousedown 时完成 pick，高亮由 `aria-activedescendant` 承载，指针落在菜单与所在 composer 卡片之外即关闭菜单。空格与回车裁决按注册序轮询可选的 `matchSpace`／`matchEnter` 钩子；第一个非 undefined 的应答胜出，source 也可以拒绝它无法整体消费的提交。Tab 会作用于高亮补全项：声明 `drill: true` 的候选项以 `action: 'drill'` 进入 `onPick`，普通候选项则以 `action: 'pick'` 完成选定；没有高亮项时 Tab 原样放行，原生焦点遍历不受影响。可下钻行尾的 chevron 向指针用户提供同一个动词。实现可选 `header` 钩子的 source 还会在其分组上方发布面包屑：管线在每次命中时用实时查询、以及该查询由下钻还是由键入产生这一事实重新询问它，点击面包屑经 `onPick` 以 `action: 'drill'` 回到该 source。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`src/core/` 负责触发器检测、菜单归约与精确匹配。根服务持有来源名录，每个会话范围的 `InputTriggerController` 拥有候选请求与菜单状态。Conversation shell 基于 Lexical 检测坐标驱动追踪与裁决。来源通过 Cordis effect 注册，也可发布词表更新。`MenuView` 占据 Conversation 拥有的 `conversation.input.overlay` 槽位，关闭时不渲染内容。面包屑使用独立 store，位于 listbox 的可滚动选项区之外。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当触发流水线不够用时阅读以下页面。它们从流水线进入注册进它的 source，以及拥有输入的会话外壳。

- [ui-commands](../ui-commands/README.zh.md)——把 `/` 命令 source 注册进本流水线并拥有命令弹窗外壳。
- [ui-reference](../ui-reference/README.zh.md)——注册 `@` 文件与会话引用 source。
- [ui-conversation](../ui-conversation/README.zh.md)——声明输入浮层槽位并拥有 composer 与输入状态机。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册槽位。

-----

<a id="model-experience"></a>
## 模型体验

无。触发流水线只是浏览器呈现——pick 产出命令声明与引用插入，其模型可见后果由消费它们的宿主与输入状态机包负责。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了当前触发流水线。它们是当前包约束，不是通用菜单对比或任务积压。

- **只有全局 source 层**——会话 scope 的 source 注册（逐会话遮蔽）已有设计但未启用；台账记录着触发条件，即真实的逐会话 source 需求。
- **`InputTriggerCandidate.icon` 以文本渲染**——`MenuView` 把该字符串原样放进图标位；与设计系统图标枚举的接入将在该枚举交付后完成。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。trigger pipeline 是浏览器侧纯逻辑加一个 registry，HMR 测试覆盖释放；它不发出 Cordis 事件，也不持有跨插件可变状态。
