from fastapi import FastAPI, Depends,HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend import models, database
from backend.routes.face_routes import router as face_router
from pydantic import BaseModel      # For request validation
from datetime import date  
import os         # To set the session date
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
class TeacherLoginRequest(BaseModel):
    teacher_id: int
    course_name: str

class AttendanceRequest(BaseModel):
    student_id: int
    session_id: int
class StudentCreateRequest(BaseModel):
    name: str
    matricule: str 

# Create tables if they don't exist
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Face Recognition Attendance System")
app.include_router(face_router)

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

#Create Student
@app.post("/students/")
def add_student(request: StudentCreateRequest, db: Session = Depends(database.get_db)):

    # 1️⃣ Check if matricule already exists
    existing_student = db.query(models.Student).filter(
        models.Student.matricule == request.matricule
    ).first()

    if existing_student:
        raise HTTPException(status_code=400, detail="Matricule already exists")

    # 2️⃣ Create new student
    student = models.Student(
        name=request.name,
        matricule=request.matricule
    )

    db.add(student)
    db.commit()
    db.refresh(student)

    # 3️⃣ Return response
    return {
        "id": student.id,
        "name": student.name,
        "matricule": student.matricule
    }

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
#Students login into existing session
@app.post("/attendance/checkin")
def student_checkin(request: AttendanceRequest, db: Session = Depends(database.get_db)):

    # 1️⃣ Check student exists
    student = db.query(models.Student).filter(
        models.Student.id == request.student_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 2️⃣ Check session exists and is active
    session = db.query(models.Session).filter(
        models.Session.id == request.session_id,
        models.Session.is_active == True
    ).first()

    if not session:
        raise HTTPException(status_code=400, detail="Session not active or not found")

    # 3️⃣ Check duplicate attendance
    existing_attendance = db.query(models.Attendance).filter(
        models.Attendance.student_id == student.id,
        models.Attendance.session_id == session.id
    ).first()

    if existing_attendance:
        raise HTTPException(status_code=400, detail="Student already checked in")

    # 4️⃣ Insert attendance
    new_attendance = models.Attendance(
        student_id=student.id,
        session_id=session.id,
        status="present"
    )

    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    return {
        "status": "success",
        "student": student.name,
        "session_id": session.id
    }


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
    

