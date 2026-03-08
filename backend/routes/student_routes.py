from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend import models, database

router = APIRouter(prefix="/students", tags=["Students"])

class StudentCreateRequest(BaseModel):
    name: str
    matricule: str

@router.post("/")
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

    return {
        "id": student.id,
        "name": student.name,
        "matricule": student.matricule
    }