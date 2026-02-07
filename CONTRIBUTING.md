# 贡献指南（Contributing）

感谢你愿意帮助改进《仙途》。

## 开始之前

- 请先在 Issues 搜索是否已有相同问题/需求。
- 如果是较大的改动，建议先开 Issue 讨论方案，再提交 PR。

## 本地开发（前端）

- 环境：Node.js >= 18，npm >= 9
- 安装依赖：`npm install`
- 开发启动：`npm run serve`
- 构建：`npm run build`
- 类型检查：`npm run type-check`
- 代码检查：`npm run lint`（会自动修复）/ `npm run lint:check`（只检查）

## 本地开发（后端，可选）

后端用于提供账号/存档等 API，默认可用 SQLite 开箱即用。

- 复制环境变量示例：把 `server/.env.example` 复制为 `server/.env`
- 安装依赖：`python -m pip install -r server/requirements.txt`
- 启动：`uvicorn server.main:app --reload --port 12345`

## 提交规范

- 尽量保持改动聚焦：一个 PR 解决一个问题。
- PR 描述里写清楚：动机、改了什么、如何验证。

### 中文提交信息避免乱码（Windows / PowerShell）

在 Windows 下用 PowerShell 执行 `git commit -m "中文"` 时，提交信息容易因编码变成乱码。**请始终采用「从文件读取提交信息」的方式**：

1. 将提交信息写入一个 **UTF-8 编码** 的文本文件（例如 `commit_msg.txt`），内容为单行或多行均可。
2. 使用以下命令提交，不要用 `-m "..."` 直接写中文：
   - 新提交：`git commit -F commit_msg.txt`
   - 修改上一次提交：`git commit --amend -F commit_msg.txt`
3. 提交完成后可删除临时文件（如 `commit_msg.txt`）。

这样 Git 会按文件编码正确保存中文，避免乱码。
