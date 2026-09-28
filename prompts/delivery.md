# Prompt 工作区重设计交付记录

核查日期：2026-09-28。继续 PR #20；开始时 main 为 316fc43a75689adbd123d7559b2c06d88f7bd404，#20 为 8421c8526e456deb0f716aa6935e6416bd669767，仍 OPEN。未回退或重置后来工作。最终提交与 CI 链接以 PR 当前 head 和交付消息为准；手册另显示每次生成时实际 SHA/dirty。

已读取 Product Design、Teacher Workspace、Runtime Architecture（均 2026-09-27 修订），尤其 Runtime §§10–12、21、附录 D。文档中的旧实现核查不是当前事实：当前代码已具教师 TRACE/工作笔记，但 ENRICH/REWORK 仍是未连接入口。指令、模型参数及权限语义只迁移，不顺带实现业务后端。

## 全部任务映射

| 稳定任务 ID / 手册锚点 | 设计与代码事实 | 当前模型入口 |
| --- | --- | --- |
| teaching-understanding | 实时 operation、stance、relationEvidence、relation follow-up 已接入 | buildSemanticRequest → inspectWithJev → compileProposal → LessonStore.accept；Jev 配置 |
| accepted-expression | 单 Cue Presentation V1 已接入，更广表达目标部分实现 | presentationInput → validatePresentationInput → buildPresentationRequest → parsePresentationResponse；OpenAI 配置 |
| multi-cue-expression | 已定义、未实现；组合不合并身份 | 无，不创建 stub |
| source-semantic-review | 后台原证据补认已定义，未启用通用写入 | 无；已有 LessonStore.accept 不等于后台业务完成 |
| retrieval-assistance | 模型辅助条件式允许，未接入；确定性 lookup 已有 | 无；命中不等于教过 |
| cue-enrich | 教师目标已确认，后端未接入 | 无；新内容须属补充参考 |
| lesson-rework | 教师目标已确认，后端未接入 | 无；原顺序与建议并存 |
| review-only | 身份重组／外部核查权限边界已定义，未实现 | 无；不自动迁移身份/引用或改原话 |
| trace-narration | 可选，未接入；基础 TRACE 为确定性投影 | 无；非必做服务 |
| legacy-selection | structured-v3 历史／工具路径仍可达 | buildJevRequest；scripts/replay.ts、/api/jev/decide |
| speech-recognition | Speechmatics 供应商能力／配置 | gateway.py + config.py；无 repo-owned 内部识别 prompt |

精确源引用、输入输出、Host 资格和接受边界在 catalog.ts；中文正反例和待定事项在 guide.zh.md 的同名锚点。手册默认不隐藏未实现项。源码文本与原始请求均安全转义，来源链接为纯文本，无远程字体/脚本。

## 验收证据

本地 Node v26.8.1；CI 使用 Node 24。完整检查已实际执行：

| 检查 | 实际结果 |
| --- | --- |
| typecheck | PASS |
| unit/contract | 29 files，384 tests PASS |
| production build | PASS |
| browser | 43 tests PASS（含离线手册实际浏览器验收） |
| Voice | 7 tests PASS |
| eval:jev:validate | PASS，validate config，无 provider 调用 |
| eval:presentation:validate | PASS，validate config，无 provider 调用 |
| test:jev-evals | 41 tests PASS（含原 extraction 快照与真实 Promptfoo loader） |
| test:prompt-workspace | 26 tests PASS（含两类冻结 evaluator/corpus、真实 loader、reader、Git 版本比较） |
| 无凭据 + 网络封锁 | env -i 启动 prompts:read 和两套 config validate 均 PASS；fetch/http/https/net/tls 拦截 |
| git diff --check | PASS |

第一次受沙箱限制的全量测试中，24 个本地 HTTP 测试因 listen EPERM 失败/超时；给予本机回环权限后完整重跑通过。它们全部使用模拟上游，不是模型故障或付费试验。Voice 保留上游 operating_point 弃用警告；未更改其依赖。

迁移证据：Jev 原有 primary/student/relation 全请求哈希快照保留。Presentation 两份 provider-visible body 快照先从 8421c852 的未修改 HTTP 模块捕获（默认 Luna / 自定义模型），再抽取共享边界并重跑；不是新 builder 和自己对比。指令、schema、动态输入、reasoning 参数、失败类别不变；原网络取消和来源/权限/版本测试继续通过。

版本比较证据：测试在临时隔离 Git 仓库建立两个真实提交，修改 APPEND_CONDITION，用同一冻结 corpus/evaluator 分别启动独立进程加载各自生产 builder。请求发生差异，代码 SHA 不同，案例/evaluator 摘要相同；同代码换标签被拒绝；不同 corpus 被拒绝。修改包含 HTML 的条件后，手册精确源和预览同时变化，HTML 不执行。仅证明比较机制，不提供质量评分。夹具合同不兼容须显式适配。

加载与失效证据：两类 provider 均经 Promptfoo 0.123.1 真实 TS loader；Jev 20 次模拟传输、2 行 Host coverage block；Presentation 12 次模拟传输、1 行 whole-Final block。额外冻结构/evaluator 加载通过，篡改 evaluator 在传输前拒绝。失败不会化为成功空输出；expected/motivation/review 未进请求。调用计数排除 blocked 行，单案例只尝试一次。

页面证据生成于 artifacts/prompt-handbook-overview.png 和 artifacts/prompt-handbook-review.png（人工夹具，忽略目录，交付消息提供可查看路径；CI browser-evidence 也上传这些截图）。生成页面在 .promptfoo/handbook/index.html，不提交 Git。

## 不作出的结论

真实 Jev / OpenAI 语义评测、付费 before/after、独立留出结果与教师人工效用审查均 NOT_RUN。Jev 22 个 authored 场景仅为开发/已知回归，exploratory 未评分；Presentation 13 场景语义均 UNSCORED。自动成功不能当模型理解或教师价值证据。

保留的差距：current-only、whole-Final 与 student reading 旧措辞；多 Cue、后台补认、检索辅助、ENRICH、REWORK、review-only、可选 TRACE 叙述无新后端。未新增语义权限、模型路由器、CMS、实验数据库或新结果面板。

依赖最小变化：esbuild 0.28.2 原本已在锁文件，现显式声明为开发依赖供离线 TS 源加载；锁文件仅根声明增加一行，无新增解析包、生产依赖或版本变化。无 key、真实课堂、数据库/cache、模型结果或手册缓存提交。没有自动合并、部署、Cloud 分享或付费调用。

使用命令与冻结版本比较步骤见 README.md；每次改动需写明受影响原则、预期改善、可能损失和权限不变项，逐例保留改好及改坏，不追求回归集总分。此次只改变可审查性与评测机制，没有声称改进语义质量。
