# Agent Note: Settings navigation icon contributions

Status: implemented

[English](2026-09-15-settings-navigation-icon-slot.md) | 中文

## 问题

产品插件添加的设置页面，其含义不一定能由外壳内置的图标映射表达。要求外壳识别每个下游页面 id，会让通用导航依赖产品专属页面。

## 决策

[设置 slot](../../../../packages/client/ui-settings/src/client/contract/slots.ts)提供可选的根作用域 keyed slot `settings.section.icon`。[设置外壳](../../../../packages/client/ui-settings-general/src/client/SettingsRoot.tsx)以页面 id 作为 `entryKey` 渲染图标，并传入图标尺寸。没有贡献时保留该页面的内置图标。

外壳负责装饰性图标容器，并以导航标签作为无障碍名称。产品插件通过现有 slot 生命周期注册图标组件；导航选择和页面内容不依赖图标注册。

## 考虑过的替代方案

**在外壳中硬编码产品页面 id。** 下游产品每次新增或重命名页面都需要修改通用包，因此改由产品拥有图标注册。

**在页面元数据中携带 React 节点。** slot 组合已经承载 UI 贡献。在页面元数据中加入可渲染值会引入另一套渲染机制，并混合视图元素与页面数据。

## 影响

此扩展只改变呈现，不改变设置值、agent（智能体）状态、模型可见输入或会话日志。未贡献图标的产品保留内置外观。渲染器的 keyed 分派与回退由[设置组件测试](../../../../packages/client/ui-settings-general/tests/settings-root.client.spec.tsx)覆盖。
