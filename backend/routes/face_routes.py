from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from deepface import DeepFace
from backend.database import get_db
from backend.models import Student, Attendance
import shutil
import os
import numpy as np

router = APIRouter(prefix="/face", tags=["Face Recognition"])

SIMILARITY_THRESHOLD = 0.6

# ─────────────────────────────────────────────
# Helper: save uploaded file temporarily
# ─────────────────────────────────────────────
def save_temp_file(file: UploadFile, folder: str = "backend/faces") -> str:
    os.makedirs(folder, exist_ok=True)
    temp_path = os.path.join(folder, f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return temp_path

# ─────────────────────────────────────────────
# Helper: get embedding from image path
# ─────────────────────────────────────────────
def get_embedding(img_path: str) -> np.ndarray:
    result = DeepFace.represent(img_path=img_path, model_name="Facenet")
    return np.array(result[0]["embedding"], dtype=np.float32)

# ─────────────────────────────────────────────
# Helper: cosine similarity
# ─────────────────────────────────────────────
def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# ─────────────────────────────────────────────
# Helper: find best matching student
# ─────────────────────────────────────────────
def find_best_match(students, uploaded_embedding: np.ndarray):
    best_match = None
    highest_similarity = -1
    for student in students:
        registered_embedding = np.array(student.face_embedding, dtype=np.float32)
        similarity = cosine_similarity(registered_embedding, uploaded_embedding)
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = student
    return best_match, highest_similarity


# ─────────────────────────────────────────────
# POST /face/register-student
# Register a student's face into students table
# ─────────────────────────────────────────────
@router.post("/register-student")
async def register_student_face(
    student_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1️⃣ Check student exists
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    temp_path = save_temp_file(file)
    try:
        embedding = get_embedding(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # 2️⃣ Save embedding to student
    student.face_embedding = embedding.tolist()
    db.commit()

    return {"message": f"✅ Face registered for student {student.name}"}


# ─────────────────────────────────────────────
# POST /face/identify
# Identify a face against students table
# ─────────────────────────────────────────────
@router.post("/identify")
async def identify_face(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    temp_path = save_temp_file(file)
    try:
        uploaded_embedding = get_embedding(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    students = db.query(Student).filter(Student.face_embedding != None).all()
    if not students:
        raise HTTPException(status_code=404, detail="No registered student faces found")

    best_match, highest_similarity = find_best_match(students, uploaded_embedding)

    return {
        "matched_student_id": best_match.id,
        "matched_student_name": best_match.name,
        "match": highest_similarity > SIMILARITY_THRESHOLD,
        "similarity": round(highest_similarity, 4)
    }


# ─────────────────────────────────────────────
# POST /face/checkin
# Identify face + log attendance in one step
# ─────────────────────────────────────────────
@router.post("/checkin")
async def face_checkin(
    session_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Step 1: Generate embedding
    temp_path = save_temp_file(file)
    try:
        uploaded_embedding = get_embedding(temp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # Step 2: Find best matching student
    students = db.query(Student).filter(Student.face_embedding != None).all()
    if not students:
        raise HTTPException(status_code=404, detail="No registered student faces found")

    best_match, highest_similarity = find_best_match(students, uploaded_embedding)

    # Step 3: Check threshold
    if highest_similarity <= SIMILARITY_THRESHOLD:
        return {
            "status": "unknown",
            "match": False,
            "message": "❌ Face not recognized — attendance NOT logged"
        }

    # Step 4: Check session is active
    from backend.models import Session as SessionModel
    session = db.query(SessionModel).filter(
        SessionModel.id == session_id,
        SessionModel.is_active == True
    ).first()
    if not session:
        raise HTTPException(status_code=400, detail="Session not active or not found")

    # Step 5: Prevent duplicate attendance
    existing = db.query(Attendance).filter(
        Attendance.student_id == best_match.id,
        Attendance.session_id == session_id
    ).first()
    if existing:
        return {
            "status": "duplicate",
            "student": best_match.name,
            "message": "⚠️ Already checked in for this session"
        }

    # Step 6: Log attendance
    new_attendance = Attendance(
        student_id=best_match.id,
        session_id=session_id,
        status="present"
    )
    db.add(new_attendance)
    db.commit()

    return {
        "status": "success",
        "student": best_match.name,
        "similarity": round(float(highest_similarity), 4),
        "session_id": session_id,
        "message": f"✅ Attendance logged for {best_match.name}"
    }