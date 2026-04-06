
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend import models, database
from backend.models import Student, Teacher,Attendance

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
    session = (
        db.query(models.Session)
        .filter(models.Session.classroom == classroom, models.Session.is_active == True)
        .first()
    )
    if not session:
        return {"session_id": None, "is_active": False}
 
    teacher = db.query(Teacher).filter(Teacher.id == session.teacher_id).first()
 
    return {
        "session_id":   session.id,
        "is_active":    True,
        "course_name":  session.course_name,
        "group_name":   session.group_name,
        "classroom":    session.classroom,
        "session_date": session.session_date.isoformat() if session.session_date else None,
        "teacher_name": teacher.name if teacher else None,
    }
 

@router.get("/session/{session_id}")
def get_session_attendance(session_id: int, db: Session = Depends(database.get_db)):
    """
    Returns all attendance records for a session,
    including student name and matricule.
    Used by the Teacher Dashboard.
    """
    records = (
        db.query(
            Attendance.id,
            Attendance.student_id,
            Attendance.session_id,
            Attendance.status,
            Attendance.timestamp,
            Student.name.label("student_name"),
            Student.matricule,
        )
        .join(Student, Student.id == Attendance.student_id)
        .filter(Attendance.session_id == session_id)
        .order_by(Attendance.timestamp.asc())
        .all()
    )
 
    return [
        {
            "id":           r.id,
            "student_id":   r.student_id,
            "session_id":   r.session_id,
            "status":       r.status,
            "timestamp":    r.timestamp.isoformat() if r.timestamp else None,
            "student_name": r.student_name,
            "matricule":    r.matricule,
        }
        for r in records
    ]
# GET /attendance/absences/{student_id} — absence count per course for one student
@router.get("/absences/{student_id}")
def get_student_absences(student_id: int, db: Session = Depends(database.get_db)):
    from sqlalchemy import func
    from backend.models import Session as SessionModel

    results = db.query(
        SessionModel.course_name,
        func.count(Attendance.id).label("absence_count")
    ).join(
        Attendance, Attendance.session_id == SessionModel.id
    ).filter(
        Attendance.student_id == student_id,
        Attendance.status == "absent"
    ).group_by(SessionModel.course_name).all()

    return [
        {"course_name": r.course_name, "absence_count": r.absence_count}
        for r in results
    ]


# GET /attendance/absences — absence count for all students
@router.get("/absences")
def get_all_absences(db: Session = Depends(database.get_db)):
    from sqlalchemy import func
    from backend.models import Session as SessionModel

    results = db.query(
        Student.id,
        Student.name,
        Student.matricule,
        Student.group_name,
        SessionModel.course_name,
        func.count(Attendance.id).label("absence_count")
    ).join(
        Attendance, Attendance.student_id == Student.id
    ).join(
        SessionModel, SessionModel.id == Attendance.session_id
    ).filter(
        Attendance.status == "absent"
    ).group_by(
        Student.id, Student.name, Student.matricule,
        Student.group_name, SessionModel.course_name
    ).order_by(
        func.count(Attendance.id).desc()
    ).all()

    return [
        {
            "student_id": r.id,
            "student_name": r.name,
            "matricule": r.matricule,
            "group_name": r.group_name,
            "course_name": r.course_name,
            "absence_count": r.absence_count,
            "warning": "exclusion" if r.absence_count >= 5 else "at_risk" if r.absence_count >= 3 else None
        }
        for r in results
    ]