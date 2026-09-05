---
description: "Web GUI 外壳布局：四栏 AppFrame、产品标题栏、拖动手柄、面板几何与主题呈现。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-layout

[English](README.md) | 中文

## 概述

本包提供四栏 AppFrame（侧栏、会话、可选产品书架、详情）、产品标题栏槽位、可缩放面板与 `ctx.layout` 几何动作。空间不足时，让步链先收缩书架，再收缩详情，最后关闭详情。主题呈现器把解析后的 token、正文字号与 `theme-color` 元数据投影到 document。面板几何是瞬时的，重新加载即重置。

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

在 root 槽位挂载本插件。产品可在标准栏位旁注册 `shelf` 和 `titlebar`，没有注册时对应区域为空。用户通过手柄调整可见面板。关闭的侧栏保留 56px 控制栏；书架和详情收至零宽度，同时保留已挂载子树的状态。

### 主题呈现

呈现器消费解析后的主题快照，并投影到 document：`html { color-scheme }` 驱动原生 UA 控件，依据当前配色方案设置 `body[data-ds-dark-theme]`，把主题的别名 token 与 `--dsh-content-font-size` 设为 body 上的内联变量，并持有一个 `<meta name="theme-color">`，其内容随计算后的 body 背景色更新。释放呈现器时，它会连同其他全局写入一起移除自己的元数据节点。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

一次 `register()` 贡献 `AppFrame`，并声明 `sidebar`、`conversation`、`shelf`、`details`、`shell.overlay` 和 `titlebar`。瞬时 store 以默认侧栏宽度与关闭的两个辅助面板启动。各栏子树保持挂载，严格会话范围的详情入口使用 `SessionProvider`。文档标题由所选 Session 标题与预启动呈现标题、构建标题或本地化回退值组合。主题呈现器独立应用解析后的 token，并从已渲染 body 获取元数据颜色。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当布局面不够用时阅读以下页面。它们从框架进入它所渲染的栏与它所呈现的主题。

- [ui-sidebar](../ui-sidebar/README.zh.md)——占据 `sidebar` 栏及其座位。
- [ui-conversation](../ui-conversation/README.zh.md)——占据 `conversation` 与 `details` 栏。
- [ui-theme](../ui-theme/README.zh.md)——呈现器消费其解析快照的主题 seam。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册槽位。

-----

<a id="model-experience"></a>
## 模型体验

无。布局外壳管理浏览器查看状态；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了当前布局行为。它们是当前包约束，不是通用窗口管理器对比或任务积压。

- **面板几何是瞬时状态**——重新加载会恢复侧栏默认值并保持详情栏关闭；在不同会话 id 之间切换同样会关闭详情栏并忘记拖动后的宽度，而未选中表面以零宽度渲染详情栏却不修改几何。
- **让步链自动关闭通过推导零宽度实现，不触碰偏好宽度**——窗口变宽时面板自行恢复；消费方不得把 store 中的详情宽度当作渲染真值。
- **挤压重排期间无滚动锚定**——布局变化可能移动读者的视口。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。`ctx.layout` 后的 viewing-state store 不发出 Cordis 事件；clamp、prune 与 concession-chain 顺序由本包测试覆盖。
