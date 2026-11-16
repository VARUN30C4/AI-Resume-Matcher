import os
import sys
import tempfile
from pathlib import Path

# deterministic + offline for CI; set before the app is imported
os.environ.setdefault("EMBEDDING_BACKEND", "offline")
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="rm_test_")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "sample_data"


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def jd_text() -> str:
    return (SAMPLES / "sample_jd.txt").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def resume_files() -> list[Path]:
    files = sorted((SAMPLES / "resumes").glob("*"))
    assert len(files) >= 10, "run scripts/generate_samples.py first"
    return files
