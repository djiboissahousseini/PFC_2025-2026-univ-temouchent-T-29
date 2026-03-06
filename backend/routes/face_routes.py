from fastapi import APIRouter, UploadFile, File, Depends,HTTPException,Form
from sqlalchemy.orm import Session
from deepface import DeepFace
from backend.database import get_db
from backend.models import Person, UserFaces
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
    match = highest_similarity > 0.7

    return {
        "matched_user_id": best_match.id,  
        "matched_user_name": best_match.name,
        "match": bool(match),
        "similarity": float(highest_similarity)
    }