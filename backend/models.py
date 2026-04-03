from sqlalchemy import Column, Integer, String,LargeBinary, DateTime, Boolean, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import ARRAY, FLOAT
from datetime import datetime, timezone
from .database import Base
class Teacher(Base):
    __tablename__ = "teachers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    face_embedding = Column(ARRAY(FLOAT))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    matricule = Column(String(20), unique=True, nullable=False)
    face_embedding = Column(ARRAY(FLOAT))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    course_name = Column(String(100))
    group_name = Column(String(10))
    classroom = Column(String(20))
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

class Timetable(Base):
    __tablename__ = "timetable"
    id = Column(Integer, primary_key=True, index=True)
    teacher_name = Column(String(100), nullable=False)
    course_name = Column(String(100), nullable=False)
    session_type = Column(String(10), nullable=False)
    group_name = Column(String(10), nullable=False)
    classroom = Column(String(20), nullable=False)
    day_of_week = Column(Integer, nullable=False)       # 0=Mon … 5=Sat
    start_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))
