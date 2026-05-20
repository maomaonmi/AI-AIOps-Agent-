import asyncio
from data_collector import DataCollector

# Initialize with Prometheus URL
dc = DataCollector(prometheus_url='http://localhost:9090')

# Test monitoring data collection
async def test():
    print("Testing monitoring data collection...")
    data = await dc.collect_monitoring_data('cpu', '30m')
    
    print(f"\nMetrics count: {len(data.get('metrics', []))}")
    print(f"Alerts count: {len(data.get('alerts', []))}")
    
    if data.get('metrics'):
        print("\nFirst metric:")
        m = data['metrics'][0]
        print(f"  Name: {m.get('name')}")
        print(f"  Label: {m.get('label')}")
        print(f"  Current: {m.get('current')}")
        print(f"  Status: {m.get('status')}")
        print(f"  History points: {len(m.get('history', []))}")
        if m.get('history'):
            print(f"  First history: {m['history'][0]}")
            print(f"  Last history: {m['history'][-1]}")

asyncio.run(test())
