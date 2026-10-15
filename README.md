# PulseSpeed — Internet Speed Test

A responsive internet speed test built with Flask, HTML, CSS and vanilla JavaScript.

## Features
- Download and upload throughput in Mbps
- HTTP round-trip latency and jitter estimate
- Animated speed gauge and progress states
- Responsive desktop/mobile layout
- Local browser history
- Flask API with payload caps and basic rate limits
- Render deployment configuration

## Run locally
Requires Python 3.10+.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000.

## Deploy on Render
1. Push this project to GitHub.
2. In Render, create a new Web Service and connect the repository.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app --workers 2 --threads 4 --timeout 60`
5. Deploy and test from another internet connection.

## API endpoints
- `GET /api/ping` — small uncached HTTP response.
- `GET /api/download?bytes=8388608` — random download payload, capped at 20 MiB.
- `POST /api/upload` — receives upload data, with a 25 MiB request cap.

## Measurement limitations
Browser latency is HTTP round-trip time, not ICMP ping. Upload timing includes request transfer and server response. Server bandwidth, CPU, geography, and hosting limits affect the results. These measurements are indicative, not a certified ISP benchmark.

The default in-memory rate-limit store is not shared across multiple workers. For a public/high-traffic service, configure Redis, add robust abuse protection, and monitor hosting bandwidth/costs. Keep conservative limits: speed tests can consume substantial bandwidth.
