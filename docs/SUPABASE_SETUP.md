# Supabase 设置指南

这份说明用于把 StockRadar AI 的持仓、自选股、设置、预警、报告和缓存保存到 Supabase。请不要把真实密钥发给别人，也不要提交 `.env.local`。

## 1. 创建 Supabase 项目

1. 打开 Supabase 官网并登录。
2. 点击 New project。
3. 选择组织，填写项目名称，例如 `stockradar-ai`。
4. 设置数据库密码并妥善保存。
5. 等待项目创建完成。

## 2. 获取 URL 和密钥

1. 进入项目后台。
2. 打开 Project Settings。
3. 打开 API。
4. 复制 Project URL，填入 `NEXT_PUBLIC_SUPABASE_URL`。
5. 复制 anon public key，填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
6. 复制 service_role key，填入 `SUPABASE_SERVICE_ROLE_KEY`。

注意：`SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量里，不能加 `NEXT_PUBLIC_`。

## 3. 执行数据库迁移

1. 打开 Supabase 后台的 SQL Editor。
2. 新建 Query。
3. 打开项目文件 `supabase/migrations/001_initial_schema.sql`。
4. 复制完整 SQL 到 SQL Editor。
5. 点击 Run。
6. 执行成功后，左侧 Table Editor 应能看到 `profiles`、`holdings`、`watchlist`、`user_settings`、`alert_rules`、`alert_events`、`daily_reports`、`market_data_cache`、`event_cache`。

## 4. 配置 Magic Link 登录

1. 打开 Authentication。
2. 打开 Providers。
3. 确认 Email 已启用。
4. 确认 Magic Link 登录可用。
5. 如需更改邮件模板，可在 Email Templates 中调整。

## 5. 设置 Site URL

1. 打开 Authentication。
2. 打开 URL Configuration。
3. 本地开发时，Site URL 可填 `http://localhost:3000`。
4. 线上部署后，Site URL 改为你的 Vercel 域名，例如 `https://stockradar-ai-tawny.vercel.app`。

## 6. 设置 Redirect URL

在 Redirect URLs 中加入：

```text
http://localhost:3000/login
https://stockradar-ai-tawny.vercel.app/login
```

如果你使用了其他正式域名，也把对应的 `/login` 地址加进去。

## 7. 配置本地环境变量

在项目根目录创建 `.env.local`，内容参考：

```text
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon key
SUPABASE_SERVICE_ROLE_KEY=你的service role key
STOCKRADAR_OWNER_EMAIL=允许登录的邮箱
```

`.env.local` 不要提交到 Git。

## 8. 配置 Vercel 环境变量

1. 打开 Vercel 项目。
2. 打开 Settings。
3. 打开 Environment Variables。
4. 添加以下变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STOCKRADAR_OWNER_EMAIL`
5. 保存后重新部署。

## 9. 设置授权邮箱

`STOCKRADAR_OWNER_EMAIL` 必须填写你允许访问系统的邮箱。其他邮箱即使能收到 Supabase 登录链接，也不能读取个人数据。

## 10. 验证 RLS

1. 打开 Supabase 的 Table Editor。
2. 检查所有表都显示 RLS 已启用。
3. 对包含 `user_id` 的表，确认策略只允许 `auth.uid() = user_id`。
4. 对 `market_data_cache` 和 `event_cache`，确认没有开放匿名写入。

## 11. 备份和恢复数据

备份方式：

1. 打开 Table Editor。
2. 选择需要备份的表。
3. 使用 Export 导出 CSV。

恢复方式：

1. 在 Table Editor 中选择对应表。
2. 使用 Import 导入备份文件。
3. 导入后检查 `user_id` 是否对应你的登录用户。

## 12. 检查数据库表

常用检查：

1. `holdings` 是否有持仓。
2. `watchlist` 是否有自选股。
3. `user_settings` 是否有一条当前用户设置。
4. `alert_events` 是否记录预警历史。
5. `market_data_cache` 是否出现行情缓存。
6. `event_cache` 是否出现公司事件缓存。

如果页面提示“云端暂时不可用”，优先检查环境变量、migration 是否执行、service role key 是否填写正确。
