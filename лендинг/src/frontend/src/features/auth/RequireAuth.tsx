import { Navigate, Outlet, useLocation } from "react-router";
import { Alert, Button, PageShell, SkeletonBlock } from "../../shared/ui";
import { useAuth } from "./AuthContext";
import { StaffShell } from "./StaffShell";

/**
 * Гварды — это UX, не безопасность: права всегда проверяет API.
 * RequireAuth: скелетон пока /me в полёте; аноним → /login c returnTo;
 * не-active → экран ожидания; must_change_password → /change-password
 * (сам /change-password монтируется с mustChangeExempt).
 * admin=true дополнительно требует роль admin, иначе экран 403.
 */
export function RequireAuth({
  children,
  admin = false,
  mustChangeExempt = false,
}: {
  children?: React.ReactNode;
  admin?: boolean;
  mustChangeExempt?: boolean;
}) {
  const { user, isLoading, isUnavailable, refreshMe } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <PageShell variant="staff">
        <SkeletonBlock height={48} label="Проверяем вход" />
        <SkeletonBlock height={280} label="Загружаем раздел" />
      </PageShell>
    );
  }

  if (isUnavailable) {
    return (
      <PageShell variant="staff">
        <Alert tone="error" title="Нет связи с сервером">
          Не удалось проверить вход. Проверьте подключение и попробуйте ещё раз.
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={() => void refreshMe()}>
              Попробовать ещё раз
            </Button>
          </div>
        </Alert>
      </PageShell>
    );
  }

  if (user === null) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (user.state !== "active") {
    return <Navigate to="/registration-pending" replace />;
  }

  if (user.must_change_password && !mustChangeExempt) {
    return <Navigate to="/change-password" replace />;
  }

  if (admin && user.role !== "admin") {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

export function ForbiddenPage() {
  return (
    <PageShell variant="staff">
      <Alert tone="error" title="Недостаточно прав">
        Раздел доступен только администраторам. Если нужен доступ — обратитесь к
        администратору системы.
      </Alert>
    </PageShell>
  );
}

/** Layout-роут: RequireAuth + StaffShell + Outlet для staff-разделов (T9). */
export function StaffRoute() {
  return (
    <RequireAuth>
      <StaffShell>
        <Outlet />
      </StaffShell>
    </RequireAuth>
  );
}

/** Layout-роут для /admin/*: RequireAuth(admin) + StaffShell + Outlet (T10). */
export function AdminRoute() {
  return (
    <RequireAuth admin>
      <StaffShell>
        <Outlet />
      </StaffShell>
    </RequireAuth>
  );
}
