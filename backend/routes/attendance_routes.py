
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend import models, database

router = APIRouter(prefix="/attendance", tags=["Attendance"])

class AttendanceRequest(BaseModel):
    student_id: int
    session_id: int

@router.post("/checkin")
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

@router.get("/active-session")
def get_active_session(classroom: str, db: Session = Depends(database.get_db)):
    session = db.query(models.Session).filter(
        models.Session.classroom == classroom,
        models.Session.is_active == True
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    return {
        "session_id": session.id,
        "course_name": session.course_name,
        "group_name": session.group_name,
        "classroom": session.classroom,
    }