import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  LayoutDashboard,
  Armchair,
  Clock3,
  Trophy,
  LogOut,
  Bell,
  ChevronRight,
  Flame,
  Target,
  Star,
  Check,
  X,
  Users,
  Search,
  Settings,
  ClipboardCheck,
  Menu,
  Power,
  Sparkles,
  Medal,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  cancelStudyReservation,
  createStudyReservation,
  saveStudySettings,
  seedStudyRoom,
  subscribeStudySettings,
  subscribeMyReservations,
  subscribeToCollection,
  updateReservationStatus,
  updateSeat,
  updateStudent,
} from "./services/firestore";
import "./styles.css";

const days = [
  { day: "월", date: "14" },
  { day: "화", date: "15" },
  { day: "수", date: "16" },
  { day: "목", date: "17" },
  { day: "금", date: "18" },
];
const standardPeriods = [
  { id: 1, label: "1교시", start: "15:40", end: "17:00" },
  { id: 2, label: "2교시", start: "17:20", end: "18:40" },
  { id: 3, label: "3교시", start: "19:00", end: "20:00" },
  { id: 4, label: "4교시", start: "20:10", end: "21:00" },
];
const standardWeeklySchedule = {
  월: [2, 3, 4],
  화: [1, 2, 3, 4],
  수: [2, 3, 4],
  목: [1, 2, 3, 4],
  금: [1, 2, 3, 4],
};
const initialStudents = [
  {
    id: 1,
    no: "20101",
    name: "김민서",
    seat: "A-03",
    time: "18:00 – 21:00",
    status: "출석",
    minutes: 182,
    streak: 7,
  },
  {
    id: 2,
    no: "20104",
    name: "이준호",
    seat: "A-07",
    time: "18:00 – 21:00",
    status: "학습 중",
    minutes: 74,
    streak: 4,
  },
  {
    id: 3,
    no: "20208",
    name: "박서윤",
    seat: "B-02",
    time: "19:00 – 22:00",
    status: "신청",
    minutes: 0,
    streak: 2,
  },
  {
    id: 4,
    no: "20311",
    name: "최도윤",
    seat: "B-09",
    time: "18:00 – 20:00",
    status: "지각",
    minutes: 96,
    streak: 6,
  },
  {
    id: 5,
    no: "20403",
    name: "정하린",
    seat: "C-05",
    time: "18:00 – 21:00",
    status: "출석",
    minutes: 178,
    streak: 9,
  },
];
const seats = Array.from({ length: 24 }, (_, i) => ({
  id: `${String.fromCharCode(65 + Math.floor(i / 8))}-${String((i % 8) + 1).padStart(2, "0")}`,
  taken: false,
}));

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast">
      <Check size={17} />
      {message}
    </div>
  );
}

function Logo({ onClick }) {
  const content = (
    <>
      <span className="logo-mark">
        <Power />
      </span>
      <span>
        Study<b>ON</b>
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="logo logo-button"
      onClick={onClick}
      aria-label="초기화면으로 이동"
    >
      {content}
    </button>
  ) : (
    <div className="logo">{content}</div>
  );
}

function Sidebar({
  role,
  page,
  setPage,
  open,
  setOpen,
  user,
  profile,
  onLogout,
}) {
  const student = [
    ["home", LayoutDashboard, "홈"],
    ["apply", CalendarDays, "자율학습 신청"],
    ["records", Clock3, "학습 기록"],
    ["rewards", Trophy, "포인트 & 배지"],
  ];
  const teacher = [
    ["admin", LayoutDashboard, "운영 현황"],
    ["attendance", ClipboardCheck, "출결 관리"],
    ["seats", Armchair, "좌석 배치"],
    ["students", Users, "학생 관리"],
    ["settings", Settings, "운영 설정"],
  ];
  return (
    <>
      <div className={`sidebar ${open ? "open" : ""}`}>
        <Logo
          onClick={() => {
            setPage(role === "teacher" ? "admin" : "home");
            setOpen(false);
          }}
        />
        <button className="side-close" onClick={() => setOpen(false)}>
          <X />
        </button>
        <nav>
          {(role === "student" ? student : teacher).map(([id, Icon, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                setOpen(false);
              }}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="profile">
            <div className="avatar">
              {(profile?.name || user?.email || "U")[0]}
            </div>
            <div>
              <strong>
                {profile?.name || user?.displayName || "StudyON 사용자"}
              </strong>
              <span>
                {role === "teacher"
                  ? "교사 · 관리자"
                  : profile?.studentNumber || user?.email}
              </span>
            </div>
          </div>
          <button
            className="logout"
            aria-label="로그아웃"
            title="로그아웃"
            onClick={onLogout}
          >
            <LogOut />
          </button>
        </div>
      </div>
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
    </>
  );
}

function Header({ role, setRole, setPage, setOpen, canManage, profile, user }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return (
    <header>
      <button className="menu" onClick={() => setOpen(true)}>
        <Menu />
      </button>
      {canManage && (
        <div className="role-switch">
          <button
            className={role === "student" ? "on" : ""}
            onClick={() => {
              setRole("student");
              setPage("home");
            }}
          >
            학생 화면
          </button>
          <button
            className={role === "teacher" ? "on" : ""}
            onClick={() => {
              setRole("teacher");
              setPage("admin");
            }}
          >
            교사 화면
          </button>
        </div>
      )}
      <div className="header-right">
        <button
          className="bell"
          aria-label="알림 보기"
          onClick={() => setNotificationsOpen((value) => !value)}
        >
          <Bell />
        </button>
        {notificationsOpen && (
          <div className="notification-popover">
            <div>
              <b>알림</b>
              <button onClick={() => setNotificationsOpen(false)}>
                <X />
              </button>
            </div>
            <span className="notification-empty">
              <Bell />
              <b>새로운 알림이 없습니다</b>
              <small>신청 및 출결 변경 알림이 여기에 표시됩니다.</small>
            </span>
          </div>
        )}
        <button
          className="header-avatar"
          aria-label="마이페이지로 이동"
          title="마이페이지"
          onClick={() => {
            setPage("mypage");
            setNotificationsOpen(false);
          }}
        >
          {(profile?.name || user?.email || "U")[0]}
        </button>
      </div>
    </header>
  );
}

const authMessages = {
  "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "auth/email-already-in-use": "이미 가입된 이메일입니다.",
  "auth/weak-password": "비밀번호는 6자 이상 입력해 주세요.",
  "auth/invalid-email": "올바른 이메일 주소를 입력해 주세요.",
  "auth/too-many-requests": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  "auth/network-request-failed": "네트워크 연결을 확인해 주세요.",
};

function LoginPage() {
  const [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [studentNumber, setStudentNumber] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(result.user, { displayName: name });
        await setDoc(doc(db, "users", result.user.uid), {
          uid: result.user.uid,
          name,
          studentNumber,
          className: "",
          role: "student",
          points: 0,
          streak: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(authMessages[err.code] || "로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setError("");
    setNotice("");
    if (!email) {
      setError("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice("비밀번호 재설정 메일을 보냈습니다.");
    } catch (err) {
      setError(authMessages[err.code] || "재설정 메일을 보내지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-brand">
        <Logo />
        <div>
          <span className="eyebrow">STUDY BETTER, GROW TOGETHER</span>
          <h1>
            오늘의 집중이
            <br />
            <em>내일의 가능성</em>이 됩니다.
          </h1>
          <p>
            신청부터 좌석, 출결, 학습 기록까지.
            <br />
            StudyON에서 나의 성장을 이어가세요.
          </p>
        </div>
        <div className="auth-features">
          <span>
            <CalendarDays />
            간편한 학습 신청
          </span>
          <span>
            <Armchair />
            실시간 좌석 확인
          </span>
          <span>
            <Trophy />
            성장을 위한 보상
          </span>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-logo">
            <Logo />
          </div>
          <span className="eyebrow">WELCOME TO STUDYON</span>
          <h2>
            {mode === "login"
              ? "다시 만나서 반가워요!"
              : "StudyON을 시작해 볼까요?"}
          </h2>
          <p>
            {mode === "login"
              ? "등록된 계정으로 로그인해 주세요."
              : "학생 정보를 입력해 계정을 만드세요."}
          </p>
          {mode === "signup" && (
            <div className="auth-inline">
              <label>
                이름
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                />
              </label>
              <label>
                학번
                <input
                  required
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="20101"
                />
              </label>
            </div>
          )}
          <label>
            이메일
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.kr"
              autoComplete="email"
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              required
              minLength="6"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {mode === "login" && (
            <button type="button" className="forgot" onClick={reset}>
              비밀번호를 잊으셨나요?
            </button>
          )}
          {error && <div className="auth-alert error">{error}</div>}
          {notice && (
            <div className="auth-alert success">
              <Check />
              {notice}
            </div>
          )}
          <button className="auth-submit" disabled={busy}>
            {busy
              ? "처리 중..."
              : mode === "login"
                ? "로그인"
                : "학생 계정 만들기"}
            <ChevronRight />
          </button>
          <div className="auth-divider">
            <span>또는</span>
          </div>
          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setNotice("");
            }}
          >
            {mode === "login"
              ? "아직 계정이 없나요? 회원가입"
              : "이미 계정이 있나요? 로그인"}
          </button>
          <small className="auth-help">
            교사 계정은 학교 관리자에게 문의해 주세요.
          </small>
        </form>
      </section>
    </div>
  );
}

const Progress = ({ value }) => (
  <div className="progress">
    <i style={{ width: `${value}%` }} />
  </div>
);

function StudentHome({ setPage, checkedIn, toggleCheck, studentName }) {
  return (
    <div className="page">
      <section className="welcome">
        <div>
          <span className="eyebrow">2026년 9월 14일 월요일</span>
          <h1>
            {studentName}님, 오늘도 <em>함께 성장해요.</em>
          </h1>
          <p>
            꾸준한 하루가 더 나은 내일을 만들어요. 오늘의 학습도 힘차게 시작해
            볼까요?
          </p>
        </div>
        <div className="streak-orb">
          <Flame />
          <strong>7</strong>
          <span>일 연속 학습 중</span>
        </div>
      </section>
      <div className="stats-grid">
        <div className="stat">
          <span className="icon mint">
            <Clock3 />
          </span>
          <div>
            <small>이번 달 학습시간</small>
            <strong>32시간 40분</strong>
            <span className="up">↑ 지난달보다 12%</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon blue">
            <CalendarDays />
          </span>
          <div>
            <small>이번 달 참여</small>
            <strong>12회</strong>
            <span>목표까지 3회 남았어요</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon yellow">
            <Star />
          </span>
          <div>
            <small>나의 포인트</small>
            <strong>1,280 P</strong>
            <span className="up">이번 달 +320P</span>
          </div>
        </div>
      </div>
      <div className="main-grid">
        <div className="left-col">
          <div className="section-head">
            <div>
              <span className="eyebrow">TODAY'S STUDY</span>
              <h2>오늘의 자율학습</h2>
            </div>
            <button className="text-btn" onClick={() => setPage("apply")}>
              일정 보기 <ChevronRight />
            </button>
          </div>
          <div className="today-card">
            <div className="date-box">
              <b>14</b>
              <span>9월 · 월요일</span>
            </div>
            <div className="today-detail">
              <span className="status-dot">신청 완료</span>
              <h3>야간 자율학습</h3>
              <p>
                <Clock3 /> 오후 6:00 – 9:00 <span>·</span> <Armchair /> A-03
                좌석
              </p>
            </div>
            <button
              className={checkedIn ? "outline-button" : "primary-button"}
              onClick={toggleCheck}
            >
              {checkedIn ? "퇴실하기" : "입실하기"}
            </button>
          </div>
          <div className="section-head">
            <div>
              <span className="eyebrow">WEEKLY SCHEDULE</span>
              <h2>이번 주 일정</h2>
            </div>
          </div>
          <div className="week-card">
            {days.map((d, i) => (
              <div
                className={`week-day ${i === 0 ? "today" : ""} ${i === 2 ? "off" : ""}`}
                key={d.day}
              >
                <span>{d.day}</span>
                <b>{d.date}</b>
                <i>{i === 2 ? "휴식" : i === 4 ? "미신청" : "18:00"}</i>
              </div>
            ))}
          </div>
        </div>
        <aside className="right-col">
          <div className="challenge-card">
            <div className="challenge-icon">
              <Target />
            </div>
            <span className="eyebrow">SEPTEMBER CHALLENGE</span>
            <h2>이달의 꾸준이</h2>
            <p>
              9월에 15회 이상 참여하고
              <br />
              특별 배지와 150P를 받아요!
            </p>
            <div className="challenge-count">
              <span>
                <b>12</b> / 15회
              </span>
              <em>80%</em>
            </div>
            <Progress value={80} />
            <small>단 3번만 더 참여하면 달성!</small>
          </div>
          <div className="badge-card">
            <div className="section-head">
              <h2>최근 받은 배지</h2>
              <button className="text-btn" onClick={() => setPage("rewards")}>
                전체보기
              </button>
            </div>
            <div className="badges">
              <div>
                <span className="badge green">
                  <Flame />
                </span>
                <b>연속 학습</b>
                <small>7일 달성</small>
              </div>
              <div>
                <span className="badge amber">
                  <Medal />
                </span>
                <b>첫 도전</b>
                <small>첫 참여 완료</small>
              </div>
              <div>
                <span className="badge purple">
                  <Sparkles />
                </span>
                <b>성실 출석</b>
                <small>지각 0회</small>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ApplyPage({ notify, user, profile }) {
  const [day, setDay] = useState(0),
    [selectedPeriodIds, setSelectedPeriodIds] = useState([2]),
    [seat, setSeat] = useState(""),
    [studySettings, setStudySettings] = useState(null),
    [myReservations, setMyReservations] = useState([]),
    [submitting, setSubmitting] = useState(false),
    [reservationError, setReservationError] = useState("");
  useEffect(
    () =>
      subscribeStudySettings(
        (data) => setStudySettings(data),
        () => {},
      ),
    [],
  );
  useEffect(
    () =>
      subscribeMyReservations(user.uid, setMyReservations, () =>
        setReservationError(
          "신청 내역을 불러오지 못했습니다. Firestore 규칙을 확인해 주세요.",
        ),
      ),
    [user.uid],
  );
  const configuredPeriods = studySettings?.periods || standardPeriods;
  const configuredSchedule =
    studySettings?.weeklySchedule || standardWeeklySchedule;
  const availablePeriods = configuredPeriods.filter((period) =>
    (configuredSchedule[days[day].day] || []).includes(period.id),
  );
  const selectedDate = `2026-09-${days[day].date}`;
  const alreadyReservedPeriodIds = [
    ...new Set(
      myReservations
        .filter(
          (reservation) =>
            reservation.date === selectedDate &&
            reservation.status !== "cancelled",
        )
        .flatMap((reservation) => {
          if (reservation.periodIds?.length) return reservation.periodIds;
          return configuredPeriods
            .filter((period) => reservation.timeSlot?.includes(period.label))
            .map((period) => period.id);
        }),
    ),
  ];
  useEffect(() => {
    const availableIds = availablePeriods.map((period) => period.id);
    setSelectedPeriodIds((current) =>
      current.filter(
        (id) =>
          availableIds.includes(id) && !alreadyReservedPeriodIds.includes(id),
      ),
    );
  }, [day, studySettings, myReservations]);
  const selectedPeriods = availablePeriods.filter((period) =>
    selectedPeriodIds.includes(period.id),
  );
  const selectedPeriodSummary = selectedPeriods
    .map((period) => `${period.label} ${period.start}–${period.end}`)
    .join(", ");
  const togglePeriod = (periodId) =>
    setSelectedPeriodIds((current) =>
      current.includes(periodId)
        ? current.filter((id) => id !== periodId)
        : [...current, periodId].sort(),
    );
  const submitReservation = async () => {
    if (!seat || !selectedPeriods.length) return;
    setSubmitting(true);
    setReservationError("");
    try {
      await createStudyReservation({
        studentId: user.uid,
        studentName:
          profile?.name ||
          user.displayName ||
          user.email?.split("@")[0] ||
          "학생",
        studentNumber: profile?.studentNumber || "",
        date: selectedDate,
        day: days[day].day,
        periodIds: selectedPeriods.map((period) => period.id),
        timeSlot: selectedPeriodSummary,
        seatId: seat,
      });
      notify(`${seat} 좌석으로 신청이 완료되었어요!`);
      setSeat("");
    } catch (error) {
      if (error.message === "STUDENT_TIME_CONFLICT") {
        setReservationError(
          "이미 신청한 교시가 포함되어 있습니다. 기존 신청 내역을 확인해 주세요.",
        );
      } else if (error.message === "SEAT_TIME_CONFLICT") {
        setReservationError(
          "선택한 교시에 이미 다른 학생이 예약한 좌석입니다. 다른 좌석을 선택해 주세요.",
        );
      } else {
        setReservationError(
          "신청을 저장하지 못했습니다. Firestore 규칙과 네트워크를 확인해 주세요.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };
  const cancelReservation = async (reservation) => {
    try {
      await cancelStudyReservation(reservation.id);
      notify("자율학습 신청을 취소했습니다.");
    } catch {
      notify("신청을 취소하지 못했습니다.");
    }
  };
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">RESERVATION</span>
          <h1>자율학습 신청</h1>
          <p>학습할 날짜와 시간을 선택한 뒤 원하는 좌석을 예약하세요.</p>
        </div>
      </div>
      <div className="apply-grid">
        <section className="panel">
          <h2>
            <b className="step">1</b> 날짜 선택
          </h2>
          <div className="calendar-strip">
            {days.map((d, i) => (
              <button
                className={day === i ? "selected" : ""}
                onClick={() => {
                  setDay(i);
                  setSelectedPeriodIds([]);
                  setSeat("");
                }}
                key={d.date}
              >
                <span>{d.day}</span>
                <b>{d.date}</b>
                <small>9월</small>
              </button>
            ))}
          </div>
          <h2>
            <b className="step">2</b> 교시 선택
            <small className="multi-hint">복수 선택 가능</small>
          </h2>
          <div className="slot-list">
            {availablePeriods.map((period, i) => {
              const alreadyReserved = alreadyReservedPeriodIds.includes(
                period.id,
              );
              return (
                <button
                  className={
                    alreadyReserved
                      ? "already-reserved"
                      : selectedPeriodIds.includes(period.id)
                        ? "selected"
                        : ""
                  }
                  disabled={alreadyReserved}
                  onClick={() => togglePeriod(period.id)}
                  key={period.id}
                >
                  <span>
                    <Clock3 />
                    <b>{period.label}</b> {period.start} – {period.end}
                  </span>
                  <small>
                    {alreadyReserved
                      ? "신청 완료"
                      : `${[17, 14, 11, 8][i]}석 남음`}
                  </small>
                  <Check />
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel seat-panel">
          <div className="section-head">
            <h2>
              <b className="step">3</b> 좌석 선택
            </h2>
            <div className="legend">
              <i />
              선택 가능 <i className="taken" />
              사용 중
            </div>
          </div>
          <div className="board">교탁 · BOARD</div>
          <div className="seat-map">
            {seats.map((s) => (
              <button
                disabled={s.taken}
                className={seat === s.id ? "selected" : ""}
                onClick={() => setSeat(s.id)}
                key={s.id}
              >
                <Armchair />
                <span>{s.id}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="confirm-bar">
        <div>
          <span>
            {days[day].date}일 ({days[day].day})
          </span>
          <strong>
            {selectedPeriodSummary || "교시를 선택해 주세요"} ·{" "}
            {seat ? `${seat} 좌석` : "좌석을 선택해 주세요"}
          </strong>
        </div>
        <button
          className="primary-button"
          disabled={!seat || selectedPeriodIds.length === 0 || submitting}
          onClick={submitReservation}
        >
          {submitting ? "신청 중..." : "이 일정으로 신청하기"}
        </button>
      </div>
      <section className="my-reservations">
        <div className="section-head">
          <div>
            <span className="eyebrow">MY RESERVATIONS</span>
            <h2>나의 신청 내역</h2>
          </div>
          <span className="reservation-count">
            {
              myReservations.filter((item) => item.status !== "cancelled")
                .length
            }
            건
          </span>
        </div>
        {reservationError && (
          <div className="db-banner">
            <strong>신청 내역 확인</strong>
            <span>{reservationError}</span>
          </div>
        )}
        <div className="reservation-list">
          {myReservations.length ? (
            myReservations.map((item) => (
              <article
                className={`reservation-card ${item.status === "cancelled" ? "cancelled" : ""}`}
                key={item.id}
              >
                <div className="reservation-date">
                  <b>{item.date?.slice(8)}일</b>
                  <span>{item.day || ""}요일</span>
                </div>
                <div className="reservation-info">
                  <span className="reservation-status">
                    {item.status === "cancelled"
                      ? "신청 취소"
                      : item.attendanceStatus || "신청 완료"}
                  </span>
                  <h3>{item.timeSlot}</h3>
                  <p>
                    <Armchair /> {item.seatId} 좌석
                  </p>
                </div>
                {item.status !== "cancelled" &&
                  item.attendanceStatus === "신청" && (
                    <button
                      className="cancel-button"
                      onClick={() => cancelReservation(item)}
                    >
                      신청 취소
                    </button>
                  )}
              </article>
            ))
          ) : (
            <div className="panel student-empty compact">
              <span className="empty-illustration">
                <CalendarDays />
              </span>
              <h2>아직 신청한 일정이 없습니다</h2>
              <p>위에서 원하는 날짜와 교시, 좌석을 선택해 주세요.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function RecordsPage() {
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">MY STUDY</span>
          <h1>학습 기록</h1>
          <p>꾸준히 쌓아온 나의 공부 시간을 확인해 보세요.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <span className="icon mint">
            <BookOpen />
          </span>
          <div>
            <small>누적 학습시간</small>
            <strong>128시간 20분</strong>
            <span>총 48회 참여</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon blue">
            <TrendingUp />
          </span>
          <div>
            <small>이번 주</small>
            <strong>11시간 30분</strong>
            <span className="up">목표의 76%</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon yellow">
            <Flame />
          </span>
          <div>
            <small>최장 연속 학습</small>
            <strong>9일</strong>
            <span>현재 7일째</span>
          </div>
        </div>
      </div>
      <section className="panel chart-panel">
        <div className="section-head">
          <div>
            <h2>주간 학습시간</h2>
            <p>지난주보다 1시간 20분 더 공부했어요</p>
          </div>
          <button className="select-button">최근 7일⌄</button>
        </div>
        <div className="chart">
          {[62, 85, 54, 100, 78, 35, 20].map((h, i) => (
            <div key={i}>
              <span style={{ height: `${h}%` }} />
              <small>{["월", "화", "수", "목", "금", "토", "일"][i]}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel history">
        <h2>최근 학습 기록</h2>
        {[
          ["9월 14일", "야간 자율학습", "3시간 02분", "출석"],
          ["9월 11일", "방과후 자율학습", "2시간 46분", "출석"],
          ["9월 10일", "야간 자율학습", "2시간 55분", "출석"],
          ["9월 9일", "야간 자율학습", "3시간 10분", "출석"],
        ].map((r) => (
          <div className="history-row" key={r[0]}>
            <span className="history-icon">
              <BookOpen />
            </span>
            <div>
              <b>{r[1]}</b>
              <small>{r[0]}</small>
            </div>
            <strong>{r[2]}</strong>
            <em>{r[3]}</em>
          </div>
        ))}
      </section>
    </div>
  );
}

function RewardsPage() {
  return (
    <div className="page">
      <div className="reward-hero">
        <div>
          <span className="eyebrow">MY REWARDS</span>
          <h1>꾸준함이 만든 반짝이는 기록</h1>
          <p>새로운 도전을 달성하고 포인트와 배지를 모아보세요.</p>
        </div>
        <div className="points">
          <Star />
          <div>
            <small>보유 포인트</small>
            <strong>1,280 P</strong>
          </div>
        </div>
      </div>
      <div className="section-head">
        <div>
          <span className="eyebrow">ACTIVE CHALLENGES</span>
          <h2>진행 중인 챌린지</h2>
        </div>
      </div>
      <div className="reward-grid">
        {[
          ["이달의 꾸준이", "이번 달 15회 이상 참여", "12 / 15회", 80, "+150P"],
          ["목표 학습시간", "이번 달 40시간 학습", "32h 40m", 82, "+100P"],
          ["퍼펙트 위크", "이번 주 신청 일정 모두 참여", "4 / 5회", 80, "+70P"],
        ].map((c, i) => (
          <div className="reward-card" key={c[0]}>
            <span className={`badge ${["green", "purple", "amber"][i]}`}>
              {i === 0 ? <Flame /> : i === 1 ? <Target /> : <Trophy />}
            </span>
            <em>{c[4]}</em>
            <h3>{c[0]}</h3>
            <p>{c[1]}</p>
            <div>
              <b>{c[2]}</b>
              <small>{c[3]}%</small>
            </div>
            <Progress value={c[3]} />
          </div>
        ))}
      </div>
      <div className="section-head badge-heading">
        <div>
          <span className="eyebrow">BADGE COLLECTION</span>
          <h2>나의 배지 컬렉션</h2>
        </div>
        <span>4 / 8 획득</span>
      </div>
      <div className="collection">
        {[
          ["첫 도전", "첫 자율학습 참여", true],
          ["연속 학습", "5일 연속 참여", true],
          ["성실 출석", "지각 없이 10회", true],
          ["목표 달성", "월 목표 달성", true],
          ["이달의 꾸준이", "월 15회 참여", false],
          ["퍼펙트 위크", "주간 일정 모두 참여", false],
        ].map((b, i) => (
          <div className={!b[2] ? "locked" : ""} key={b[0]}>
            <span
              className={`badge ${["amber", "green", "purple", "blue", "green", "amber"][i]}`}
            >
              {i % 3 === 0 ? <Medal /> : i % 3 === 1 ? <Flame /> : <Star />}
            </span>
            <b>{b[0]}</b>
            <small>{b[1]}</small>
            {b[2] && (
              <i>
                <Check />
              </i>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherDashboard({ students, setStudents, notify, page }) {
  const [query, setQuery] = useState("");
  const filtered = students.filter(
    (s) => s.name.includes(query) || s.no.includes(query),
  );
  const update = (id, status) => {
    setStudents((v) => v.map((s) => (s.id === id ? { ...s, status } : s)));
    notify("출결 상태가 변경되었습니다.");
  };
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">ADMIN DASHBOARD</span>
          <h1>
            {page === "attendance"
              ? "출결 관리"
              : page === "seats"
                ? "좌석 배치"
                : page === "students"
                  ? "학생 관리"
                  : "오늘의 운영 현황"}
          </h1>
          <p>2026년 9월 14일 월요일 · 야간 자율학습</p>
        </div>
        <button className="primary-button">
          <Settings /> 운영 설정
        </button>
      </div>
      <div className="stats-grid teacher-stats">
        <div className="stat">
          <span className="icon mint">
            <Users />
          </span>
          <div>
            <small>오늘 신청</small>
            <strong>
              42명 <i>/ 60석</i>
            </strong>
            <span>좌석 이용률 70%</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon blue">
            <ClipboardCheck />
          </span>
          <div>
            <small>현재 출석</small>
            <strong>36명</strong>
            <span className="up">출석률 85.7%</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon yellow">
            <Clock3 />
          </span>
          <div>
            <small>학습 중</small>
            <strong>28명</strong>
            <span>8명 학습 완료</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon red">
            <X />
          </span>
          <div>
            <small>미입실</small>
            <strong>6명</strong>
            <span>지각 2명 포함</span>
          </div>
        </div>
      </div>
      {page === "seats" ? (
        <TeacherSeats />
      ) : (
        <>
          <section className="panel admin-panel">
            <div className="section-head">
              <div>
                <h2>
                  {page === "students" ? "전체 학생" : "신청 및 출결 현황"}
                </h2>
                <p>마지막 업데이트 · 방금 전</p>
              </div>
              <div className="admin-tools">
                <label>
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="이름 또는 학번 검색"
                  />
                </label>
                <button className="select-button">전체 상태⌄</button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>학생</th>
                    <th>좌석</th>
                    <th>신청 시간</th>
                    <th>학습시간</th>
                    <th>연속 참여</th>
                    <th>출결 상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="student-cell">
                          <span>{s.name[0]}</span>
                          <div>
                            <b>{s.name}</b>
                            <small>{s.no}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <b>{s.seat}</b>
                      </td>
                      <td>{s.time}</td>
                      <td>
                        {s.minutes
                          ? `${Math.floor(s.minutes / 60)}시간 ${s.minutes % 60}분`
                          : "—"}
                      </td>
                      <td>
                        <span className="streak">
                          <Flame /> {s.streak}일
                        </span>
                      </td>
                      <td>
                        <select
                          className={`status ${s.status.replace(" ", "")}`}
                          value={s.status}
                          onChange={(e) => update(s.id, e.target.value)}
                        >
                          <option>신청</option>
                          <option>학습 중</option>
                          <option>출석</option>
                          <option>지각</option>
                          <option>결석</option>
                        </select>
                      </td>
                      <td>
                        <button className="more">•••</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function TeacherSeats() {
  return (
    <section className="panel teacher-seats">
      <div className="section-head">
        <div>
          <h2>제1 자율학습실</h2>
          <p>총 60석 · 사용 중 42석</p>
        </div>
        <div className="legend">
          <i />빈 좌석 <i className="active" />
          사용 중 <i className="late" />
          지각
        </div>
      </div>
      <div className="board">교탁 · BOARD</div>
      <div className="seat-map large">
        {Array.from({ length: 40 }, (_, i) => (
          <button
            className={
              i === 9
                ? "late"
                : [
                      1, 3, 4, 7, 10, 12, 13, 17, 19, 21, 22, 25, 27, 30, 31,
                      34, 37,
                    ].includes(i)
                  ? "active"
                  : ""
            }
            key={i}
          >
            <Armchair />
            <span>
              {String.fromCharCode(65 + Math.floor(i / 10))}-
              {String((i % 10) + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TeacherConsole({ notify, page }) {
  const [reservations, setReservations] = useState([]),
    [studentProfiles, setStudentProfiles] = useState([]),
    [roomSeats, setRoomSeats] = useState([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("전체"),
    [loading, setLoading] = useState(true),
    [dbError, setDbError] = useState(""),
    [seeding, setSeeding] = useState(false);
  useEffect(() => {
    let ready = 0;
    const done = () => {
      ready += 1;
      if (ready === 3) setLoading(false);
    };
    const fail = (error) => {
      setDbError(
        error.code === "permission-denied"
          ? "Firestore 규칙이 아직 배포되지 않았거나 교사 권한이 없습니다."
          : "데이터를 불러오지 못했습니다.",
      );
      setLoading(false);
    };
    const unsubscribers = [
      subscribeToCollection(
        "reservations",
        (data) => {
          setReservations(data);
          done();
        },
        fail,
      ),
      subscribeToCollection(
        "users",
        (data) => {
          setStudentProfiles(data.filter((item) => item.role === "student"));
          done();
        },
        fail,
      ),
      subscribeToCollection(
        "seats",
        (data) => {
          setRoomSeats(data);
          done();
        },
        fail,
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);
  const rows = useMemo(
    () =>
      reservations
        .map((item) => {
          const student =
            studentProfiles.find((profile) => profile.id === item.studentId) ||
            {};
          return {
            id: item.id,
            name: item.studentName || student.name || "이름 없음",
            no: item.studentNumber || student.studentNumber || "-",
            seat: item.seatId || "-",
            time: item.timeSlot || "-",
            minutes: item.studyMinutes || 0,
            streak: student.streak || 0,
            status: item.attendanceStatus || "신청",
          };
        })
        .filter(
          (item) =>
            (item.name.includes(query) || item.no.includes(query)) &&
            (filter === "전체" ||
              filter === "오늘 신청" ||
              (filter === "현재 출석" &&
                ["출석", "학습 중"].includes(item.status)) ||
              (filter === "확인 필요" &&
                ["신청", "지각", "결석"].includes(item.status)) ||
              item.status === filter),
        ),
    [reservations, studentProfiles, query, filter],
  );
  const changeStatus = async (id, status) => {
    try {
      await updateReservationStatus(id, status);
      notify("출결 상태가 실시간으로 반영되었습니다.");
    } catch {
      notify("출결 상태를 변경하지 못했습니다.");
    }
  };
  const selectAttendanceMetric = (metric) => {
    if (page !== "attendance") return;
    setFilter(metric);
    setTimeout(
      () =>
        document
          .getElementById("attendance-detail")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const seed = async () => {
    setSeeding(true);
    try {
      await seedStudyRoom(initialStudents);
      notify("기본 운영 데이터가 생성되었습니다.");
    } catch {
      notify("데이터 생성 권한을 확인해 주세요.");
    } finally {
      setSeeding(false);
    }
  };
  const present = reservations.filter((item) =>
      ["출석", "학습 중"].includes(item.attendanceStatus),
    ).length,
    studying = reservations.filter(
      (item) => item.attendanceStatus === "학습 중",
    ).length,
    missing = reservations.filter((item) =>
      ["신청", "지각", "결석"].includes(item.attendanceStatus || "신청"),
    ).length;
  const participationLeaders = useMemo(
    () =>
      studentProfiles
        .map((student) => {
          const activity = reservations.filter(
            (item) =>
              item.studentId === student.id && item.status !== "cancelled",
          );
          const completed = activity.filter((item) =>
            ["출석", "학습 중"].includes(item.attendanceStatus),
          );
          return {
            ...student,
            participationCount: completed.length,
            totalMinutes: activity.reduce(
              (total, item) => total + (item.studyMinutes || 0),
              0,
            ),
          };
        })
        .filter(
          (student) =>
            (student.points || 0) > 0 || student.participationCount > 0,
        )
        .sort(
          (a, b) =>
            (b.points || 0) - (a.points || 0) ||
            b.participationCount - a.participationCount,
        )
        .slice(0, 5),
    [studentProfiles, reservations],
  );
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">ADMIN DASHBOARD</span>
          <h1>
            {page === "attendance"
              ? "출결 관리"
              : page === "seats"
                ? "좌석 배치"
                : page === "students"
                  ? "학생 관리"
                  : "오늘의 운영 현황"}
          </h1>
          <p>
            {new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(
              new Date(),
            )}{" "}
            · 실시간 데이터
          </p>
        </div>
        {!loading && !reservations.length && (
          <button className="primary-button" disabled={seeding} onClick={seed}>
            <Sparkles /> {seeding ? "생성 중" : "기본 데이터 만들기"}
          </button>
        )}
      </div>
      {dbError && (
        <div className="db-banner">
          <strong>데이터 연결 확인</strong>
          <span>{dbError}</span>
        </div>
      )}
      <div className="stats-grid teacher-stats">
        <button
          type="button"
          className={`stat ${page === "attendance" ? "stat-clickable" : ""} ${filter === "오늘 신청" || (filter === "전체" && page === "attendance") ? "selected" : ""}`}
          onClick={() => selectAttendanceMetric("오늘 신청")}
        >
          <span className="icon mint">
            <Users />
          </span>
          <div>
            <small>오늘 신청</small>
            <strong>
              {reservations.length}명 <i>/ {roomSeats.length || 40}석</i>
            </strong>
            <span>실시간 신청 현황</span>
          </div>
        </button>
        <button
          type="button"
          className={`stat ${page === "attendance" ? "stat-clickable" : ""} ${filter === "현재 출석" ? "selected" : ""}`}
          onClick={() => selectAttendanceMetric("현재 출석")}
        >
          <span className="icon blue">
            <ClipboardCheck />
          </span>
          <div>
            <small>현재 출석</small>
            <strong>{present}명</strong>
            <span className="up">
              출석률{" "}
              {reservations.length
                ? Math.round((present / reservations.length) * 100)
                : 0}
              %
            </span>
          </div>
        </button>
        <button
          type="button"
          className={`stat ${page === "attendance" ? "stat-clickable" : ""} ${filter === "학습 중" ? "selected" : ""}`}
          onClick={() => selectAttendanceMetric("학습 중")}
        >
          <span className="icon yellow">
            <Clock3 />
          </span>
          <div>
            <small>학습 중</small>
            <strong>{studying}명</strong>
            <span>현재 학습실 이용</span>
          </div>
        </button>
        <button
          type="button"
          className={`stat ${page === "attendance" ? "stat-clickable" : ""} ${filter === "확인 필요" ? "selected" : ""}`}
          onClick={() => selectAttendanceMetric("확인 필요")}
        >
          <span className="icon red">
            <X />
          </span>
          <div>
            <small>확인 필요</small>
            <strong>{missing}명</strong>
            <span>미입실·지각·결석</span>
          </div>
        </button>
      </div>
      {page === "admin" && (
        <ParticipationLeaderboard
          students={participationLeaders}
          loading={loading}
        />
      )}
      {page === "seats" ? (
        <LiveSeatManager
          seats={roomSeats}
          reservations={reservations}
          notify={notify}
        />
      ) : page === "students" ? (
        <StudentManager
          students={studentProfiles}
          query={query}
          setQuery={setQuery}
          notify={notify}
        />
      ) : page === "attendance" ? (
        <section className="panel admin-panel" id="attendance-detail">
          <div className="section-head">
            <div>
              <h2>신청 및 출결 현황</h2>
              <p>
                {loading
                  ? "Firestore에서 불러오는 중..."
                  : `${rows.length}명의 신청 정보`}
              </p>
            </div>
            <div className="admin-tools">
              <label>
                <Search />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름 또는 학번 검색"
                />
              </label>
              <select
                className="select-button"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>전체</option>
                <option>오늘 신청</option>
                <option>현재 출석</option>
                <option>확인 필요</option>
                <option>신청</option>
                <option>학습 중</option>
                <option>출석</option>
                <option>지각</option>
                <option>결석</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>좌석</th>
                  <th>신청 시간</th>
                  <th>학습시간</th>
                  <th>연속 참여</th>
                  <th>출결 상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="student-cell">
                        <span>{item.name[0]}</span>
                        <div>
                          <b>{item.name}</b>
                          <small>{item.no}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <b>{item.seat}</b>
                    </td>
                    <td>{item.time}</td>
                    <td>
                      {item.minutes
                        ? `${Math.floor(item.minutes / 60)}시간 ${item.minutes % 60}분`
                        : "—"}
                    </td>
                    <td>
                      <span className="streak">
                        <Flame /> {item.streak}일
                      </span>
                    </td>
                    <td>
                      <select
                        className={`status ${item.status.replace(" ", "")}`}
                        value={item.status}
                        onChange={(e) => changeStatus(item.id, e.target.value)}
                      >
                        <option>신청</option>
                        <option>학습 중</option>
                        <option>출석</option>
                        <option>지각</option>
                        <option>결석</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!loading && !rows.length && (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <ClipboardCheck />
                        <b>표시할 신청 내역이 없습니다.</b>
                        <span>
                          기본 데이터를 만들거나 학생의 신청을 기다려 주세요.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ParticipationLeaderboard({ students, loading }) {
  const medals = ["🥇", "🥈", "🥉"];
  const [standardsOpen, setStandardsOpen] = useState(false);
  const pointStandards = [
    ["출석 스트릭", "5일 연속 참여", "연속학습 배지 + 50P", 50],
    ["이달의 꾸준이", "월 15회 이상 참여", "특별 배지 + 150P", 150],
    ["목표 달성", "월 목표 학습시간 달성", "100P", 100],
    ["성실 출석", "신청 후 지각 및 무단결석 없이 참여", "성실 포인트 50P", 50],
    ["첫 도전", "처음 자율학습 참여", "30P", 30],
    ["퍼펙트 위크", "일주일 신청 일정 모두 참여", "70P", 70],
    ["StudyON 챌린지", "일정 기간 목표 달성", "추첨권 또는 특별 배지", 0],
    ["함께 공부하기", "학급 전체 목표 달성", "학급 공동 보상", 0],
  ];
  return (
    <section className="panel leaderboard-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">TOP PARTICIPATION</span>
          <h2>자율학습 참여 우수 학생</h2>
          <p>누적 포인트 순위와 실제 참여 기록을 함께 보여줍니다.</p>
        </div>
        <button
          className="leaderboard-standard"
          onClick={() => setStandardsOpen(true)}
        >
          <Trophy /> 포인트 기준
          <ChevronRight />
        </button>
      </div>
      {students.length ? (
        <div className="leaderboard-list">
          {students.map((student, index) => (
            <article
              className={`leader-row rank-${index + 1}`}
              key={student.id}
            >
              <span className="rank-number">{medals[index] || index + 1}</span>
              <span className="leader-avatar">{student.name?.[0] || "학"}</span>
              <div className="leader-name">
                <b>{student.name || "이름 없음"}</b>
                <small>
                  {student.className || "학급 미지정"} ·{" "}
                  {student.studentNumber || "학번 없음"}
                </small>
              </div>
              <div className="leader-metric">
                <small>참여</small>
                <b>{student.participationCount}회</b>
              </div>
              <div className="leader-metric">
                <small>학습시간</small>
                <b>
                  {Math.floor(student.totalMinutes / 60)}시간{" "}
                  {student.totalMinutes % 60}분
                </b>
              </div>
              <div className="leader-metric streak-metric">
                <small>연속 학습</small>
                <b>
                  <Flame /> {student.streak || 0}일
                </b>
              </div>
              <strong className="leader-points">
                {(student.points || 0).toLocaleString()} P
              </strong>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Trophy />
          <b>
            {loading
              ? "학생 정보를 불러오는 중입니다."
              : "순위에 표시할 학생이 없습니다."}
          </b>
          <span>학생의 참여 및 포인트 기록이 생기면 자동으로 집계됩니다.</span>
        </div>
      )}
      {standardsOpen && (
        <div className="modal-backdrop" onClick={() => setStandardsOpen(false)}>
          <div
            className="point-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="point-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="point-modal-head">
              <div>
                <span className="eyebrow">REWARD STANDARD</span>
                <h2 id="point-modal-title">StudyON 포인트 기준</h2>
                <p>꾸준한 자율학습 참여에 따라 포인트와 배지를 지급합니다.</p>
              </div>
              <button aria-label="닫기" onClick={() => setStandardsOpen(false)}>
                <X />
              </button>
            </div>
            <div className="point-standard-list">
              {pointStandards.map(
                ([name, condition, reward, points], index) => (
                  <article key={name}>
                    <span className={`standard-icon tone-${index % 4}`}>
                      {points ? `${points}P` : <Trophy />}
                    </span>
                    <div>
                      <b>{name}</b>
                      <small>{condition}</small>
                    </div>
                    <strong>{reward}</strong>
                  </article>
                ),
              )}
            </div>
            <div className="point-modal-note">
              <Star />
              <span>포인트는 조건 달성 확인 후 학생 계정에 반영됩니다.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function LiveSeatManager({ seats: liveSeats, reservations, notify }) {
  const fallback = Array.from({ length: 40 }, (_, index) => {
    const id = `${String.fromCharCode(65 + Math.floor(index / 10))}-${String((index % 10) + 1).padStart(2, "0")}`;
    return { id, status: "available", seatNumber: id };
  });
  const displaySeats = liveSeats.length
    ? liveSeats.sort((a, b) => a.id.localeCompare(b.id))
    : fallback;
  const toggle = async (seat) => {
    const next = seat.status === "blocked" ? "available" : "blocked";
    try {
      await updateSeat(seat.id, {
        status: next,
        studentId: null,
        studentName: null,
        roomId: "room-1",
        roomName: "제1 자율학습실",
        seatNumber: seat.id,
      });
      notify(
        next === "blocked"
          ? `${seat.id} 좌석을 사용 중지했습니다.`
          : `${seat.id} 좌석을 다시 열었습니다.`,
      );
    } catch {
      notify("좌석 상태를 변경하지 못했습니다.");
    }
  };
  return (
    <section className="panel teacher-seats">
      <div className="section-head">
        <div>
          <h2>제1 자율학습실</h2>
          <p>
            총 {displaySeats.length}석 · 예약 {reservations.length}석 · 좌석을
            눌러 사용 중지 설정
          </p>
        </div>
        <div className="legend">
          <i />빈 좌석 <i className="active" />
          예약 <i className="studying" />
          사용 중 <i className="late" />
          사용 중지
        </div>
      </div>
      <div className="board">교탁 · BOARD</div>
      <div className="seat-map large">
        {displaySeats.map((seat) => {
          const seatReservations = reservations.filter(
            (item) => item.seatId === seat.id && item.status !== "cancelled",
          );
          const studyingReservations = seatReservations.filter((item) =>
            ["학습 중", "출석"].includes(item.attendanceStatus),
          );
          const studentNames = [
            ...new Set(
              [
                ...(studyingReservations.length
                  ? studyingReservations
                  : seatReservations
                ).map((item) => item.studentName),
                ...(studyingReservations.length ? [] : [seat.studentName]),
              ].filter(Boolean),
            ),
          ];
          const state = studyingReservations.length
            ? "studying"
            : seat.status === "blocked"
              ? "late"
              : seatReservations.length || seat.status === "occupied"
                ? "active"
                : "";
          return (
            <button
              className={state}
              key={seat.id}
              title={
                studentNames.length
                  ? `${studentNames.join(", ")} · ${studyingReservations.length ? "사용 중" : "예약"} · ${
                      seatReservations
                        .map((item) => item.timeSlot)
                        .filter(Boolean)
                        .join(" / ") || "예약"
                    }`
                  : seat.status === "blocked"
                    ? "사용 중지"
                    : "사용 가능"
              }
              onClick={() =>
                studyingReservations.length
                  ? notify(
                      `${studentNames.join(", ")} 학생이 현재 학습 중입니다.`,
                    )
                  : toggle(seat)
              }
            >
              <Armchair />
              <span>{seat.id}</span>
              {studentNames.length > 0 && (
                <small className="seat-student-name">
                  {studentNames.join(", ")}
                </small>
              )}
              {studyingReservations.length > 0 && (
                <em className="seat-live-status">사용 중</em>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StudentManager({ students: profiles, query, setQuery, notify }) {
  const filtered = profiles.filter(
    (item) =>
      (item.name || "").includes(query) ||
      (item.studentNumber || "").includes(query),
  );
  const addPoints = async (student) => {
    try {
      await updateStudent(student.id, { points: (student.points || 0) + 50 });
      notify(`${student.name} 학생에게 50P를 지급했습니다.`);
    } catch {
      notify("포인트를 지급하지 못했습니다.");
    }
  };
  return (
    <section className="panel admin-panel">
      <div className="section-head">
        <div>
          <h2>전체 학생</h2>
          <p>등록 학생 {profiles.length}명</p>
        </div>
        <div className="admin-tools">
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 학번 검색"
            />
          </label>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>학생</th>
              <th>학급</th>
              <th>연속 학습</th>
              <th>포인트</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="student-cell">
                    <span>{student.name?.[0] || "학"}</span>
                    <div>
                      <b>{student.name || "이름 없음"}</b>
                      <small>{student.studentNumber || "-"}</small>
                    </div>
                  </div>
                </td>
                <td>{student.className || "미지정"}</td>
                <td>
                  <span className="streak">
                    <Flame /> {student.streak || 0}일
                  </span>
                </td>
                <td>
                  <b>{(student.points || 0).toLocaleString()} P</b>
                </td>
                <td>
                  <button
                    className="mini-action"
                    onClick={() => addPoints(student)}
                  >
                    <Star /> 50P 지급
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const defaultSettings = {
  roomName: "제1 자율학습실",
  capacity: 40,
  periods: standardPeriods,
  weeklySchedule: standardWeeklySchedule,
  lateAfterMinutes: 10,
  attendancePoints: 10,
  applicationsOpen: true,
  autoCheckout: true,
  rewardPolicies: [
    {
      id: "streak5",
      name: "출석 스트릭",
      condition: "5일 연속 참여",
      reward: "연속학습 배지 + 50P",
      points: 50,
      enabled: true,
    },
    {
      id: "monthly15",
      name: "이달의 꾸준이",
      condition: "월 15회 이상 참여",
      reward: "특별 배지 + 150P",
      points: 150,
      enabled: true,
    },
    {
      id: "monthlyGoal",
      name: "목표 달성",
      condition: "월 목표 학습시간 달성",
      reward: "100P",
      points: 100,
      enabled: true,
    },
    {
      id: "perfectAttendance",
      name: "성실 출석",
      condition: "신청 후 지각·무단결석 없이 참여",
      reward: "성실 포인트 50P",
      points: 50,
      enabled: true,
    },
    {
      id: "firstStudy",
      name: "첫 도전",
      condition: "처음 자율학습 참여",
      reward: "30P",
      points: 30,
      enabled: true,
    },
    {
      id: "perfectWeek",
      name: "퍼펙트 위크",
      condition: "일주일 신청 일정 모두 참여",
      reward: "70P",
      points: 70,
      enabled: true,
    },
    {
      id: "studyonChallenge",
      name: "StudyON 챌린지",
      condition: "일정 기간 목표 달성",
      reward: "추첨권 또는 특별 배지",
      points: 0,
      enabled: true,
    },
    {
      id: "classTogether",
      name: "함께 공부하기",
      condition: "학급 전체 목표 달성",
      reward: "학급 공동 보상",
      points: 0,
      enabled: true,
    },
  ],
};

function OperationsSettings({ notify }) {
  const [form, setForm] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () =>
      subscribeStudySettings(
        (data) => {
          if (data) setForm((current) => ({ ...current, ...data }));
          setLoading(false);
        },
        () => {
          setError("운영 설정을 불러올 권한을 확인해 주세요.");
          setLoading(false);
        },
      ),
    [],
  );

  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const changePeriod = (id, key, value) =>
    change(
      "periods",
      form.periods.map((period) =>
        period.id === id ? { ...period, [key]: value } : period,
      ),
    );
  const toggleSchedule = (day, periodId) => {
    const current = form.weeklySchedule[day] || [];
    change("weeklySchedule", {
      ...form.weeklySchedule,
      [day]: current.includes(periodId)
        ? current.filter((id) => id !== periodId)
        : [...current, periodId].sort(),
    });
  };
  const toggleRewardPolicy = (policyId) =>
    change(
      "rewardPolicies",
      form.rewardPolicies.map((policy) =>
        policy.id === policyId
          ? { ...policy, enabled: !policy.enabled }
          : policy,
      ),
    );
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveStudySettings({
        ...form,
        capacity: Number(form.capacity),
        lateAfterMinutes: Number(form.lateAfterMinutes),
        attendancePoints: Number(form.attendancePoints),
      });
      notify("운영 설정을 저장했습니다.");
    } catch {
      setError(
        "설정을 저장하지 못했습니다. Firestore 규칙과 교사 권한을 확인해 주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">OPERATION SETTINGS</span>
          <h1>운영 설정</h1>
          <p>자율학습실 운영 기준과 학생 신청 정책을 설정합니다.</p>
        </div>
      </div>
      {error && (
        <div className="db-banner">
          <strong>설정 확인</strong>
          <span>{error}</span>
        </div>
      )}
      <form className="settings-layout" onSubmit={save}>
        <section className="panel settings-card">
          <div className="settings-title">
            <span className="icon mint">
              <Armchair />
            </span>
            <div>
              <h2>학습실 기본 정보</h2>
              <p>학생에게 표시할 학습실 정보입니다.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              학습실 이름
              <input
                value={form.roomName}
                onChange={(e) => change("roomName", e.target.value)}
                required
              />
            </label>
            <label>
              전체 좌석 수
              <input
                type="number"
                min="1"
                max="300"
                value={form.capacity}
                onChange={(e) => change("capacity", e.target.value)}
                required
              />
            </label>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-title">
            <span className="icon blue">
              <Clock3 />
            </span>
            <div>
              <h2>운영 시간 및 요일</h2>
              <p>신청 가능한 기본 운영 일정을 설정합니다.</p>
            </div>
          </div>
          <div className="period-editor">
            {form.periods.map((period) => (
              <div key={period.id}>
                <b>{period.label}</b>
                <input
                  type="time"
                  value={period.start}
                  onChange={(e) =>
                    changePeriod(period.id, "start", e.target.value)
                  }
                />
                <span>–</span>
                <input
                  type="time"
                  value={period.end}
                  onChange={(e) =>
                    changePeriod(period.id, "end", e.target.value)
                  }
                />
              </div>
            ))}
          </div>
          <label className="field-label">요일별 운영 교시</label>
          <div className="schedule-matrix">
            <div className="matrix-head">
              <span>요일</span>
              {form.periods.map((period) => (
                <b key={period.id}>{period.label}</b>
              ))}
            </div>
            {["월", "화", "수", "목", "금"].map((day) => (
              <div className="matrix-row" key={day}>
                <strong>{day}</strong>
                {form.periods.map((period) => (
                  <button
                    type="button"
                    className={
                      (form.weeklySchedule[day] || []).includes(period.id)
                        ? "selected"
                        : ""
                    }
                    onClick={() => toggleSchedule(day, period.id)}
                    key={period.id}
                  >
                    <Check />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-title">
            <span className="icon yellow">
              <ClipboardCheck />
            </span>
            <div>
              <h2>출결 및 보상 기준</h2>
              <p>자동 출결 처리와 기본 포인트를 설정합니다.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              지각 처리 기준
              <input
                type="number"
                min="0"
                max="120"
                value={form.lateAfterMinutes}
                onChange={(e) => change("lateAfterMinutes", e.target.value)}
              />
              <small>시작 시간 이후 기준(분)</small>
            </label>
            <label>
              출석 기본 포인트
              <input
                type="number"
                min="0"
                max="1000"
                value={form.attendancePoints}
                onChange={(e) => change("attendancePoints", e.target.value)}
              />
              <small>정상 출석 시 자동 지급</small>
            </label>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-title">
            <span className="icon mint">
              <Settings />
            </span>
            <div>
              <h2>신청 및 자동화</h2>
              <p>학생 신청과 퇴실 처리 방식을 관리합니다.</p>
            </div>
          </div>
          <label className="toggle-row">
            <div>
              <b>학생 신청 받기</b>
              <span>비활성화하면 새로운 신청을 받지 않습니다.</span>
            </div>
            <input
              type="checkbox"
              checked={form.applicationsOpen}
              onChange={(e) => change("applicationsOpen", e.target.checked)}
            />
            <i />
          </label>
          <label className="toggle-row">
            <div>
              <b>운영 종료 시 자동 퇴실</b>
              <span>종료 시간에 학습 중인 학생을 자동 퇴실 처리합니다.</span>
            </div>
            <input
              type="checkbox"
              checked={form.autoCheckout}
              onChange={(e) => change("autoCheckout", e.target.checked)}
            />
            <i />
          </label>
        </section>
        <section className="panel settings-card reward-policy-card">
          <div className="settings-title">
            <span className="icon yellow">
              <Trophy />
            </span>
            <div>
              <h2>포인트 및 배지 지급 기준</h2>
              <p>학생 참여에 적용할 공식 보상 정책입니다.</p>
            </div>
          </div>
          <div className="policy-list">
            {form.rewardPolicies.map((policy) => (
              <div
                className={!policy.enabled ? "disabled" : ""}
                key={policy.id}
              >
                <span className="policy-symbol">
                  {policy.points ? `${policy.points}P` : <Trophy />}
                </span>
                <div>
                  <b>{policy.name}</b>
                  <small>{policy.condition}</small>
                </div>
                <strong>{policy.reward}</strong>
                <label className="mini-switch">
                  <input
                    type="checkbox"
                    checked={policy.enabled}
                    onChange={() => toggleRewardPolicy(policy.id)}
                  />
                  <i />
                </label>
              </div>
            ))}
          </div>
        </section>
        <div className="settings-actions">
          <span>
            {loading
              ? "설정을 불러오는 중입니다."
              : "변경사항은 학생 화면에 즉시 반영됩니다."}
          </span>
          <button className="primary-button" disabled={saving || loading}>
            <Check /> {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyStudentHome({ setPage, studentName }) {
  return (
    <div className="page">
      <section className="welcome">
        <div>
          <span className="eyebrow">STUDYON</span>
          <h1>
            {studentName}님, 오늘도 <em>함께 성장해요.</em>
          </h1>
          <p>첫 자율학습을 신청하고 나만의 학습 기록을 시작해 보세요.</p>
        </div>
        <div className="streak-orb">
          <Flame />
          <strong>0</strong>
          <span>연속 학습</span>
        </div>
      </section>
      <div className="stats-grid">
        <div className="stat">
          <span className="icon mint">
            <Clock3 />
          </span>
          <div>
            <small>이번 달 학습시간</small>
            <strong>0시간 0분</strong>
            <span>아직 학습 기록이 없어요</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon blue">
            <CalendarDays />
          </span>
          <div>
            <small>이번 달 참여</small>
            <strong>0회</strong>
            <span>첫 학습을 신청해 보세요</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon yellow">
            <Star />
          </span>
          <div>
            <small>나의 포인트</small>
            <strong>0 P</strong>
            <span>출석하고 포인트를 모아보세요</span>
          </div>
        </div>
      </div>
      <section className="panel student-empty">
        <span className="empty-illustration">
          <BookOpen />
        </span>
        <h2>예정된 자율학습이 없습니다</h2>
        <p>날짜와 교시, 좌석을 선택해 첫 자율학습을 신청해 보세요.</p>
        <button className="primary-button" onClick={() => setPage("apply")}>
          <CalendarDays /> 자율학습 신청하기
        </button>
      </section>
    </div>
  );
}

function EmptyRecordsPage() {
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">MY STUDY</span>
          <h1>학습 기록</h1>
          <p>참여한 자율학습 기록과 누적 시간을 확인할 수 있습니다.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <span className="icon mint">
            <BookOpen />
          </span>
          <div>
            <small>누적 학습시간</small>
            <strong>0시간 0분</strong>
            <span>총 0회 참여</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon blue">
            <TrendingUp />
          </span>
          <div>
            <small>이번 주</small>
            <strong>0시간 0분</strong>
            <span>아직 기록이 없어요</span>
          </div>
        </div>
        <div className="stat">
          <span className="icon yellow">
            <Flame />
          </span>
          <div>
            <small>최장 연속 학습</small>
            <strong>0일</strong>
            <span>첫 기록을 기다리고 있어요</span>
          </div>
        </div>
      </div>
      <section className="panel student-empty">
        <span className="empty-illustration">
          <Clock3 />
        </span>
        <h2>학습 기록이 없습니다</h2>
        <p>자율학습에 참여하고 입·퇴실을 완료하면 기록이 여기에 쌓입니다.</p>
      </section>
    </div>
  );
}

function EmptyRewardsPage() {
  return (
    <div className="page">
      <div className="reward-hero">
        <div>
          <span className="eyebrow">MY REWARDS</span>
          <h1>첫 도전부터 시작해 보세요</h1>
          <p>자율학습에 참여하면 포인트와 배지가 차곡차곡 쌓입니다.</p>
        </div>
        <div className="points">
          <Star />
          <div>
            <small>보유 포인트</small>
            <strong>0 P</strong>
          </div>
        </div>
      </div>
      <section className="panel student-empty">
        <span className="empty-illustration">
          <Trophy />
        </span>
        <h2>아직 획득한 배지가 없습니다</h2>
        <p>첫 자율학습을 완료하면 ‘첫 도전’ 배지를 받을 수 있어요.</p>
      </section>
    </div>
  );
}

function MyPage({ user, profile, setProfile, notify, onLogout }) {
  const [form, setForm] = useState({
    name: profile?.name || user.displayName || "",
    studentNumber: profile?.studentNumber || "",
    className: profile?.className || "",
  });
  const [saving, setSaving] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateStudent(user.uid, form);
      await updateProfile(user, { displayName: form.name });
      setProfile((current) => ({ ...current, ...form }));
      notify("내 정보를 저장했습니다.");
    } catch {
      notify("정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">MY PAGE</span>
          <h1>마이페이지</h1>
          <p>계정과 기본 정보를 확인하고 관리합니다.</p>
        </div>
      </div>
      <div className="mypage-grid">
        <section className="panel profile-summary">
          <div className="profile-large">
            {(form.name || user.email || "U")[0]}
          </div>
          <h2>{form.name || "StudyON 사용자"}</h2>
          <span>{profile?.role === "teacher" ? "교사 · 관리자" : "학생"}</span>
          <p>{user.email}</p>
          <button className="outline-button" onClick={onLogout}>
            <LogOut /> 로그아웃
          </button>
        </section>
        <form className="panel profile-form" onSubmit={save}>
          <div className="settings-title">
            <span className="icon mint">
              <Users />
            </span>
            <div>
              <h2>기본 정보</h2>
              <p>StudyON에서 사용하는 프로필 정보입니다.</p>
            </div>
          </div>
          <label>
            이름
            <input
              value={form.name}
              onChange={(e) =>
                setForm((current) => ({ ...current, name: e.target.value }))
              }
              required
            />
          </label>
          {profile?.role !== "teacher" && (
            <label>
              학번
              <input
                value={form.studentNumber}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    studentNumber: e.target.value,
                  }))
                }
              />
            </label>
          )}
          <label>
            {profile?.role === "teacher" ? "소속" : "학급"}
            <input
              value={form.className}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  className: e.target.value,
                }))
              }
              placeholder={
                profile?.role === "teacher" ? "예: 2학년부" : "예: 2학년 1반"
              }
            />
          </label>
          <label>
            이메일
            <input value={user.email || ""} disabled />
            <small>이메일 변경은 학교 관리자에게 문의해 주세요.</small>
          </label>
          <button className="primary-button profile-save" disabled={saving}>
            <Check /> {saving ? "저장 중..." : "변경사항 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(undefined),
    [profile, setProfile] = useState(null),
    [role, setRole] = useState("student"),
    [page, setPage] = useState("home"),
    [toast, setToast] = useState(""),
    [open, setOpen] = useState(false);
  useEffect(
    () =>
      onAuthStateChanged(auth, async (current) => {
        setUser(current);
        if (!current) {
          setProfile(null);
          setRole("student");
          setPage("home");
          return;
        }
        try {
          const snap = await getDoc(doc(db, "users", current.uid));
          const data = snap.exists()
            ? snap.data()
            : {
                name: current.displayName || current.email?.split("@")[0],
                role: "student",
              };
          setProfile(data);
          setRole(data.role === "teacher" ? "teacher" : "student");
          setPage(data.role === "teacher" ? "admin" : "home");
          if (data.role !== "teacher") {
            localStorage.removeItem("studyon_students");
          }
        } catch {
          setProfile({
            name: current.displayName || current.email?.split("@")[0],
            role: "student",
          });
          setRole("student");
          localStorage.removeItem("studyon_students");
        }
      }),
    [],
  );
  const notify = (m) => setToast(m);
  const content = useMemo(() => {
    if (page === "mypage")
      return (
        <MyPage
          user={user}
          profile={profile}
          setProfile={setProfile}
          notify={notify}
          onLogout={() => signOut(auth)}
        />
      );
    if (role === "teacher" && page === "settings")
      return <OperationsSettings notify={notify} />;
    if (role === "teacher")
      return <TeacherConsole notify={notify} page={page} />;
    if (page === "apply")
      return <ApplyPage notify={notify} user={user} profile={profile} />;
    if (page === "records") return <EmptyRecordsPage />;
    if (page === "rewards") return <EmptyRewardsPage />;
    return (
      <EmptyStudentHome
        setPage={setPage}
        studentName={
          profile?.name ||
          user?.displayName ||
          user?.email?.split("@")[0] ||
          "학생"
        }
      />
    );
  }, [role, page, profile, user]);
  if (user === undefined)
    return (
      <div className="app-loading">
        <span className="logo-mark">
          <Power />
        </span>
        <b>StudyON</b>
      </div>
    );
  if (!user) return <LoginPage />;
  return (
    <div className="app">
      <Sidebar
        {...{ role, page, setPage, open, setOpen, user, profile }}
        onLogout={() => signOut(auth)}
      />
      <main>
        <Header
          {...{ role, setRole, setPage, setOpen, profile, user }}
          canManage={profile?.role === "teacher"}
        />
        {content}
      </main>
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
