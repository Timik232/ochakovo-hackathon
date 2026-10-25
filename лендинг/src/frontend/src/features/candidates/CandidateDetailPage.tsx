import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "../../shared/lib/uuid";
import { useAuth } from "../auth/AuthContext";
import {
  Alert,
  Badge,
  Button,
  ComicHeading,
  Dialog,
  Field,
  Kicker,
  SkeletonBlock,
  Spinner,
  Textarea,
} from "../../shared/ui";
import { addComment, deleteCandidate, fetchCandidate, fetchComments } from "./api";
import {
  EDU_LABELS,
  EMPLOYMENT_LABELS,
  formatMoscow,
  formatMoscowDateOnly,
  fullName,
  PRIORITY_LABELS,
  ratingStars,
  SOURCE_LABELS,
  WHO_LABELS,
} from "./format";
import { CANDIDATES_KEY, staffNameMap, useStaffOptions, useVacancies, vacancyTitleMap } from "./hooks";
import type { CommentPage, CommentView } from "./types";
import styles from "./CandidateDetailPage.module.css";

export function CandidateDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const candidateQuery = useQuery({
    queryKey: [...CANDIDATES_KEY, "detail", id],
    queryFn: () => fetchCandidate(id),
    enabled: id !== "",
  });
  const commentsQuery = useQuery({
    queryKey: [...CANDIDATES_KEY, "comments", id],
    queryFn: () => fetchComments(id),
    enabled: id !== "",
  });
  const { data: vacancies } = useVacancies();
  const { data: staffOptions } = useStaffOptions();
  const vacancyTitles = vacancyTitleMap(vacancies);
  const staffNames = staffNameMap(staffOptions);

  const deleteMutation = useMutation({
    mutationFn: (version: number) => deleteCandidate(id, version),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY });
      navigate("/candidates");
    },
    onError: (error) => {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить карточку. Попробуйте ещё раз.",
      );
      void queryClient.invalidateQueries({ queryKey: [...CANDIDATES_KEY, "detail", id] });
    },
  });

  if (candidateQuery.isPending) {
    return (
      <div className={styles.page}>
        <SkeletonBlock height={48} label="Загружаем карточку" />
        <SkeletonBlock height={280} label="Загружаем поля" />
      </div>
    );
  }

  if (candidateQuery.isError || candidateQuery.data === undefined) {
    return (
      <div className={styles.page}>
        <Alert tone="error" title="Карточка не открылась">
          {candidateQuery.error instanceof Error
            ? candidateQuery.error.message
            : "Кандидат не найден или сервер недоступен."}
        </Alert>
        <div>
          <Button size="sm" variant="secondary" onClick={() => navigate("/candidates")}>
            К списку кандидатов
          </Button>
        </div>
      </div>
    );
  }

  const candidate = candidateQuery.data;
  const creatorName = candidate.created_by ? staffNames.get(candidate.created_by) : undefined;
  const responsibleName = candidate.responsible_id ? staffNames.get(candidate.responsible_id) : undefined;

  return (
    <div className={styles.page}>
      <nav className={styles.crumbs} aria-label="Навигация">
        <Link to="/candidates">← Кандидаты</Link>
      </nav>

      <header className={styles.header}>
        <div>
          <Kicker>Карточка кандидата</Kicker>
          <ComicHeading level={1}>
            {candidate.hot ? <span className={styles.hotMark} aria-label="Горячий кандидат">★</span> : null}
            {fullName(candidate)}
          </ComicHeading>
          <div className={styles.headerMeta}>
            <Badge stage={candidate.status} />
            {candidate.archived_at !== null ? <Badge tone="outline">В архиве</Badge> : null}
            <span className={styles.rating} title={`Оценка ${candidate.rating} из 5`}>
              <span aria-hidden="true">{ratingStars(candidate.rating)}</span>
              <span className={styles.srOnly}>Оценка {candidate.rating} из 5</span>
            </span>
            {candidate.priority === "high" ? <Badge tone="new">Высокий приоритет</Badge> : null}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/candidates/${id}/edit`)}>
            Редактировать
          </Button>
          {user?.role === "admin" ? (
            <Button
              size="sm"
              variant="ghost"
              className={styles.danger}
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              Удалить карточку
            </Button>
          ) : null}
        </div>
      </header>

      <p className={styles.addedAt}>
        Дата добавления: <time dateTime={candidate.created_at}>{formatMoscow(candidate.created_at)}</time>
      </p>

      {candidate.duplicate_contact_count > 0 ? (
        <Alert tone="warning" title="Похожий контакт уже есть в базе">
          У {candidate.duplicate_contact_count}{" "}
          {candidate.duplicate_contact_count === 1 ? "кандидата" : "кандидатов"} совпадает телефон или
          Telegram. Проверьте, не дубль ли это, карточка открыта в обычном режиме.
        </Alert>
      ) : null}

      <div className={styles.grid}>
        <Section title="Контакты">
          <Row label="Телефон" value={<a href={`tel:${candidate.phone}`}>{candidate.phone}</a>} />
          <Row label="Telegram" value={candidate.telegram ? `@${candidate.telegram.replace(/^@/, "")}` : "—"} />
          <Row label="E-mail" value={candidate.email ?? "—"} />
        </Section>

        <Section title="Вакансия и анкета">
          <Row label="Вакансия" value={vacancyTitles.get(candidate.vacancy_id ?? "") ?? "—"} />
          <Row label="Должность" value={candidate.position ?? "—"} />
          <Row label="Город" value={candidate.city ?? "—"} />
          <Row label="Возраст" value={candidate.age !== null ? `${candidate.age}` : "—"} />
          <Row label="Кто такой" value={candidate.who ? WHO_LABELS[candidate.who] ?? candidate.who : "—"} />
          <Row
            label="Образование"
            value={
              [
                candidate.edu_level ? EDU_LABELS[candidate.edu_level] ?? candidate.edu_level : null,
                candidate.school,
                candidate.specialty,
                candidate.grad_year !== null ? `${candidate.grad_year}` : null,
              ]
                .filter(Boolean)
                .join(" / ") || "—"
            }
          />
          <Row label="Формат занятости" value={candidate.employment ? EMPLOYMENT_LABELS[candidate.employment] ?? candidate.employment : "—"} />
          <Row label="Готов начать" value={candidate.start_date ? formatMoscowDateOnly(candidate.start_date) : "—"} />
          <Row label="Смена" value={candidate.shifts ?? "—"} />
          <Row
            label="Резюме"
            value={
              candidate.resume_url ? (
                <a href={candidate.resume_url} target="_blank" rel="noreferrer noopener">
                  Открыть резюме
                </a>
              ) : (
                "—"
              )
            }
          />
          <Row label="Опыт" value={candidate.experience ?? "—"} />
          <Row label="О себе" value={candidate.about ?? "—"} />
          <Row label="Мероприятие" value={candidate.event ?? "—"} />
        </Section>

        <Section title="Обработка">
          <Row label="Источник" value={SOURCE_LABELS[candidate.source] ?? candidate.source} />
          <Row label="Ответственный" value={responsibleName ?? "—"} />
          <Row label="Подразделение" value={candidate.department ?? "—"} />
          <Row label="Приоритет" value={PRIORITY_LABELS[candidate.priority] ?? candidate.priority} />
          <Row label="Ожидания по зарплате" value={candidate.expected_salary ? `${candidate.expected_salary} ₽` : "—"} />
          <Row label="Собеседование" value={candidate.interview_at ? formatMoscow(candidate.interview_at) : "—"} />
          <Row label="Следующий контакт" value={candidate.next_contact_at ? formatMoscow(candidate.next_contact_at) : "—"} />
          <Row label="Следующий шаг" value={candidate.next_step ?? "—"} />
          <Row
            label="Основание обработки"
            value={
              candidate.processing_basis === "candidate_consent"
                ? "Согласие кандидата"
                : `Иное документальное основание${candidate.processing_basis_note ? `: ${candidate.processing_basis_note}` : ""}`
            }
          />
        </Section>

        <Section title="Служебные данные">
          <Row label="Кто заполнил" value={creatorName ?? (candidate.source === "public_form" ? "Анкета с сайта" : "—")} />
          <Row label="Версия карточки" value={`${candidate.version}`} />
          <Row label="Создана" value={formatMoscow(candidate.created_at)} />
          <Row label="Обновлена" value={formatMoscow(candidate.updated_at)} />
          <Row label="Согласие получено" value={formatMoscow(candidate.consent_at)} />
          <Row label="Хранение до" value={formatMoscow(candidate.retention_due_at)} />
        </Section>
      </div>

      <CommentsSection
        id={id}
        comments={commentsQuery.data}
        pending={commentsQuery.isPending}
        error={commentsQuery.error instanceof Error ? commentsQuery.error.message : null}
      />

      <DeleteDialog
        open={deleteOpen}
        pending={deleteMutation.isPending}
        error={deleteError}
        lastName={candidate.last_name}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(candidate.version)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.sectionCard}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <dl className={styles.rows}>{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CommentsSection({
  id,
  comments,
  pending,
  error,
}: {
  id: string;
  comments: CommentPage | undefined;
  pending: boolean;
  error: string | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const commentMutation = useMutation({
    mutationFn: (text: string) => addComment(id, text),
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({ queryKey: [...CANDIDATES_KEY, "comments", id] });
      const previous = queryClient.getQueryData<CommentPage>([...CANDIDATES_KEY, "comments", id]);
      if (previous !== undefined && user !== null) {
        const optimistic: CommentView = {
          id: `optimistic-${randomUUID()}`,
          candidate_id: id,
          created_by: user.id,
          created_at: new Date().toISOString(),
          body: text,
          author_name: `${user.last_name} ${user.first_name}`,
        };
        queryClient.setQueryData([...CANDIDATES_KEY, "comments", id], {
          ...previous,
          items: [...previous.items, optimistic],
          total: previous.total + 1,
        });
      }
      return { previous };
    },
    onError: (mutationError, _text, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData([...CANDIDATES_KEY, "comments", id], context.previous);
      }
      setCommentError(
        mutationError instanceof Error ? mutationError.message : "Комментарий не отправился",
      );
    },
    onSuccess: () => {
      setBody("");
      setCommentError(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...CANDIDATES_KEY, "comments", id] });
    },
  });

  const submit = () => {
    const text = body.trim();
    if (text === "") {
      return;
    }
    commentMutation.mutate(text);
  };

  return (
    <section className={styles.sectionCard} aria-label="Комментарии">
      <h2 className={styles.sectionTitle}>Комментарии{comments ? ` · ${comments.total}` : ""}</h2>
      {error ? (
        <Alert tone="error" title="Комментарии не загрузились">
          {error}
        </Alert>
      ) : pending ? (
        <Spinner label="Загружаем комментарии" />
      ) : (comments?.items.length ?? 0) === 0 ? (
        <p className={styles.noComments}>Пока никто ничего не написал.</p>
      ) : (
        <ul className={styles.comments}>
          {comments?.items.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <p className={styles.commentMeta}>
                <strong>{comment.author_name}</strong>{" "}
                <time dateTime={comment.created_at}>{formatMoscow(comment.created_at)}</time>
              </p>
              <p className={styles.commentBody}>{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      {comments !== undefined && comments.items.length < comments.total ? (
        <p className={styles.moreComments}>Показаны первые {comments.items.length} из {comments.total}</p>
      ) : null}
      <form
        className={styles.commentForm}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Textarea
          label="Новый комментарий"
          hint="Виден всем сотрудникам. До 4000 символов."
          value={body}
          maxLength={4000}
          onChange={(event) => setBody(event.target.value)}
        />
        {commentError ? (
          <Alert tone="error" title="Комментарий не отправился">
            {commentError}
          </Alert>
        ) : null}
        <div>
          <Button
            size="sm"
            type="submit"
            disabled={body.trim() === "" || commentMutation.isPending}
          >
            {commentMutation.isPending ? "Отправляем…" : "Добавить комментарий"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function DeleteDialog({
  open,
  pending,
  error,
  lastName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  lastName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const matches = confirmText.trim() === lastName;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setConfirmText("");
        onCancel();
      }}
      title="Удалить карточку?"
      footer={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setConfirmText("");
              onCancel();
            }}
          >
            Отмена
          </Button>
          <Button size="sm" className={styles.danger} disabled={!matches || pending} onClick={onConfirm}>
            {pending ? "Удаляем…" : "Удалить навсегда"}
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="error" title="Не удалось удалить">
          {error}
        </Alert>
      ) : null}
      <p>
        Карточка, комментарии и все данные кандидата будут удалены безвозвратно. Отменить действие
        нельзя.
      </p>
      <Field
        label={`Для подтверждения введите фамилию кандидата: ${lastName}`}
        required
        error={confirmText !== "" && !matches ? "Фамилия не совпадает" : undefined}
      >
        <input
          className={styles.confirmInput}
          value={confirmText}
          autoComplete="off"
          onChange={(event) => setConfirmText(event.target.value)}
        />
      </Field>
    </Dialog>
  );
}
