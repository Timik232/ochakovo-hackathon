import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { RootPage } from "../pages/RootPage";
import { ApplyPage } from "../features/application/ApplyPage";
import { SuccessPage } from "../features/application/SuccessPage";
import { PrivacyPage } from "../features/application/PrivacyPage";
import { AuthProvider } from "../features/auth/AuthProvider";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { RegistrationPendingPage } from "../features/auth/RegistrationPendingPage";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { AdminRoute, RequireAuth, StaffRoute } from "../features/auth/RequireAuth";
import { CandidatesPage } from "../features/candidates/CandidatesPage";
import { CandidateDetailPage } from "../features/candidates/CandidateDetailPage";
import { CandidateFormPage } from "../features/candidates/CandidateFormPage";
import { EmployeesPage } from "../features/admin/EmployeesPage";
import { AuditPage } from "../features/admin/AuditPage";
import { VacanciesPage } from "../features/admin/VacanciesPage";

const StyleGuidePage = import.meta.env.DEV
  ? lazy(() => import("../pages/StyleGuidePage"))
  : null;

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<RootPage />} path="/" />
          <Route element={<ApplyPage />} path="/apply" />
          <Route element={<SuccessPage />} path="/apply/success" />
          <Route element={<PrivacyPage />} path="/privacy" />
          <Route element={<LoginPage />} path="/login" />
          <Route element={<RegisterPage />} path="/register" />
          <Route element={<RegistrationPendingPage />} path="/registration-pending" />
          <Route
            path="/change-password"
            element={
              <RequireAuth mustChangeExempt>
                <ChangePasswordPage />
              </RequireAuth>
            }
          />
          <Route element={<StaffRoute />}>
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/new" element={<CandidateFormPage mode="create" />} />
            <Route path="/candidates/:id" element={<CandidateDetailPage />} />
            <Route path="/candidates/:id/edit" element={<CandidateFormPage mode="edit" />} />
            <Route path="/vacancies" element={<VacanciesPage />} />
          </Route>
          {/* Vacancies moved to the staff branch: the API lets every active staff
              member manage them; /admin/vacancies stays as a permanent redirect. */}
          <Route path="/admin/vacancies" element={<Navigate to="/vacancies" replace />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/employees" element={<EmployeesPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/*" element={<Navigate to="/admin/employees" replace />} />
          </Route>
          {StyleGuidePage !== null ? (
            <Route
              path="/style"
              element={
                <Suspense fallback={null}>
                  <StyleGuidePage />
                </Suspense>
              }
            />
          ) : null}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
