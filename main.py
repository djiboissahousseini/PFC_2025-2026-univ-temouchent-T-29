from fastapi import FastAPI, Depends,HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend import models, database
from pydantic import BaseModel      # For request validation
from datetime import date           # To set the session date

class TeacherLoginRequest(BaseModel):
    teacher_id: int
    course_name: str

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

# Exemple: When teacher login a new session is created
@app.post("/teacher/login")
def teacher_login(request: TeacherLoginRequest, db: Session = Depends(database.get_db)):

    # 1️⃣ Check if teacher exists
    teacher = db.query(models.Teacher).filter(
        models.Teacher.id == request.teacher_id
    ).first()
    if not teacher:
         raise HTTPException(status_code=404, detail="Teacher not found")

     # 2️⃣ Check if teacher already has an active session
    existing_session = db.query(models.Session).filter(
        models.Session.teacher_id == teacher.id,
        models.Session.is_active == True
    ).first()

    if existing_session:
        raise HTTPException(status_code=400,detail="Teacher already has an active session")
    
    # 2️⃣ Create a new session
    new_session = models.Session(
        teacher_id=teacher.id,
        course_name=request.course_name,
        session_date=date.today(),
        is_active=True
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)  # refresh to get the generated id

    # 3️⃣ Return success
    return {
        "status": "success",
        "session_id": new_session.id,
        "teacher": teacher.name,
        "course": request.course_name,
        "date": str(new_session.session_date)
    }

#Example: reset teachers and sessions tables and restart id=0 
@app.delete("/reset/teachers")
def reset_teachers(db: Session = Depends(database.get_db)):
    try:
        db.execute(text("TRUNCATE TABLE teachers RESTART IDENTITY CASCADE;"))
        db.commit()
        return {"message": "Teachers table reset. IDs start from 1."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/reset/sessions")
def reset_sessions(db: Session = Depends(database.get_db)):
    try:
        db.execute(text("TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;"))
        db.commit()
        return {"message": "All sessions deleted and ID reset"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
#Teacher logout to start new session

@app.put("/teacher/logout/{teacher_id}")
def teacher_logout(teacher_id: int, db: Session = Depends(database.get_db)):

    session = db.query(models.Session).filter(
        models.Session.teacher_id == teacher_id,
        models.Session.is_active == True
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="No active session found")

    session.is_active = False
    db.commit()

    return {"message": "Session closed successfully"}
