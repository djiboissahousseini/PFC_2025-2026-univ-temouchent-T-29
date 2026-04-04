import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import AttendanceApp from "./AttendancApp"
import TeacherDashboard from "./TeacherDashboard"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AttendanceApp />} />
        <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)