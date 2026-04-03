from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend import models, database
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from deepface import DeepFace
import shutil
import os
import numpy as np
from datetime import datetime, timezone

router = APIRouter(prefix="/teacher", tags=["Teachers"])


class TeacherLoginRequest(BaseModel):
    teacher_id: int
    course_name: str


# ─────────────────────────────────────────────
# POST /teacher/add
# ─────────────────────────────────────────────
@router.post("/add")
def add_teacher(name: str, email: str, db: Session = Depends(database.get_db)):
    teacher = models.Teacher(name=name, email=email)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return {"id": teacher.id, "name": teacher.name, "email": teacher.email}


# ─────────────────────────────────────────────
# POST /teacher/login  (manual — kept for testing)
# ─────────────────────────────────────────────
@router.post("/login")
def teacher_login(request: TeacherLoginRequest, db: Session = Depends(database.get_db)):
    teacher = db.query(models.Teacher).filter(
        models.Teacher.id == request.teacher_id
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    existing_session = db.query(models.Session).filter(
        models.Session.teacher_id == teacher.id,
        models.Session.is_active == True
    ).first()
    if existing_session:
        raise HTTPException(status_code=400, detail="Teacher already has an active session")

    new_session = models.Session(
        teacher_id=teacher.id,
        course_name=request.course_name,
        session_date=datetime.now(timezone.utc),
        is_active=True
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "status": "success",
        "session_id": new_session.id,
        "teacher": teacher.name,
        "course": request.course_name,
        "date": str(new_session.session_date)
    }


# ─────────────────────────────────────────────
# POST /teacher/register-face
# ─────────────────────────────────────────────
@router.post("/register-face")
async def register_teacher_face(
    teacher_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    teacher = db.query(models.Teacher).filter(
        models.Teacher.id == teacher_id
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    temp_path = f"temp_teacher_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        embedding = DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    teacher.face_embedding = list(embedding)
    db.commit()

    return {"message": f"✅ Face registered for teacher {teacher.name}"}


# ─────────────────────────────────────────────
# POST /teacher/face-login
# Identify teacher by face → query timetable →
# auto-create session from matching slot
# ─────────────────────────────────────────────
@router.post("/face-login")
async def teacher_face_login(
    classroom: str = Form(...),        # e.g. "A7", "Amphi 1" — sent by the tablet
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # ── 1. Get embedding from uploaded photo ──────────────────
    temp_path = f"temp_teacher_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        uploaded_embedding = np.array(
            DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"],
            dtype=np.float32
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # ── 2. Match against all registered teachers ──────────────
    teachers = db.query(models.Teacher).filter(
        models.Teacher.face_embedding != None
    ).all()
    if not teachers:
        raise HTTPException(status_code=404, detail="No registered teacher faces found")

    best_match = None
    highest_similarity = -1
    for teacher in teachers:
        reg_emb = np.array(teacher.face_embedding, dtype=np.float32)
        similarity = float(np.dot(reg_emb, uploaded_embedding) / (
            np.linalg.norm(reg_emb) * np.linalg.norm(uploaded_embedding)
        ))
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = teacher

    if highest_similarity <= 0.7:
        raise HTTPException(status_code=401, detail="❌ Teacher not recognized")

    # ── 3. Get current day and time ───────────────────────────
    now = datetime.now()
    current_day = now.weekday()   # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat
    current_time = now.time()

    # ── 4. Query timetable: teacher + classroom + day + time window ──
    # Session can only start at or after start_time, and before end_time
    slot = db.query(models.Timetable).filter(
        models.Timetable.teacher_name == best_match.name,
        models.Timetable.classroom == classroom,
        models.Timetable.day_of_week == current_day,
        # models.Timetable.start_time <= current_time,
        # models.Timetable.end_time > current_time
    ).first() 

    if not slot:
        raise HTTPException(
            status_code=404,
            detail=f"❌ No active timetable slot for {best_match.name} in {classroom} right now. Check the time or classroom."
        )

    # ── 5. Prevent duplicate active session ───────────────────
    existing_session = db.query(models.Session).filter(
        models.Session.teacher_id == best_match.id,
        models.Session.is_active == True
    ).first()
    if existing_session:
        # Return existing session info instead of erroring
        return {
            "status": "already_active",
            "teacher": best_match.name,
            "session_id": existing_session.id,
            "course": existing_session.course_name,
            "group": existing_session.group_name,
            "classroom": existing_session.classroom,
            "message": f"⚠️ Session already active for {best_match.name}"
        }

    # ── 6. Create session from timetable slot ─────────────────
    new_session = models.Session(
        teacher_id=best_match.id,
        course_name=slot.course_name,
        group_name=slot.group_name,
        classroom=slot.classroom,
        session_date=datetime.now(timezone.utc),
        is_active=True
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "status": "success",
        "teacher": best_match.name,
        "session_id": new_session.id,
        "course": slot.course_name,
        "group": slot.group_name,
        "classroom": slot.classroom,
        "session_type": slot.session_type,
        "starts": str(slot.start_time),
        "ends": str(slot.end_time),
        "message": f"✅ Welcome {best_match.name}! Session started for {slot.group_name} — {slot.course_name}"
    }


# ─────────────────────────────────────────────
# PUT /teacher/logout/{teacher_id}
# ─────────────────────────────────────────────
@router.put("/logout/{teacher_id}")
def teacher_logout(teacher_id: int, db: Session = Depends(database.get_db)):
    session = db.query(models.Session).filter(
        models.Session.teacher_id == teacher_id,
        models.Session.is_active == True
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")

    session.is_active = False
    db.commit()

    return {"message": "✅ Session closed successfully"}