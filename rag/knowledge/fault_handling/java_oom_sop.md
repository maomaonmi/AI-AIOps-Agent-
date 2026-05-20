# Java OOM 处理流程 (SOP-0042)

## 现象描述
Java应用出现OutOfMemoryError，导致服务不可用或响应缓慢。

## 排查步骤

### 1. 确认OOM类型
- **Java heap space**: 堆内存不足，对象过多
- **Metaspace**: 元空间不足，类加载过多
- **GC overhead limit exceeded**: GC花费过多时间但回收很少
- **Direct buffer memory**: 堆外内存不足

### 2. 临时处理
1. 重启应用释放内存
2. 如有heap dump文件，保留用于分析
3. 检查JVM参数配置

### 3. 根因分析
1. 使用jmap或MAT分析heap dump
2. 查找大对象和内存泄漏点
3. 检查是否有缓存未释放
4. 检查线程池和连接池配置

### 4. 永久修复
1. 调整JVM堆内存参数 -Xmx（建议增加50%）
2. 修复内存泄漏代码
3. 优化缓存策略，添加过期和淘汰机制
4. 设置 -XX:+HeapDumpOnOutOfMemoryError 自动dump

## 注意事项
- 重启前务必保留heap dump
- 不要盲目增大内存，先确认是否有泄漏
- 关注GC日志判断是否为GC频繁导致
