import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Course from './pages/Course.jsx';
import ModulePage from './pages/ModulePage.jsx';
import Tests from './pages/Tests.jsx';
import Review from './pages/Review.jsx';
import GlossaryPage from './pages/GlossaryPage.jsx';
import SandboxPage from './pages/SandboxPage.jsx';
import LabPage from './pages/LabPage.jsx';
import FinalExam from './pages/FinalExam.jsx';
import ProgressPage from './pages/ProgressPage.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/course" element={<Course />} />
        <Route path="/module/:id" element={<ModulePage />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/review" element={<Review />} />
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/sandbox" element={<SandboxPage />} />
        <Route path="/lab" element={<LabPage />} />
        <Route path="/exam" element={<FinalExam />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
