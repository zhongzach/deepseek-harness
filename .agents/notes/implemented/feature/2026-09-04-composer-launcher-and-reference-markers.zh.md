# Agent Note: Composer launcher 与引用 marker

Status: implemented

[English](2026-09-04-composer-launcher-and-reference-markers.md) | 中文

## Problem

产品需要通过自己的 composer launcher 呈现技能与文件，同时不 fork 对话输入状态机。默认命令 source、键入命令裁决、引用序列化、textarea selection 与焦点行为属于同一条流水线，因此通过注销 source 隐藏菜单行，也会移除直接提交仍需使用的行为。产品 popover 若自行修改 textarea，则会绕过状态机的 draft revision 检查、结构化 occurrence、撤销事务与光标恢复。

产品还需要区分引用的呈现方式，并提供本地化输入指引。这些选择需要留在各自的 Cordis 包和 bundle 配置中，同时由输入框继续负责焦点、编辑与提交。

## Decision

默认触发词表保持 `/` 与 `@`。替代的 Cordis 提供方通过现有控制器接口实现来源路由。`ui-input-trigger/client/controller` 构建入口导出同一份控制器实现，不包含插件主体。每个消费方拥有自己的控制器实例，因此只有该精确入口允许内联；其快照 store runtime 继续共享。构建后的替代提供方不需要为了导入类而激活默认提供方。默认控制器、来源注册表与文件引用服务各自的行为保持不变。

`ReferenceInsert` 带有可选的显示 `marker` 与 `skill` appearance。省略 marker 时渲染既有的 `@` 投影。输入状态机仍负责插入并存储 occurrence。marker 不改变来源触发符、codec 或模型文本；呈现支持 `#` 文件引用，同时保留旧有 `@` 文件与会话引用。

Host 对话插件接受可选的 `inputPlaceholder` 和 `heroPlaceholder` 字典，分别明确提供中文与英文字符串。这些字段进入已有的对话 settings base；用户设置可以覆盖，已挂载的输入框跟随设置和语言变化。工作区、会话阻塞、计划和队列插话消息保留各自的优先级。这些字段不增加模型输入。

对话 composer 声明 session-maybe 单实例 slot `conversation.input.launcher`。其 `ComposerLauncherOwnerProps` 提供 `locked`、`openSource(source, trigger)` 与 `insertReference(reference)`。InputBar 捕获 textarea 的实时 selection，把 span 构造连同当前 draft revision 交给会话输入接线层，并恢复 textarea 焦点与 selection，或恢复插入后的光标。没有 occupant 时，既有加号按钮与仅含命令的菜单作为 slot fallback。

## Alternatives considered

**每个产品 fork InputBar。** fork 可以绘制任意 launcher，但会复制 IME 处理、selection 恢复、附件准入、无障碍行为，以及后续每一项 composer 修复。

**注销产品不展示的命令 source。** 注册同时拥有发现与执行。移除 source 也会移除 Enter 与空格裁决、codec、lexicon 和预热。

**让 launcher 直接写入 draft 文本。** 直接写入无法原子化地创建引用 occurrence 或应用菜单时的 draft revision，并会使指针与键盘选择后的焦点和光标行为分叉。

**只为控制器而导入默认浏览器插件。** 模块图会将每个模块行激活为 Cordis 插件。该行与替代提供方同时装载会重复注册同一个服务。独立构建入口避免增加仅模块装载规则，也避免把控制器源码复制到产品中。

**在默认提供方中加入产品 marker 路由与菜单策略。** 产品提供方可以适配检测视图并保留官方来源接口。共享代码只需要它负责的呈现元数据与 launcher 动作。

**覆盖其他插件的 locale 命名空间。** 每个命名空间和语言的词典注册只有一个所有者。两个配置字段可以提供产品文案，同时不改变词典所有权，也不替换整个输入框。

## Consequences

产品可以替换一个 launcher seat，装配自己的触发器提供方并配置输入指引，同时保留共享输入状态机。共享默认值不预设产品专属的 marker 策略。模型可见的引用指引属于消费产品的提示插件，不属于默认文件引用提供方。

保留的扩展是一项独立控制器构建入口、一个 launcher slot、引用显示元数据和两个本地化文案字段。编译替代提供方前需要匹配的 Harness 构建产物。包测试和组合测试覆盖产物完整性、焦点与选择区、草稿版本校验插入、标记呈现、文案配置、语言更新与指引优先级。
