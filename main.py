import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from deepface import DeepFace
from backend import models, database
from backend.routes.face_routes import router as face_router
from backend.routes.teacher_routes import router as teacher_router
from backend.routes.student_routes import router as student_router
from backend.routes.attendance_routes import router as attendance_router
from backend.routes.reset_routes import router as reset_router

# Create tables if they don't exist
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Face Recognition Attendance System")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(face_router)
app.include_router(teacher_router)
app.include_router(student_router)
app.include_router(attendance_router)
app.include_router(reset_router)

# Preload DeepFace model
# @app.on_event("startup")
# def load_models():
#     print("⏳ Loading DeepFace models...")
#     DeepFace.build_model("Facenet")
#     print("✅ Models loaded and ready!")

@app.get("/api")
def root():
    return {"message": "Face Attendance System is running!"}

# Serve React frontend
app.mount("/", StaticFiles(directory="frontend/build", html=True), name="static")