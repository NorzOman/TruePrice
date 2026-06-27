
"""
This is just a demo script that adds previous prices to products.

The reason for this file is that the project is based on a cold price mechanism that requires prolonged usage over several months to become useful. Since using it for that long is not ergonomic, this script is used to temporarily fill those data gaps to represent how the actual data comparison will look.

For real-world scenarios, this script can be removed.
"""

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
