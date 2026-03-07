from fastapi import APIRouter, UploadFile, File, Depends,HTTPException,Form
from sqlalchemy.orm import Session
from deepface import DeepFace
from backend.database import get_db
from backend.models import Person, UserFaces, Attendance 
import shutil
import os
import numpy as np

router = APIRouter(prefix="/face", tags=["Face Recognition"])

@router.post("/register")
async def register_face(
    name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Generate embedding with Facenet explicitly
    embedding = DeepFace.represent(img_path=file_path, model_name="Facenet")[0]["embedding"]

# Convert to list so it can be stored safely in db
    new_person = Person(name=name, embedding=list(embedding))
    db.add(new_person)
    db.commit()
    return {"message": "Face registered successfully"}


@router.post("/identify")
async def identify_face(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    # Save uploaded image temporarily
    temp_path = f"backend/faces/temp_{file.filename}"
    os.makedirs(os.path.dirname(temp_path), exist_ok=True)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # Generate embedding for uploaded face
        uploaded_embedding = DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"]
        uploaded_embedding = np.array(uploaded_embedding, dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating embedding: {str(e)}")
    finally:
        os.remove(temp_path)

    # Fetch all registered users from Person table
    users = db.query(Person).all()
    if not users:
        raise HTTPException(status_code=404, detail="No registered users found")

    # Compare embeddings
    best_match = None
    highest_similarity = -1
    for user in users:
        registered_embedding = np.array(user.embedding, dtype=np.float32)
        similarity = np.dot(registered_embedding, uploaded_embedding) / (
            np.linalg.norm(registered_embedding) * np.linalg.norm(uploaded_embedding))
            
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = user

    # Decide if it's a match (threshold = 0.7)
    match = highest_similarity > 0.6

    return {
        "matched_user_id": best_match.id,  
        "matched_user_name": best_match.name,
        "match": bool(match),
        "similarity": float(highest_similarity)
    }

@router.post("/checkin")
async def face_checkin(
    session_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print("checkin endpoint hit")
    # Step 1: Save temp file
    temp_path = f"backend/faces/temp_{file.filename}"
    os.makedirs(os.path.dirname(temp_path), exist_ok=True)
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    print("fiel saved")
    try:
        # ✅ Liveness check
        

        # ✅ Generate embedding
        uploaded_embedding = DeepFace.represent(img_path=temp_path, model_name="Facenet")[0]["embedding"]
        print("embedding generated")
        uploaded_embedding = np.array(uploaded_embedding, dtype=np.float32)
        print("✅ converted to numpy")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ DeepFace error: {e}")
        raise HTTPException(status_code=500, detail=f"Face detection failed: {str(e)}")
    finally:
        os.remove(temp_path)

    # Step 2: Find best match in DB
    users = db.query(Person).all()
    print(f"✅ found {len(users)} users in DB")
    if not users:
        raise HTTPException(status_code=404, detail="No registered users found")

    best_match = None
    highest_similarity = -1
    for user in users:
        registered_embedding = np.array(user.embedding, dtype=np.float32)
        similarity = np.dot(registered_embedding, uploaded_embedding) / (
            np.linalg.norm(registered_embedding) * np.linalg.norm(uploaded_embedding)
        )
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = user

    print(f"✅ highest similarity: {highest_similarity}")
    print(f"✅ best match: {best_match.name if best_match else 'None'}")
    # Step 3: Face not recognized
    if highest_similarity <= 0.6:
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

    print(f"✅ inserting attendance for person id: {best_match.id}")
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
        "similarity": float(highest_similarity),
        "session_id": session_id,
        "message": f"✅ Attendance logged for {best_match.name}"
    }