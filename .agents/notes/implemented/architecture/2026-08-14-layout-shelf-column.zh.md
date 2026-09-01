# Agent Note: 布局 shelf 列

Status: implemented

[English](2026-08-14-layout-shelf-column.md) | 中文

## 问题

Web 外壳框架采用三列网格：侧栏｜中间栏｜详情栏。一个产品组合（NovelStudio 桌面应用）需要在现有工具详情列旁增加一个 Codex 风格的右侧面板，用于展示小说项目书架与文件预览。占用 `details` slot 会在加载时与 ui-conversation 的 `DetailsPanel` 冲突——slot 冲突正是组合模型对这类错误的反馈，不应绕过它打补丁。因此，右侧栏必须拥有自己的布局 slot。

## 决策

`ui-layout` 在中间栏与详情栏之间增加第四列 `shelf`：

- **Slot**：`'shelf': { kind: 'single', scope: 'session' }`，由声明其它三列的同一个根 `register()` 调用声明，owner share 为空（sessionId 作为框架标准 prop 传入）。`ctx.layout` 增加 `openShelf()`／`closeShelf()`；布局存储增加 `shelf` 宽度偏好（0 表示关闭，`SHELF_DEFAULT = 400`，拖动范围为 300–560）。
- **退让链**：先收窄 shelf，再收窄详情栏，最后自动关闭详情栏，以保持中间栏宽度不小于 `CENTER_MIN`。Shelf 永不自动关闭——它是与侧栏同等对待的主要产品面板。Shelf 偏好为 0（开发环境默认值）时，退让链完全退化为原有三列行为，因此开发 GUI 逐字节不变：新增轨道渲染为 0px，收起的列不绘制边框。
- **占用方式**：已交付的行均不占用 `shelf`。产品组合（例如 NovelStudio 外壳的 `--patch` overlay）会向其中插入自己的客户端插件。开发用 web-app 组合包不注册 shelf 插件，因此开发界面保持不变。

## 考虑过的替代方案

**复用 `details` slot。** 否决，因为 ui-conversation 已用 `DetailsPanel` 占用这个 single slot；让产品 shelf 与它竞争，会把必需的产品列变成加载顺序冲突。

## 后果

- 开发 GUI 在视觉上保持不变：全新存储状态下 `shelf: 0`，第四条网格轨道为 0px，`data-shelf-collapsed` 会抑制边框。
- 产品面板可以驻留在真正的右侧栏中，与工具详情并排打开，且各自拥有拖动手柄。
- 详情栏行为（会话变更时自动关闭、拖动语义、退让规则）保持不变；shelf 刻意不在会话变更时自动关闭。
- Shelf 插件包（`@deepseek-ai/dsh-client-ui-novel-shelf`）是后续工作；它通过 `slots.inject` 注册到 `shelf`，且只随产品组合交付。
