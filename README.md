# StockRadar AI MVP

AI 股票雷达 / StockRadar AI 是一个股票研究、提醒和回测验证的 MVP。第一轮只包含项目框架、mock data 和 6 个页面，不接真实行情，也不提供投资建议。

## 技术栈

- Next.js + TypeScript + Tailwind CSS
- Prisma + SQLite 本地开发，后续可替换为 PostgreSQL
- Recharts 预留给后续图表
- Mock 数据集中在 `lib/mock-data.ts`

## Web 与移动端策略

- 第一版只开发响应式 Web 应用，不做原生 iOS / Android App。
- 电脑端完整展示 Dashboard、持仓、雷达、日历、详情和回测信息。
- 手机端通过 Tailwind 响应式布局自动适配，表格保留横向滚动，避免压缩关键金融数据。
- 已预留 PWA manifest、移动浏览器主题色和推送能力检测模块，后续可接入安装到桌面、离线缓存和移动端推送。

## 页面

- `/` Dashboard 首页
- `/holdings` 我的持仓，支持添加和编辑一条持仓
- `/stocks/AMZN` 股票详情页，其他示例股票同理
- `/radar` 选股雷达
- `/calendar` 事件日历
- `/backtest` 回测实验室

## 本地运行

请先确认本机已经安装 Node.js 和 npm。当前项目没有提交 `node_modules`，需要第一次运行时安装依赖。

```bash
npm install
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

打开 `http://localhost:3000`。

如果是全新环境，也可以先复制环境变量模板：

```bash
cp .env.example .env
```

默认使用 SQLite：

```bash
DATABASE_URL="file:./dev.db"
```

## 后续接真实 API

1. 将 `lib/mock-data.ts` 替换为服务端数据读取层。
2. 在 Prisma 中把 SQLite `datasource` 切到 PostgreSQL。
3. 把 `lib/scoring.ts` 的规则评分替换成真实财务、估值、技术面和事件数据。
4. 把 `lib/alerts.ts` 接入定时任务或后台队列。
5. 把每日 AI 简报接入 OpenAI API，并保留当前 briefing 数据结构。

## 免责声明

本产品仅用于股票研究、数据分析和投资教育，不构成投资建议、财务建议或证券买卖推荐。所有评分、信号、回测和 AI 总结仅供参考。历史表现不代表未来收益。投资有风险，用户需自行判断并承担投资结果。
