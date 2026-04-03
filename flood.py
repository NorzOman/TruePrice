
import random
from datetime import datetime, timedelta, timezone

import requests

url = "http://localhost:8000/api/post/price"
item = "B0FFM8M9B5"
price = 25000

start = datetime(2026, 3, 1, 9, 47, 7, 377000, tzinfo=timezone.utc)
days = 29

for i in range(days):
    ts = (start + timedelta(days=i)).isoformat().replace("+00:00", "Z")
    data = {
        "uid" : item,
        "timestamp": ts,
        "price" : price - random.randint(1,1000)
    }
    response =  requests.post(url,json=data)
    print(f"day {i+1}/{days} -> {response.status_code} ({ts})")