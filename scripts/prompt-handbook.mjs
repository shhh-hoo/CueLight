// Launched with the repository TypeScript loader (see package.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { tasks, authorities } from '../prompts/catalog.ts';
import * as instructions from '../prompts/jev-semantic/instructions.ts';
import { cases } from '../prompts/jev-semantic/evals/cases.ts';
import { constructFixture } from '../prompts/jev-semantic/evals/fixtures.ts';
import { buildSemanticRequest } from '../src/alive/inspection.ts';
import { cases as presentationCases, constructPresentationFixture } from '../prompts/presentation-v1/evals/cases.ts';
import { buildPresentationRequest, PRESENTATION_INSTRUCTIONS } from '../prompts/presentation-v1/request.ts';
import { parseRuntimeConfig } from '../server/runtime-config.ts';
import { buildJevRequest } from '../src/decision/jev-context.ts';
import { buildCandidates } from '../src/candidates/candidate-builder.ts';
import { codeIdentity } from '../prompts/evals/record.ts';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const e = escapeHTML;
const pretty = value => JSON.stringify(value, null, 2);
const detail = (title, value) => `<details><summary>${e(title)}</summary><pre>${e(typeof value === 'string' ? value : pretty(value))}</pre></details>`;
const config = parseRuntimeConfig({}); // Deliberately ignore environment secrets and overrides.
const jevPreview = c => ({ fixture: c.id, sourceKind: 'authored', status: 'preview / 未发送', request: buildSemanticRequest(constructFixture(c.fixture).input, config.jev.model) });
const primary = jevPreview(cases.find(c => c.id === 'same-object-clarification'));
const relation = jevPreview(cases.find(c => c.fixture.relationFrom));
const selected = presentationCases[0];
const presentation = { fixture: selected.id, status: 'preview / 未发送', input: constructPresentationFixture(selected).input };
presentation.request = buildPresentationRequest(presentation.input, config.refinement);
const evidence = { version: 1, fragments: [{ id: 'authored-legacy', text: '只有 Y 成立时，A 才适用。', startMs: 0, endMs: 1 }] };
const legacy = buildJevRequest({ evidence, currentCue: null, candidates: buildCandidates(evidence, null) }).body;
const guides = Object.fromEntries(read('prompts/guide.zh.md').split(/^## /m).filter(Boolean).map(part => {
  const [id, ...text] = part.trim().split('\n'); return [id, text.join('\n')];
}));
const identity = codeIdentity();
function requestDetails(title, preview) {
  const r = preview.request;
  return detail(title + ' · 完整请求（preview／未发送）', preview) + detail('静态指令', r.instructions ?? Object.fromEntries(Object.entries(r.questions).map(([k, v]) => [k, v.instructions]))) +
    detail('动态条件／候选范围', r.questions ?? 'Presentation 无动作候选；输入资格见 Host') + detail('上下文／选定内容', r.state ?? JSON.parse(r.input)) +
    detail('输出 schema／合同', r.text?.format ?? { contract: 'alive-jev-v1', parser: 'src/alive/inspection.ts:parseSemanticJudgment', choices: r.questions }) +
    detail('模型与关键配置', r.model === config.jev.model ? config.jev : config.refinement);
}
const body = tasks.map(t => {
  if (!guides[t.id]) throw new Error('Missing Chinese guide: ' + t.id);
  const source = t.refs.map(r => detail(`${r.kind} · ${r.file} · ${r.symbol}`, read(r.file))).join('');
  const preview = t.id === 'teaching-understanding' ? requestDetails('primary', primary) + requestDetails('relation follow-up', relation) + detail('静态导出：真实可执行值', instructions) + detail('人工案例／来源用途／断言', cases)
    : t.id === 'accepted-expression' ? requestDetails('Presentation', presentation) + detail('静态导出：PRESENTATION_INSTRUCTIONS', PRESENTATION_INSTRUCTIONS) + detail('人工审查案例（UNSCORED）', presentationCases)
    : t.id === 'legacy-selection' ? detail('人工夹具 authored-legacy · preview／未发送', legacy) : '<p>没有模型请求预览或伪运行入口；NOT_RUN。</p>';
  const changes = t.refs.length ? execFileSync('git', ['log', '-3', '--format=%h %s', '--', ...t.refs.map(r => r.file)], { cwd: root, encoding: 'utf8' }) : '设计纳管；尚无业务实现';
  return `<section id="${e(t.id)}"><h2>${e(t.title)}</h2><p><b>接管的判断：</b>${e(t.responsibility)}</p><dl>${Object.entries({ 设计依据: t.basis, 设计状态: t.design, 实现状态: t.implementation, 输入: t.input, 触发: t.trigger, 结果去向与权限: t.output, 已知差距: t.gaps, 确定性验证入口: t.deterministic, 评测入口: t.evaluation, 模型行为: 'NOT_RUN；未建立独立留出结果', 人工效用: 'NOT_RUN' }).map(([k,v])=>`<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl><h3>中文说明与正反理解案例（不发送给模型）</h3>${guides[t.id].split('\n').map(p=>`<p>${e(p)}</p>`).join('')}${preview}<h3>可核对源代码（Host 规则与模型指令分列）</h3>${source}${detail('最近已提交变化；未提交修改见构建标记',changes)}<p><a href="#overview">返回总览</a></p></section>`;
}).join('');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>CueLight · 模型任务与 Prompt 阅读手册</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:1100px;margin:auto;padding:30px;color:#172927;background:#fafbf9}h1,h2{line-height:1.3}h2{border-top:2px solid #8aaba1;padding-top:24px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid #cdd9d4;text-align:left;padding:10px}a{color:#146b59}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,monospace;background:#edf2ee;padding:16px}details{border:1px solid #d4dfd7;margin:8px 0;padding:9px}summary{cursor:pointer}dt{font-weight:650;float:left;clear:left;width:160px}dd{margin-left:175px}section{scroll-margin-top:20px}.notice{padding:18px;background:#e5efe9}small{color:#53665e}</style><h1>CueLight 模型任务与 Prompt 阅读手册</h1><p>先看系统交给模型什么工作，再核对真实指令和评测证据。</p><div class="notice">本页仅为离线阅读。所有请求均为人工夹具生成的预览／未发送。设计确认、代码可运行、语义有效是三种独立证据。基础 TRACE、权限、ID、事务、持久化和版本校验是确定性代码。</div><p><small>构建时间 ${e(new Date().toISOString())} · SHA ${e(identity.gitSha)} · dirty=${identity.dirty} · 重新运行 npm run prompts:read 更新，不宣称永久最新。</small></p><h2 id="overview">完整任务总览</h2><p>默认包含全部已确认、条件式与可选职责；尚未实现的任务没有伪 provider 或绿色结果。</p><table><thead><tr><th>职责</th><th>设计依据状态</th><th>实现状态</th><th>本轮模型／人工验证</th></tr></thead><tbody>${tasks.map(t=>`<tr><td><a href="#${e(t.id)}">${e(t.title)}</a></td><td>${e(t.design)}</td><td>${e(t.implementation)}</td><td>NOT_RUN / NOT_RUN</td></tr>`).join('')}</tbody></table>${detail('设计权威与核查日期（URL 为纯文本）',authorities)}<h2>审查与版本比较</h2><p>迁移一致性证明请求未变；确定性测试证明机制合同；真实模型行为和人工效用须另行验证。现有案例为 authored development/regression，没有留出结果。来源、期待、motivation 与批注不进入模型请求。</p><p>Promptfoo 的成功标记可能仅代表运输或断言通过。Presentation 全部语义 UNSCORED，Jev exploratory 无语义断言。先导出自动结果，再做 UI 评论／人工改分。按整次讲述、主题或案例家族划分独立检验；用于调 prompt 的留出案例必须转入开发集。</p>${detail('准确命令与真实 Git 版本比较步骤', read('prompts/README.md'))}${detail('本轮验收记录（与当前构建 SHA 分开核对）', read('prompts/delivery.md'))}${body}</html>`;
const directory = fileURLToPath(new URL('.promptfoo/handbook/', root));
mkdirSync(directory, { recursive: true });
const path = directory + 'index.html';
writeFileSync(path, html);
console.log(path);
if (!process.argv.includes('--no-open') && !process.env.CI && (process.platform === 'darwin' || process.env.DISPLAY || process.env.WAYLAND_DISPLAY)) {
  spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [path], { stdio: 'ignore' });
}
