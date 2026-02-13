from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, Boolean, ForeignKey, UniqueConstraint
from datetime import datetime
from .database import Base

class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    face_embedding = Column(LargeBinary)
    created_at = Column(DateTime, default=datetime.utcnow)

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    matricule = Column(String(20), unique=True, nullable=False)
    face_embedding = Column(LargeBinary)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="present")
    __table_args__ = (UniqueConstraint('student_id', 'session_id', name='_student_session_uc'),)
