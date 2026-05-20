import asyncio
import sys
sys.path.insert(0, 'd:/AI运维助手')

from data_collector import DataCollector

# Initialize with Prometheus URL
dc = DataCollector(prometheus_url='http://localhost:9090')

async def test_all():
    print("=== Testing Real Prometheus Data ===\n")
    
    # Test CPU
    print("1. CPU Usage:")
    cpu_data = await dc.collect_monitoring_data('cpu', '30m')
    metrics = cpu_data.get('metrics', [])
    if metrics:
        for m in metrics[:2]:
            print(f"   {m.get('label')}: {m.get('current')}{m.get('unit')} [{m.get('status')}]")
            if m.get('history'):
                print(f"   History: {len(m['history'])} points, latest: {m['history'][-1]}")
    else:
        print("   No data")
    
    # Test Memory
    print("\n2. Memory Usage:")
    mem_data = await dc.collect_monitoring_data('memory', '30m')
    metrics = mem_data.get('metrics', [])
    if metrics:
        for m in metrics[:2]:
            print(f"   {m.get('label')}: {m.get('current')}{m.get('unit')} [{m.get('status')}]")
    else:
        print("   No data")
    
    # Test Disk
    print("\n3. Disk Usage:")
    disk_data = await dc.collect_monitoring_data('disk', '30m')
    metrics = disk_data.get('metrics', [])
    if metrics:
        for m in metrics[:2]:
            print(f"   {m.get('label')}: {m.get('current')}{m.get('unit')} [{m.get('status')}]")
    else:
        print("   No data")
    
    # Test Network
    print("\n4. Network Traffic:")
    net_data = await dc.collect_monitoring_data('network', '30m')
    metrics = net_data.get('metrics', [])
    if metrics:
        for m in metrics[:2]:
            print(f"   {m.get('label')}: {m.get('current')}{m.get('unit')} [{m.get('status')}]")
    else:
        print("   No data")
    
    print("\n=== All tests completed ===")

asyncio.run(test_all())
