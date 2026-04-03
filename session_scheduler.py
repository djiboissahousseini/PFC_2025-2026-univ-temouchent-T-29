from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from backend.database import SessionLocal
from backend import models

scheduler = BackgroundScheduler()


def auto_close_expired_sessions():
    """Close sessions where timetable end_time has passed."""
    db = SessionLocal()
    try:
        now = datetime.now()
        current_time = now.time()
        current_day = now.weekday()  # 0=Mon … 5=Sat

        # Get all active sessions
        active_sessions = db.query(models.Session).filter(
            models.Session.is_active == True
        ).all()

        for session in active_sessions:
            # Find matching timetable slot
            slot = db.query(models.Timetable).filter(
                models.Timetable.course_name == session.course_name,
                models.Timetable.group_name == session.group_name,
                models.Timetable.classroom == session.classroom,
                models.Timetable.day_of_week == current_day,
            ).first()

            if slot and current_time >= slot.end_time:
                session.is_active = False
                print(f"[Scheduler] Auto-closed session {session.id} "
                      f"({session.course_name} / {session.group_name} / {session.classroom})")

        db.commit()

    except Exception as e:
        print(f"[Scheduler] Error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(auto_close_expired_sessions, "interval", seconds=60, id="session_closer")
    scheduler.start()
    print("[Scheduler] Session auto-close scheduler started.")


def stop_scheduler():
    scheduler.shutdown()