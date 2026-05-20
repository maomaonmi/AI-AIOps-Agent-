import requests
import json

# Test the chat API to see if module_data contains real Prometheus data
r = requests.post(
    'http://localhost:8000/api/chat',
    json={
        'question': '查看CPU使用率',
        'stream': False
    },
    timeout=30
)

print('Status:', r.status_code)
if r.status_code == 200:
    data = r.json()
    print('\nAnswer:', data.get('answer', '')[:200])
    print('\nModule data type:', data.get('module_data', {}).get('type'))
    
    module_data = data.get('module_data', {})
    if module_data:
        metrics = module_data.get('data', {}).get('metrics', [])
        print(f'Metrics count: {len(metrics)}')
        if metrics:
            print('\nFirst metric:')
            print(json.dumps(metrics[0], indent=2, ensure_ascii=False))
else:
    print('Error:', r.text)
