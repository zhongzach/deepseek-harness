# Agent Note：预启动页与持久上下文的产品展示边界

状态：已实现

[English](2026-08-25-product-presentation-boundaries.md) | 中文

## 问题

Web 客户端为了可重建性会持久化实现身份：Loader 条目 id 是包名，上下文消息的
source 会记录生产插件。包装产品不能改写这些持久身份，也不应该为了替换一个技术
来源的展示而复制整套上下文渲染器。React 插件挂载前的无框架启动页也有同样问题。

## 决定

`context` Chat Node 声明 session 作用域的 chain
`conversation.chat.context.presentation`。它把引用稳定的上下文数据作为统一 owner
currency 分发，并把 `ContextInjectionRow` 保留为全员拒绝时的 fallback。产品条目用
纯 `select` 只认领自己负责展示的来源；未被认领的上下文继续使用内置的分 form 富展示。

无框架 `BootPage` 另行接受可选的预注入 `BootPresentation` 文案。命名空间别名只在
显示失败信息时替换完整 scoped-package token。Loader id、原始异常、会话事件、上下文
source 与模型可见字节全部保持不变。

## 不变量

- 展示 selector 不修改、不重命名持久 source。
- 被拒绝的上下文逐字节走原 fallback。
- 被认领的展示不得把原始 source 放入可见文本、无障碍名称、title 或诊断属性。
- 预启动品牌配置可选；未包装的 Harness 保持原字标、加载文案与失败详情。
- 原始诊断继续保存在日志与开发者工具中。

## 验证

客户端测试覆盖全拒绝 fallback、产品接管、无障碍名称、source 不变、默认/品牌化预启动
文案，以及失败条目 id 和汇总失败报告中的命名空间脱敏。

## 结果

包装产品可以接管技术上下文和预启动文案，而不用修改回放身份或复制整套上下文渲染器。
代价是每个 context 节点多一次 chain 分发，品牌化 index 多一个很小的阻塞式展示对象；
未包装部署的可见行为不变。

## 考虑过的替代方案

| 未采用 | 原因 |
|---|---|
| 重命名持久插件 source | 会破坏 runtime-context 的归属、替换和回放语义 |
| 影子替换 keyed `context` renderer | 无法按 source 拒绝，会迫使产品复制所有 context form |
| 用 CSS 替换文字 | 无障碍文本和展开正文仍会保留私有名称 |
| 在 BootPage 硬编码某个产品 | 污染通用 Web 内核，其他包装仍要再次 fork |
