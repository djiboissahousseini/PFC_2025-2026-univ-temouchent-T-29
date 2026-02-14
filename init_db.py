# init_db.py
from backend.database import engine, Base
from backend.models import UserFaces  # and any other models you have

# This creates all tables defined by your SQLAlchemy models
Base.metadata.create_all(bind=engine)

print("✅ All tables created successfully!")
