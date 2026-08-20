# AutoProf LabOS — Agent Engineering Notes

## PowerShell 转义陷阱 (Windows)

**问题**: 在 PowerShell 中使用 `node -e` 传递含引号/反引号的字符串时,PowerShell 会篡改引号,导致 SyntaxError 或无限循环。

**根因**: PowerShell 的引号处理与 bash/cmd 完全不同。单引号内的 `$` 和双引号内的转义行为不一致。

**规则**:
1. **永远不要**在 PowerShell 中用 `node -e` 传递含模板字面量(反引号)的代码
2. 写 `.mjs` 脚本文件再用 `node script.mjs` 执行,不要用 `-e` 内联
3. 简单字符串替换用 `apply_patch` 工具,不用 PowerShell `-replace`
4. 如果必须用 PowerShell,用 `@'...'@` here-string(不解释任何字符)
5. `Set-Content` / `Out-File -Append` + here-string 是最安全的文件写入方式

**已确认的失败模式**:
- `node -e "...`...`"` → 反引号被 PowerShell 吞掉 → SyntaxError: Invalid or unexpected token
- `powershell -Command "(... -replace 'old', 'new')"` → 引号嵌套爆炸 → ParserError
- `apply_patch` 路径前缀重复(如 `cordis-main/public/js/api.js` → 实际变成 `cordis-main/cordis-main/public/js/api.js`)→ 用不带前缀的相对路径

**可靠替代方案**:
```powershell
# 写脚本文件
@'
import { readFileSync, writeFileSync } from 'fs';
// ... 代码 ...
'@ | Set-Content -Path script.mjs -Encoding utf8
node script.mjs
Remove-Item script.mjs
```

## 版本发布纪律

- 每次 feature 完成后 bump VERSION (在项目根目录 `D:\OneDrive\7-SideWork\AutoProf\VERSION`)
- 同时更新 `public/js/api.js` 的 `APP_VERSION`
- 同时更新所有 HTML 文件的 `?v=XXX` cache-bust 字符串
- DEVLOG.md **只追加**, 不覆盖, 不删除历史
- git commit message 格式: `feat: vX.Y.Z 简述` 或 `fix: 简述`

## 额外教训 (2026-08-20 追加)

- **版本不匹配 = 无限重载 = 全部空白页**: api.js 的 checkVersion() 在 server 版本 ≠ client 版本时调用 window.location.reload()，如果没有 localStorage 防护，会无限循环导致 Vue 永远无法 mount。**每次改 APP_VERSION 必须同步改 VERSION 文件**，否则所有页面空白。
- **server.js import 风格**: 用 `import { readFileSync, existsSync } from 'fs'` 时，代码中**不能**用 `fs.readFileSync` / `fs.existsSync`。要么用命名函数，要么加 `import fs from 'fs'`。
- **`/api/agents/custom` 500 错误**: 上述 import 风格问题导致。修复：所有 `fs.` → 命名导入函数。
