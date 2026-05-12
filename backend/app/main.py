from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import transactions, categories, summary, imports

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Finance Tracker API",
    description="Personal finance tracker - transactions, categories, and monthly summaries",
    version="1.0.0",
)

# Allow requests from your React frontend (running on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route groups
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
app.include_router(categories.router, prefix="/categories", tags=["Categories"])
app.include_router(summary.router, prefix="/summary", tags=["Summary"])
app.include_router(imports.router, prefix="/import", tags=["Import"])


@app.get("/")
def root():
    return {"message": "Finance Tracker API is running. Visit /docs for the API explorer."}
