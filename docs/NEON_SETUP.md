# Neon 设置指南

这份说明用于把 StockRadar AI 的个人数据保存到现有 Neon PostgreSQL 数据库。请不要把真实连接字符串发给别人，也不要提交 `.env.local`。

## 1. 登录 Neon

1. 打开 Neon 控制台。
2. 使用你的账号登录。
3. 进入当前 StockRadar AI 正在使用的项目。

## 2. 找到原来的项目

如果你有多个 Neon 项目，请选择 Vercel 当前连接的那个项目。项目名不重要，关键是它的数据库连接字符串要和 Vercel 里的 `DATABASE_URL` 一致。

## 3. 复制 DATABASE_URL

1. 进入项目后打开 Connection Details。
2. 选择 Node.js 或 Prisma 连接方式。
3. 复制连接字符串。
4. 本项目沿用变量名 `DATABASE_URL`。

不要新增 `NEXT_PUBLIC_DATABASE_URL`，数据库连接只能在服务端使用。

## 4. 配置本地 `.env.local`

在项目根目录创建或更新 `.env.local`：

```text
DATABASE_URL="你的 Neon PostgreSQL 连接字符串"
FMP_API_KEY="你的 FMP Key，可选"
STOCKRADAR_ACCESS_KEY="你自己的访问密码"
```

## 5. 配置 Vercel 环境变量

在 Vercel 项目中打开 Settings -> Environment Variables，添加或确认：

- `DATABASE_URL`
- `FMP_API_KEY`
- `STOCKRADAR_ACCESS_KEY`

保存后重新部署。

## 6. 配置 STOCKRADAR_ACCESS_KEY

`STOCKRADAR_ACCESS_KEY` 是单用户访问密码。用户在设置页输入这个密码后，服务器会写入 HttpOnly Cookie 解锁个人数据。

建议使用较长、难猜的密码。不要把它放进 localStorage，不要发给其他人。

## 7. 执行数据库迁移

本项目使用 Prisma。部署前需要执行迁移：

```text
npx prisma migrate deploy
```

如果你在本地开发，也可以使用：

```text
npm run prisma:migrate
```

## 8. 检查表是否创建成功

迁移后，在 Neon 控制台检查是否有这些表：

- `Holding`
- `Watchlist`
- `UserSettings`
- `AlertRule`
- `AlertEvent`
- `DailyReport`
- `MarketDataCache`
- `EventCache`

已有的 `PortfolioAccount`、`User` 等表会继续复用。

## 9. 备份数据库

简单方式：

1. 在 Neon 控制台打开数据库。
2. 使用备份或导出功能。
3. 重点备份持仓、自选股、设置和预警相关表。

## 10. 验证持仓是否写入成功

1. 打开线上网站的设置页。
2. 输入访问密码并解锁。
3. 进入持仓页，新增一条测试持仓，例如 TSLA。
4. 刷新页面，确认持仓仍然存在。
5. 在 Neon 控制台查看 `Holding` 表，确认出现对应记录。
