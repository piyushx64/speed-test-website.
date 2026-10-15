from flask import Flask, render_template, request, Response, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import secrets
import os

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["120 per minute"],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
)

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/api/ping")
@limiter.limit("60 per minute")
def ping():
    response = jsonify(ok=True)
    response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/api/download")
@limiter.limit("20 per minute")
def download():
    size = request.args.get("bytes", default=8 * 1024 * 1024, type=int)
    size = max(256 * 1024, min(size, 20 * 1024 * 1024))
    payload = secrets.token_bytes(size)
    return Response(payload, mimetype="application/octet-stream", headers={
        "Content-Length": str(size),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
    })

@app.post("/api/upload")
@limiter.limit("20 per minute")
def upload():
    total = 0
    while True:
        chunk = request.stream.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
    return jsonify(received_bytes=total)

@app.errorhandler(413)
def too_large(_error):
    return jsonify(error="Upload too large; maximum request size is 25 MB."), 413

@app.errorhandler(429)
def rate_limited(_error):
    return jsonify(error="Too many tests. Please wait a moment and retry."), 429

if __name__ == "__main__":
    app.run(debug=True)
