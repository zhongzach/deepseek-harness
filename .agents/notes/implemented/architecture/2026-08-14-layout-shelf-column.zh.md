# Agent Note: 布局 shelf 列

Status: implemented

[English](2026-08-14-layout-shelf-column.md) | 中文

## 问题

Web 外壳框架采用三列网格：侧栏｜中间栏｜详情栏。一个产品组合（NovelStudio 桌面应用）需要在现有工具详情列旁增加一个 Codex 风格的右侧面板，用于展示小说项目书架与文件预览。占用 `details` slot 会在加载时与 ui-conversation 的 `DetailsPanel` 冲突——slot 冲突正是组合模型对这类错误的反馈，不应绕过它打补丁。因此，右侧栏必须拥有自己的布局 slot。

## 决策

`ui-layout` 在 `main` 内容与标准 `rightbar` 轨道之间提供独立的 `shelf` 列：

- **Slot**：`'shelf': { kind: 'single', scope: 'session' }`，由根注册声明，owner share 为空（sessionId 作为框架标准 prop 传入）。`ctx.layout` 暴露 `openShelf()`／`closeShelf()`／`toggleShelf()`／`resizeShelf(px)`；`layoutInfo` 保留书架宽度偏好（0 表示关闭，`SHELF_DEFAULT = 300`，拖动范围为 300–1040）。
- **退让链**：先收窄 shelf，再收窄右轨道，最后关闭右轨道，以保持中间栏宽度不小于 `CENTER_MIN`。Shelf 永不自动关闭——它是与侧栏同等对待的主要产品面板。Shelf 偏好为 0（默认值）时，计算采用标准 sidebar/main/rightbar 几何：新增轨道渲染为 0px，收起的列不绘制边框。
- **占用方式**：已交付的行均不占用 `shelf`。产品组合（例如 NovelStudio 外壳的 `--patch` overlay）会向其中插入自己的客户端插件。开发用 web-app 组合包不注册 shelf 插件，因此开发界面保持不变。

## 考虑过的替代方案

**复用 `details` slot。** 否决，因为 ui-conversation 已用 `DetailsPanel` 占用这个 single slot；让产品 shelf 与它竞争，会把必需的产品列变成加载顺序冲突。

## 后果

- 未占用的 shelf 不预留宽度：全新 `layoutInfo` 中 `shelf: 0`，`data-shelf-collapsed` 会抑制边框。
- 产品面板可以驻留在真正的右侧栏中，与工具详情并排打开，且各自拥有拖动手柄。
- 标准 rightbar 所有者控制展开与全屏呈现；独立 shelf 不在会话变更时自动关闭。
- 产品组合将自己的书架插件注册到 `shelf`；官方 Web 组合将该槽位留空。
