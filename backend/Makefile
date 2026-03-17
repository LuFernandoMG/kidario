PYTHON ?= python3
UVICORN ?= $(PYTHON) -m uvicorn
APP = app.main:app

.PHONY: dev dev-watch test

dev:
	$(UVICORN) $(APP) --host 127.0.0.1 --port 8000

dev-watch:
	$(UVICORN) $(APP) \
		--host 127.0.0.1 \
		--port 8000 \
		--reload \
		--reload-dir app \
		--reload-include '*.py' \
		--reload-exclude '.venv/*' \
		--reload-exclude 'tests/*' \
		--reload-exclude 'scripts/*' \
		--reload-exclude 'sql/*' \
		--reload-exclude 'docs/*' \
		--reload-exclude '.git/*' \
		--reload-exclude '.pytest_cache/*' \
		--reload-exclude '__pycache__/*'

test:
	$(PYTHON) -m pytest -q
