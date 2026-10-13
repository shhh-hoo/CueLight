# PR #20 依赖审计复核

核查日期：2026-10-13。审计描述已锁定的开发工具依赖，不声称模型质量或生产运行能力。

## 已修复

- Promptfoo 从 0.123.1 更新并精确锁定为 0.124.1。其依赖更新包含 simple-git 4.0.2、@simple-git/argv-parser 2.0.1、MCP SDK 1.32.1、sharp 0.35.5；移除原 Critical 告警及相应已修复告警。
- `get-uri` 仍要求 basic-ftp 5.x，因此仅对这条子依赖使用 `package.json` override，锁定修复版本 6.2.3。该 major override 须随 get-uri 升级重新核对；不能把整个依赖树静默改回有漏洞的 5.x。CueLight 不使用 FTP/PAC 输入；另用模拟 Client 检查 get-uri 的 FTP 接口兼容，不访问网络。
- source-map-js 在父依赖允许范围内更新为 1.2.2，修复开发构建链的 source-map 告警。
- 未升级应用的 React、Vite、Speechmatics、TypeScript 或模型配置；锁文件其余变化来自 Promptfoo 依赖树更新。

## 尚无上游修复的告警

`npm audit` 仍报告 **3 个 High 包记录**：node-forge、jks-js、promptfoo。它们来自同一个根本告警
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)：node-forge <=1.4.0 的 RSA PKCS#1 v1.5 签名验证问题。核查时 npm 最新 node-forge 仍为 1.4.0，公告的 patched versions 为 None；不能声明 audit 清零。

实际路径为 `promptfoo@0.124.1 → optional jks-js@1.1.7 → node-forge@1.4.0`。Promptfoo 将 jks-js 用于配置了 JKS/PFX 证书的通用 HTTP provider，动态加载该包。CueLight 两套 YAML 和冻结配置只加载本仓库自定义 provider；Jev/OpenAI 传输由仓库代码完成，不配置 JKS/PFX、通用 HTTP provider 或签名验证。浏览器应用不导入 Promptfoo；`npm audit --omit=dev` 单独核对生产依赖。

这是已检查使用路径下的暂存风险，**不是漏洞修复，也不是任意 Promptfoo 功能安全的保证**。不要在 CueLight 评测中启用 JKS/PFX 证书导入或任意通用 HTTP provider。若扩展这些能力，须重新检查可达性。上游发布修复后更新锁文件、移除此暂存记录并重跑加载器与完整检查；不能通过删除 audit 输出、广泛忽略 High、替换为空包或盲目降级 Promptfoo 来宣称解决。

## 复核

```sh
npm ci
npm ls simple-git @simple-git/argv-parser @modelcontextprotocol/sdk sharp basic-ftp source-map-js node-forge --all
npm audit --json
npm audit --omit=dev
npm run eval:jev:validate
npm run eval:presentation:validate
npm run check
npm run test:voice
```

完整审计因上述剩余告警仍退出 1；生产依赖审计应退出 0。每次安装或升级重新审计，告警种类和数量不能沿用本记录。原生 Promptfoo loader、冻结 evaluator/corpus 和离线手册验收属于完整单测；不以依赖版本号替代兼容性测试。没有付费供应商调用。
