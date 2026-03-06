from sqlalchemy import Column, Integer, String,LargeBinary, DateTime, Boolean, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import ARRAY, FLOAT
from datetime import datetime, timezone
from .database import Base

class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    embedding = Column(ARRAY(FLOAT))

class UserFaces(Base):
    __tablename__ = "user_faces"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    embedding = Column(JSON)  # stores the face embedding as a list
class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    face_embedding = Column(LargeBinary)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    matricule = Column(String(20), unique=True, nullable=False)
    face_embedding = Column(LargeBinary)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    course_name = Column(String(100))
    session_date = Column(DateTime)
    is_active = Column(Boolean, default=True)

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    session_id = Column(Integer, ForeignKey("sessions.id"))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(20), default="present")
    __table_args__ = (UniqueConstraint('student_id', 'session_id', name='_student_session_uc'),)
