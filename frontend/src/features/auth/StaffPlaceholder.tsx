import { ComicHeading, EmptyState, Kicker } from "../../shared/ui";

/*
 * Временные заглушки staff/admin разделов: маршруты и гварды закреплены в T8,
 * содержимое приходит в T9 (кандидаты) и T10 (админ).
 */
export function StaffPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <section>
      <Kicker>Кабинет сотрудника</Kicker>
      <ComicHeading level={1}>{title}</ComicHeading>
      <div style={{ marginTop: 24 }}>
        <EmptyState title={note} />
      </div>
    </section>
  );
}
