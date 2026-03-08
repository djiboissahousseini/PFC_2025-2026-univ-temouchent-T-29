from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend import models, database
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from deepface import DeepFace
import shutil
import os
import numpy as np
from datetime import date, datetime, timezone

router = APIRouter(prefix="/teacher", tags=["Teachers"])

class TeacherLoginRequest(BaseModel):
    teacher_id: int
    course_name: str

@router.post("/add")
def add_teacher(name: str, email: str, db: Session = Depends(database.get_db)):
    teacher = models.Teacher(name=name, email=email)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return {"id": teacher.id, "name": teacher.name, "email": teacher.email}

@router.post("/login")
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
        raise HTTPException(status_code=400, detail="Teacher already has an active session")

    # 3️⃣ Create a new session
    new_session = models.Session(
        teacher_id=teacher.id,
        course_name=request.course_name,
        session_date=date.today(),
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

@router.post("/register-face")
async def register_teacher_face(
    teacher_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # 1️⃣ Check teacher exists
    teacher = db.query(models.Teacher).filter(
        models.Teacher.id == teacher_id
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    # 2️⃣ Save temp file
    temp_path = f"temp_teacher_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        embedding = DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # 3️⃣ Save embedding to teacher
    teacher.face_embedding = list(embedding)
    db.commit()

    return {"message": f"✅ Face registered for teacher {teacher.name}"}


@router.post("/face-login")
async def teacher_face_login(
    course_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # 1️⃣ Save temp file
    temp_path = f"temp_teacher_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        uploaded_embedding = DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"]
        uploaded_embedding = np.array(uploaded_embedding, dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # 2️⃣ Find best matching teacher
    teachers = db.query(models.Teacher).filter(
        models.Teacher.face_embedding != None
    ).all()

    if not teachers:
        raise HTTPException(status_code=404, detail="No registered teacher faces found")

    best_match = None
    highest_similarity = -1
    for teacher in teachers:
        registered_embedding = np.array(teacher.face_embedding, dtype=np.float32)
        similarity = np.dot(registered_embedding, uploaded_embedding) / (
            np.linalg.norm(registered_embedding) * np.linalg.norm(uploaded_embedding)
        )
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = teacher

    # 3️⃣ Check threshold
    if highest_similarity <= 0.7:
        raise HTTPException(status_code=401, detail="❌ Teacher not recognized")

    # 4️⃣ Check if already has active session
    existing_session = db.query(models.Session).filter(
        models.Session.teacher_id == best_match.id,
        models.Session.is_active == True
    ).first()
    if existing_session:
        raise HTTPException(status_code=400, detail="Teacher already has an active session")

    # 5️⃣ Create session automatically
    new_session = models.Session(
        teacher_id=best_match.id,
        course_name=course_name,
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
        "course": course_name,
        "message": f"✅ Welcome {best_match.name}! Session started."
    }

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

    return {"message": "Session closed successfully"}
