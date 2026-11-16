"""Persistence. SQLite by default; set DATABASE_URL to use PostgreSQL, e.g.
   DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/resume_matcher
JSON payloads are stored as TEXT so the same schema works on both engines."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'app.db'}")

_kwargs = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, future=True, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), default="")
    text: Mapped[str] = mapped_column(Text)
    parsed: Mapped[str] = mapped_column(Text)  # JSON of JDProfile
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job", cascade="all, delete-orphan")

    @property
    def parsed_json(self) -> dict:
        return json.loads(self.parsed)


class Candidate(Base):
    __tablename__ = "candidates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(200), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    profile: Mapped[str] = mapped_column(Text)   # JSON of ResumeProfile (without raw text)
    result: Mapped[str] = mapped_column(Text)    # JSON of scoring result
    raw_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="new")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    job: Mapped[Job] = relationship(back_populates="candidates")

    @property
    def profile_json(self) -> dict:
        return json.loads(self.profile)

    @property
    def result_json(self) -> dict:
        return json.loads(self.result)


def init_db() -> None:
    Base.metadata.create_all(engine)
    # Safe SQLite migration if upgrading an existing database
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            cols = [row[1] for row in conn.exec_driver_sql("PRAGMA table_info(candidates)").fetchall()]
            if cols and "status" not in cols:
                conn.exec_driver_sql("ALTER TABLE candidates ADD COLUMN status VARCHAR(30) DEFAULT 'new'")
            if cols and "notes" not in cols:
                conn.exec_driver_sql("ALTER TABLE candidates ADD COLUMN notes TEXT DEFAULT ''")
            conn.commit()


def get_session():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
