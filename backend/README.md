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

ML dependencies are listed separately in `requirements-ml.txt` for the later ML phase.
