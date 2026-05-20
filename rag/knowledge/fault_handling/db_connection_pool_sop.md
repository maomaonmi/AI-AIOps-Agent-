# 数据库连接池耗尽处理流程 (SOP-0018)

## 现象描述
应用报错"Too many connections"或获取数据库连接超时，导致服务不可用。

## 排查步骤

### 1. 确认连接池状态
```sql
SELECT state, count(*) FROM pg_stat_activity WHERE datname='target_db' GROUP BY state;
```
- active: 活跃连接数
- idle: 空闲连接数
- waiting: 等待连接数

### 2. 临时处理
1. 重启应用释放僵死连接
2. 手动kill长时间空闲连接
3. 临时增大max_connections

### 3. 根因分析
1. 检查是否有慢查询占用连接
2. 检查是否有未提交事务
3. 检查连接池配置是否合理
4. 检查是否有连接泄漏（获取后未释放）

### 4. 永久修复
1. 增大连接池max_connections
2. 添加连接超时回收机制（idle_timeout）
3. 优化慢SQL，添加索引
4. 确保应用代码正确释放连接（try-with-resources）
5. 配置连接池监控告警

## 连接池推荐配置
- max_connections: (核心数 * 2) + 有效磁盘数
- min_idle: 与max_connections一致
- idle_timeout: 600000 (10分钟)
- max_lifetime: 1800000 (30分钟)
