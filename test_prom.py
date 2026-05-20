from prometheus_client import PrometheusClient

c = PrometheusClient('http://localhost:9090')

# Test query_cpu_usage
metrics = c.query_cpu_usage("30m")
print('CPU metrics count:', len(metrics))

if metrics:
    print('\nFirst metric:')
    print('  Name:', metrics[0].get('name'))
    print('  Label:', metrics[0].get('label'))
    print('  Current:', metrics[0].get('current'))
    print('  Unit:', metrics[0].get('unit'))
    print('  Status:', metrics[0].get('status'))
    print('  History points:', len(metrics[0].get('history', [])))
    if metrics[0].get('history'):
        print('  First history:', metrics[0]['history'][0])
        print('  Last history:', metrics[0]['history'][-1])
