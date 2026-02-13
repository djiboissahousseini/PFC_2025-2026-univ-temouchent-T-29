from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from backend import models, database

# Create tables if they don't exist
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Face Recognition Attendance System")

@app.get("/")
def root():
    return {"message": "FastAPI + PostgreSQL is working!"}

# Example: Add teacher
@app.post("/teachers/")
def add_teacher(name: str, email: str, db: Session = Depends(database.get_db)):
    teacher = models.Teacher(name=name, email=email)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return {"id": teacher.id, "name": teacher.name, "email": teacher.email}
