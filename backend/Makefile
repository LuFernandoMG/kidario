PYTHON ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python)
PIP ?= $(PYTHON) -m pip
UVICORN ?= $(PYTHON) -m uvicorn
PYTEST ?= $(PYTHON) -m pytest
APP ?= app.main:app
HOST ?= 127.0.0.1
PORT ?= 8000

.PHONY: help venv-info check-python check-uvicorn check-pytest dev dev-watch test

help:
	@echo "Targets:"
	@echo "  make dev        Run API without reload (preferred for stability)"
	@echo "  make dev-watch  Run API with scoped reload on app/"
	@echo "  make test       Run pytest"
	@echo "  make venv-info  Show the Python executable and version in use"
	@echo ""
	@echo "Overrides:"
	@echo "  make PYTHON=python dev"
	@echo "  make HOST=0.0.0.0 PORT=8001 dev-watch"

venv-info: check-python
	@echo "PYTHON=$(PYTHON)"
	@$(PYTHON) --version

check-python:
	@command -v $(PYTHON) >/dev/null 2>&1 || { \
		echo "Python executable not found: $(PYTHON)"; \
		echo "Create or activate backend/.venv, or pass PYTHON=..."; \
		exit 1; \
	}

check-uvicorn: check-python
	@$(PYTHON) -c "import uvicorn" >/dev/null 2>&1 || { \
		echo "uvicorn is not installed for $(PYTHON)"; \
		echo "Run: $(PIP) install -e \".[dev]\""; \
		exit 1; \
	}

check-pytest: check-python
	@$(PYTHON) -c "import pytest" >/dev/null 2>&1 || { \
		echo "pytest is not installed for $(PYTHON)"; \
		echo "Run: $(PIP) install -e \".[dev]\""; \
		exit 1; \
	}

dev: check-uvicorn
	$(UVICORN) $(APP) --host $(HOST) --port $(PORT)

dev-watch: check-uvicorn
	$(UVICORN) $(APP) \
		--host $(HOST) \
		--port $(PORT) \
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

test: check-pytest
	$(PYTEST) -q
