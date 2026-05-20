import urllib.request
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

url = "http://localhost:8000/api/chat"
data = json.dumps({"question": "你好"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
try:
    r = urllib.request.urlopen(req, timeout=120)
    resp = json.loads(r.read())
    print(f"Keys: {list(resp.keys())}")
    for k, v in resp.items():
        val_str = str(v)
        if len(val_str) > 200:
            val_str = val_str[:200] + "..."
        print(f"  {k}: {val_str}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")