# Deep-Focus Backend

FastAPI backend scaffold for Deep-Focus.

## Install

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

## Health check

```bash
curl http://127.0.0.1:8000/health
```

## Classify

```bash
curl -X POST http://127.0.0.1:8000/classify \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/python-tutorial",
    "title": "Some Amazing Python Programs - Python Tutorial",
    "metaDescription": "Learn Python programming with examples.",
    "headings": ["Python Tutorial"],
    "textSample": "This programming lesson covers Python code and software development.",
    "youtubeTitle": "",
    "channelName": "",
    "source": "web",
    "allowedCategories": ["python", "programming", "tutorial"],
    "blockedCategories": ["gaming", "memes"]
  }'
```

ML dependencies are listed separately in `requirements-ml.txt` for the later ML phase.
