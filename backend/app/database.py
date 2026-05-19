import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finance.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # This setting is required for SQLite (allows multiple threads)
    connect_args={"check_same_thread": False},
)

# Each request gets its own database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All models will inherit from this base class
Base = declarative_base()


# Dependency — used in route functions to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db  # FastAPI injects this into route functions
    finally:
        db.close()  # Always close the session after the request
