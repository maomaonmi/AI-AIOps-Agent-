import time
import sys
sys.path.insert(0, '.')

from api.app import get_llm, agent
from config.settings import LLM_MODE, AGENT_MAX_ITERATIONS

print(f'=== Agent 性能诊断 ===')
print(f'模式: {LLM_MODE}')
print(f'最大迭代次数: {AGENT_MAX_ITERATIONS}')
print(f'Agent 状态: {"已初始化" if agent else "未初始化"}')

if not agent:
    print('❌ Agent 未初始化！需要先启动后端服务')
    sys.exit(1)

question = "查看CPU使用率"
print(f'\n测试问题: {question}')
print('-' * 50)

start = time.time()
result = agent.run(question)
total_time = time.time() - start

print(f'\n=== 执行结果 ===')
print(f'总耗时: {total_time:.2f}秒')
print(f'成功: {result.get("success")}')
print(f'错误: {result.get("error")}')
print(f'迭代步骤数: {len(result.get("intermediate_steps", []))}')

if result.get('intermediate_steps'):
    print('\n--- 详细步骤 ---')
    for i, step in enumerate(result['intermediate_steps'], 1):
        tool = step.get('tool', 'N/A')
        obs = step.get('observation', '')[:100]
        print(f'{i}. 工具: {tool}')
        print(f'   结果: {obs}...')

print(f'\n--- 最终回答 (前200字) ---')
print(result.get('answer', '无回答')[:200])
