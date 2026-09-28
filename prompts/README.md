# CueLight 模型任务与 Prompt 工作区

一个入口审查全部模型职责、中文理由、当前精确指令与具名人工请求预览：

```sh
npm ci
npm run prompts:read
# 无 GUI 或不自动打开浏览器
npm run prompts:read -- --no-open
```

页面输出到本仓库 `.promptfoo/handbook/index.html`（命令打印绝对路径）。无需 key、网络、评测结果或运行 CueLight；不读取 dotenv。页面生成时间、SHA 和 dirty 状态只描述本次构建。

`catalog.ts` 是开发期索引，`guide.zh.md` 是按任务锚点组织的中文解释；运行期不导入它们。精确措辞只在可执行源中维护。页面读取这些源及真实 builder；说明和案例期待绝不作为新的 few-shot 发送。导航覆盖实时理解、表达、多 Cue、后台补认、检索辅助、ENRICH、REWORK、review-only、可选 TRACE 叙述、历史 structured-v3 和 Speechmatics 配置。

新增模型调用时登记任务、设计来源、调用位置、builder、schema/parser、Host 接受规则、人工预览与验证入口；别把清单变成权限或模型路由来源。未实现职责不建空 provider。历史详细 Jev README/contract/decisions 保留。

## 已可用命令

原有 `eval:jev:*` 命令保留。下列 Presentation、阅读、冻结及比较命令为本轮新增实现：

```sh
npm run eval:jev:validate
npm run eval:presentation:validate
npm run test:jev-evals
npm run test:prompt-workspace
npm run prompts:read -- --no-open
npm run eval:view
# 原有别名仍可用
npm run eval:jev:view
```

validate 只运行 `promptfoo validate config`，绝不运行会调用 provider 的 `validate target`。Promptfoo 锁定 0.123.1；原生 UI 用于输入／输出、实际 prompt、筛选、对照与人工评论。没有另建结果面板。阅读默认全职责，NOT_RUN 与 UNSCORED 均不能解释为语义通过。

## 仅获准付费后运行

本 PR 没有运行以下命令。需分别提供 TYPESAFE_API_KEY / OPENAI_API_KEY，可显式 `--env-file .env.local`。默认最多 Jev 20 次、Presentation 12 次；阻止行不调用，单 case 只允许一次，无重试、缓存、自动 judge 或优化。CI 拒绝 live；遥测、远程生成、分享关闭。

```sh
npm run eval:jev -- --output .promptfoo/jev-auto.json
npm run eval:presentation -- --output .promptfoo/presentation-auto.json
# 可选显式 dotenv
npm run eval:presentation -- --env-file .env.local --output .promptfoo/presentation-auto.json
```

导出原自动结果后再在原生 UI 批注或改分。Presentation 13 个人工场景覆盖忠实性边界，其中 whole-Final 阻止 1 行，12 行可到达模型调用层；全为语义 UNSCORED，parser 成功不代表忠实或有用。source fallback 安全性与实际改进效用分开。Jev 的 22 个 authored 场景不是实际成功记录，21 行有原断言、1 行 exploratory 不评分；权限候选过滤是 Host 保障。

## 真正的版本比较（先离线）

provider 从 caseId 调用各版本生产 builder；YAML 放两份文字不会比较两版指令。使用两个明确 Git ref 的独立 checkout，各用自己的代码，共享一次冻结的案例与 evaluator。两个 ref 都须包含当前比较接口；旧 ref 缺少接口会明确失败，不能改名冒充兼容。要比较早于接口引入的版本，应在专门分支移植**仅评测工具**并记录适配提交，不能复制新生产 builder 到旧版本。

在要冻结案例的版本中运行：

```sh
npm run eval:freeze -- jev .promptfoo/frozen/jev
npm run eval:freeze -- presentation .promptfoo/frozen/presentation
```

记下输出的绝对 corpus.json 路径。将 BASE_REF / CANDIDATE_REF 换成实际 SHA，先核对两个 checkout 干净（可以用已有独立 checkout；Codex 中优先托管 worktree）：

```sh
git worktree add ../cuelight-before BASE_REF
git worktree add ../cuelight-after CANDIDATE_REF
# 在本仓库执行；CORPUS_JSON 是同一个绝对路径
npm run eval:preview -- ../cuelight-before CORPUS_JSON .promptfoo/before.json
npm run eval:preview -- ../cuelight-after CORPUS_JSON .promptfoo/after.json
npm run eval:compare -- .promptfoo/before.json .promptfoo/after.json
```

preview 在隔离 Node 进程读取指定 checkout 的真实 builder，完整保存请求（不删语义字段）、SHA/dirty、同一案例/evaluator 摘要与配置；无网络模型调用。同代码只换标签会阻止；案例、evaluator、配置不兼容也阻止。改变夹具解释/结构必须升级 fixtureContract；跨合同先显式记录适配，不能忽略字段后声称同条件。候选策略、schema 或 fixture 构造改变时按**系统版本**比较，检查完整请求差异后才可讨论哪些由措辞导致。不把哈希差异当质量进步。确定性 ID 与时钟来自现有人工 LessonStore 夹具。

付费前另外确认模型、两次各自上限、重复次数与预算。批准后在两个 checkout 分别 npm ci 并运行（共享同一冻结目录，绝对路径）：

```sh
npm run eval:jev -- --corpus CORPUS_JSON --description BEFORE_SHA --output .promptfoo/before-auto.json
# 在另一个 checkout 对应运行 AFTER_SHA
npm run eval:jev -- --corpus CORPUS_JSON --description AFTER_SHA --output .promptfoo/after-auto.json
# Presentation 同理，将 eval:jev 换成 eval:presentation
```

冻结模式的保守调用上限为案例总数（Jev 22 / Presentation 13），实际阻止行不调用。结果记录完整 prompt、任务、代码、源/schema 身份、案例/evaluator 摘要、模型请求与供应商返回标识、关键配置、sent/blocked、调用/缓存/失败状态。只复制 case ID 的输入文本不代表实际请求；以 ProviderResponse.prompt 和 metadata 为准。

使用同一个 Promptfoo 本地库比较两次结果：在一个 checkout 下通过锁定版本 CLI 的 `import` 导入两个自动 JSON，再运行原生 viewer；命令如下（路径替换为两个实际导出文件）：

```sh
PROMPTFOO_CONFIG_DIR="$PWD/.promptfoo" PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE=1 node node_modules/promptfoo/dist/src/entrypoint.js import BEFORE_AUTO_JSON
PROMPTFOO_CONFIG_DIR="$PWD/.promptfoo" PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE=1 node node_modules/promptfoo/dist/src/entrypoint.js import AFTER_AUTO_JSON
npm run eval:view
```

先保留原自动导出再做人工评分；评论与自动断言分开。按整次讲述／主题／案例家族建立独立检验，不能把近义改写随机分到 development 和 holdout。当前**尚未建立独立留出结果**。用于逐条调 prompt 的留出案例必须标记为 development。每次变更记录原则、预期改善、潜在损失、权限不变项，并逐例报告改好与改坏，不能只报总分。

## 证据的四层

迁移前后同请求只证明迁移一致；确定性机制证明来源/权限/版本/失败合同；真实冻结模型输出证明这些案例上的行为；人工效用审查判断教师是否认可价值。四层不能互代。测试结果与本轮完整验收见 `delivery.md`；没有真实语义或教师效用结果时写 NOT_RUN。

私有会话、key、Promptfoo DB/cache/结果与手册缓存不进 Git。默认案例均人工编写，不导入真实讲授。没有新增业务后端、公共服务、自动合并或部署。
