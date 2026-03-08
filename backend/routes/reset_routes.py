from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend import database

router = APIRouter(prefix="/reset", tags=["Reset"])

@router.delete("/teachers")
def reset_teachers(db: Session = Depends(database.get_db)):
    try:
        db.execute(text("TRUNCATE TABLE teachers RESTART IDENTITY CASCADE;"))
        db.commit()
        return {"message": "Teachers table reset. IDs start from 1."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/sessions")
def reset_sessions(db: Session = Depends(database.get_db)):
    try:
        db.execute(text("TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;"))
        db.commit()
        return {"message": "All sessions deleted and ID reset"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))