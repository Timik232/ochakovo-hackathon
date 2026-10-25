"""Operator entrypoint: uv run python -m app.cli --help. No password env/argv."""

import argparse
import getpass
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import STATUSES, Candidate, Employee, Vacancy
from app.models import Session as EmployeeSession
from app.security.passwords import hash_password
from app.services.lifecycle import (
    LifecycleError,
    activate_privacy,
    admin_lock,
    audit,
    cleanup,
)

# Content copied from the read-only v4 prototype server.js SEED_VACANCIES.
DEMO_VACANCIES = (
    ("lab", "Лаборант / химик-лаборант", "Лаборатория", "от 60 000 ₽", "funnel"),
    ("rozliv", "Оператор линии розлива", "Цех розлива", "от 70 000 ₽", "bottle"),
    ("tech", "Оператор технологического цеха", "Технологический цех", "от 70 000 ₽", "kettle"),
    ("sklad", "Оператор склада", "Складской комплекс", "от 60 000 ₽", "crate"),
    ("kladov", "Кладовщик", "Складской комплекс", "от 56 000 ₽", "crate"),
    (
        "mash",
        "Машинист оборудования / оператор котельной",
        "Производство",
        "по итогам собеседования",
        "tank",
    ),
    ("technolog", "Технолог", "Отдел новых вкусов", "по итогам собеседования", "hops"),
    ("free", "Бесплатная практика по договорённости", "Разные отделы", "учебная практика", "wheat"),
    ("open", "Пока не знаю — открыт к предложениям", "Любой отдел", "", "can"),
)


def _seed_demo(db: Session, count: int) -> None:
    vacancies = []
    for sort, (slug, title, dept, pay, icon) in enumerate(DEMO_VACANCIES, 1):
        vacancy = db.scalar(select(Vacancy).where(Vacancy.slug == slug))
        if vacancy is None:
            vacancy = Vacancy(
                slug=slug, title=title, dept=dept, pay=pay, icon=icon, schedule="", sort=sort * 10
            )
            db.add(vacancy)
        vacancies.append(vacancy)
    actor = db.scalar(select(Employee).where(Employee.email == "seed-demo@example.test"))
    if actor is None:
        actor = Employee(
            email="seed-demo@example.test",
            first_name="Тест",
            last_name="Демо-оператор",
            position="Синтетический сотрудник",
            password_hash="unusable-demo-fixture",
            role="staff",
            state="active",
        )
        db.add(actor)
    db.flush()
    for i in range(count):
        minor = i < 2
        staff = minor or i % 3 == 0
        vacancy = vacancies[7] if minor else vacancies[i % len(vacancies)]
        candidate = Candidate(
            first_name="Тест",
            last_name=f"Синтетический-{i}",
            phone="+79990000001",
            position=vacancy.title,
            city="Тестовый город",
            vacancy_id=vacancy.id,
            source="phone" if staff else "public_form",
            created_by=actor.id if staff else None,
            processing_basis="candidate_consent",
            telegram=f"@synthetic_demo_{i}",
            age=16 + i if minor else 18 + i % 50,
            who="school" if minor else ("student", "graduate", "working", "other")[i % 4],
            edu_level=("school", "college", "bachelor", "master", "other")[i % 5],
            school="Синтетическое учебное заведение",
            specialty="Тестовая специальность",
            grad_year=2027 if minor else 2020 + i % 8,
            employment="practice" if minor else ("full", "part", "practice", "internship")[i % 4],
            shifts="По договорённости",
            resume_url=f"https://example.test/resume/{i}",
            about="Синтетическая демонстрационная анкета",
            event="Тестовая ярмарка",
            hot=i % 4 == 0,
            rating=i % 6,
            next_step="Тестовый звонок" if i % 3 == 1 else None,
            archived_at=datetime.now(UTC) if i in (7, 19) else None,
            status=STATUSES[i % len(STATUSES)] if staff else "application",
        )
        db.add(candidate)
        db.flush()
        audit(db, "create", candidate.id)


def _password() -> str:
    password = getpass.getpass("Password (12–128 characters): ")
    if password != getpass.getpass("Repeat password: "):
        raise LifecycleError("Passwords do not match")
    return hash_password(password)


def _employee_command(db: Session, command: str, email: str) -> None:
    admin_lock(db)
    email = email.strip().lower()
    if len(email) > 254 or email.count("@") != 1 or any(c.isspace() for c in email):
        raise LifecycleError("Invalid email")
    employee = db.scalar(select(Employee).where(Employee.email == email))
    if command == "bootstrap-admin":
        if db.scalar(
            select(Employee.id).where(Employee.role == "admin", Employee.state == "active")
        ):
            raise LifecycleError("Active admin already exists; no changes made")
        if employee:
            raise LifecycleError("Employee already exists; use promote-admin; no changes made")
        employee = Employee(
            email=email,
            first_name=input("First name: ").strip(),
            last_name=input("Last name: ").strip(),
            position=input("Position: ").strip(),
            password_hash=_password(),
            role="admin",
            state="active",
        )
        db.add(employee)
        db.flush()
        audit(db, "bootstrap_admin", employee.id, ["role", "state"])
    elif employee is None:
        raise LifecycleError("Employee not found")
    elif command == "promote-admin":
        if employee.role == "admin" and employee.state == "active":
            raise LifecycleError("Active admin already exists; no changes made")
        employee.role, employee.state = "admin", "active"
        audit(db, "promote_admin", employee.id, ["role", "state"])
    else:
        if command == "reset-admin-password" and employee.role != "admin":
            raise LifecycleError("Target is not an admin")
        employee.password_hash = _password()
        employee.must_change_password = True
        audit(db, "reset_password", employee.id, ["password_hash", "must_change_password"])
        db.execute(delete(EmployeeSession).where(EmployeeSession.employee_id == employee.id))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    for command in ("bootstrap-admin", "promote-admin", "reset-password", "reset-admin-password"):
        sub = commands.add_parser(command)
        sub.add_argument("--email", required=True)
    privacy = commands.add_parser("privacy-activate")
    privacy.add_argument(
        "--allow-http-origin",
        action="store_true",
        help="Disposable test/development HTTP origin only",
    )
    commands.add_parser("cleanup")
    seed = commands.add_parser("seed-demo")
    seed.add_argument("--count", type=int, default=45)
    return root


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    settings = get_settings()
    try:
        if (
            args.command == "privacy-activate"
            and args.allow_http_origin
            and settings.app_env not in {"test", "development"}
        ):
            raise LifecycleError("HTTP origin is allowed only test or development")
        # Guard before engine/session access: production never seeds, even with a test policy.
        if args.command == "seed-demo" and settings.app_env not in {"demo", "test"}:
            raise LifecycleError(
                "seed-demo refused: APP_ENV must be demo or test, never production"
            )
        from app.db import SessionLocal

        with SessionLocal.begin() as db:
            if args.command in {
                "bootstrap-admin",
                "promote-admin",
                "reset-password",
                "reset-admin-password",
            }:
                _employee_command(db, args.command, args.email)
            elif args.command == "privacy-activate":
                identity = input("Operator identity: ").strip()
                notice = Path(input("Privacy notice file: ").strip()).read_text(encoding="utf-8")
                consent = Path(input("Consent file: ").strip()).read_text(encoding="utf-8")
                revision = int(input("Revision: "))
                retention = int(input("Retention days (1–365): "))
                authorized = (
                    input("Owner accepts legal responsibility and confirms authority? [yes]: ")
                    == "yes"
                )
                https_verified = (
                    input(f"Verified HTTPS origin {settings.app_origin}? [yes]: ") == "yes"
                )
                activate_privacy(
                    db,
                    operator_identity=identity,
                    notice=notice,
                    consent=consent,
                    revision=revision,
                    retention_days=retention,
                    authorized=authorized and https_verified,
                    origin=settings.app_origin,
                    allow_http_origin=args.allow_http_origin,
                )
            elif args.command == "cleanup":
                print(cleanup(db))
            else:
                if not 1 <= args.count <= 10000:
                    raise LifecycleError("Demo count must be 1–10000")
                _seed_demo(db, args.count)
        print("Completed")
        return 0
    except LifecycleError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except (ValueError, OSError, RuntimeError, EOFError):
        # Safe generic message for unexpected input/crypto/file failures (paths may be sensitive).
        print(
            "Operation refused: invalid input, policy or unavailable secure password provider",
            file=sys.stderr,
        )
        return 1
    except SQLAlchemyError:
        print("Operation refused: database constraint or connection failure", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
