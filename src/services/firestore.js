import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export function subscribeToCollection(name, onData, onError) {
  return onSnapshot(
    collection(db, name),
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError,
  );
}

export function classNameFromStudentNumber(studentNumber) {
  const match = String(studentNumber || "").match(/^([1-3])(0[1-9])\d{2}$/);
  return match ? `${Number(match[1])}학년 ${Number(match[2])}반` : "";
}

export function subscribeStudySettings(onData, onError) {
  return onSnapshot(
    doc(db, "settings", "studyRoom"),
    (snapshot) => {
      onData(snapshot.exists() ? snapshot.data() : null);
    },
    onError,
  );
}

export async function saveStudySettings(settings) {
  await setDoc(
    doc(db, "settings", "studyRoom"),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateReservationStatus(id, status) {
  await updateDoc(doc(db, "reservations", id), {
    attendanceStatus: status,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeMyReservations(userId, onData, onError) {
  const ownReservations = query(
    collection(db, "reservations"),
    where("studentId", "==", userId),
  );
  return onSnapshot(
    ownReservations,
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      items.sort((a, b) => {
        const aCancelled = a.status === "cancelled" ? 1 : 0;
        const bCancelled = b.status === "cancelled" ? 1 : 0;
        return (
          aCancelled - bCancelled ||
          (b.date || "").localeCompare(a.date || "") ||
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
      });
      onData(items);
    },
    onError,
  );
}

export async function createStudyReservation(data) {
  const reservationRef = doc(collection(db, "reservations"));
  const periodIds = data.periodIds || [];
  const seatLockRefs = periodIds.map((periodId) =>
    doc(db, "reservationLocks", `${data.date}_${periodId}_${data.seatId}`),
  );
  const studentLockRefs = periodIds.map((periodId) =>
    doc(
      db,
      "studentReservationLocks",
      `${data.studentId}_${data.date}_${periodId}`,
    ),
  );

  return runTransaction(db, async (transaction) => {
    const seatLocks = await Promise.all(
      seatLockRefs.map((reference) => transaction.get(reference)),
    );
    const studentLocks = await Promise.all(
      studentLockRefs.map((reference) => transaction.get(reference)),
    );
    if (studentLocks.some((snapshot) => snapshot.exists())) {
      throw new Error("STUDENT_TIME_CONFLICT");
    }
    if (seatLocks.some((snapshot) => snapshot.exists())) {
      throw new Error("SEAT_TIME_CONFLICT");
    }

    transaction.set(reservationRef, {
      ...data,
      seatAssignments: Object.fromEntries(
        periodIds.map((periodId) => [String(periodId), data.seatId]),
      ),
      status: "applied",
      attendanceStatus: "신청",
      studyMinutes: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    periodIds.forEach((periodId, index) => {
      const lockData = {
        reservationId: reservationRef.id,
        studentId: data.studentId,
        date: data.date,
        periodId,
        periodKey: String(periodId),
        seatId: data.seatId,
        createdAt: serverTimestamp(),
      };
      transaction.set(seatLockRefs[index], lockData);
      transaction.set(studentLockRefs[index], lockData);
    });
    return reservationRef;
  });
}

export async function cancelReservationPeriod(
  id,
  periodId,
  remainingTimeSlot,
  knownPeriodIds = [],
) {
  const reservationRef = doc(db, "reservations", id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reservationRef);
    if (!snapshot.exists()) throw new Error("RESERVATION_NOT_FOUND");
    const reservation = snapshot.data();
    const periodKey = String(periodId);
    const seatId =
      reservation.seatAssignments?.[periodKey] || reservation.seatId;
    const sourcePeriodIds = reservation.periodIds?.length
      ? reservation.periodIds
      : knownPeriodIds;
    const remainingPeriodIds = sourcePeriodIds.filter(
      (idValue) => idValue !== periodId,
    );
    transaction.delete(
      doc(db, "reservationLocks", `${reservation.date}_${periodId}_${seatId}`),
    );
    transaction.delete(
      doc(
        db,
        "studentReservationLocks",
        `${reservation.studentId}_${reservation.date}_${periodId}`,
      ),
    );
    const seatAssignments = { ...(reservation.seatAssignments || {}) };
    delete seatAssignments[periodKey];
    transaction.update(reservationRef, {
      periodIds: remainingPeriodIds,
      seatAssignments,
      seatId: remainingPeriodIds.length
        ? seatAssignments[String(remainingPeriodIds[0])] || reservation.seatId
        : reservation.seatId,
      timeSlot: remainingTimeSlot,
      status: remainingPeriodIds.length ? "applied" : "cancelled",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function changeReservationPeriodSeat(
  id,
  periodId,
  newSeatId,
  knownPeriodIds = [],
) {
  const reservationRef = doc(db, "reservations", id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reservationRef);
    if (!snapshot.exists()) throw new Error("RESERVATION_NOT_FOUND");
    const reservation = snapshot.data();
    const periodKey = String(periodId);
    const oldSeatId =
      reservation.seatAssignments?.[periodKey] || reservation.seatId;
    if (oldSeatId === newSeatId) return;
    const newLockRef = doc(
      db,
      "reservationLocks",
      `${reservation.date}_${periodId}_${newSeatId}`,
    );
    const newLock = await transaction.get(newLockRef);
    if (newLock.exists()) throw new Error("SEAT_TIME_CONFLICT");
    transaction.delete(
      doc(
        db,
        "reservationLocks",
        `${reservation.date}_${periodId}_${oldSeatId}`,
      ),
    );
    const sourcePeriodIds = reservation.periodIds?.length
      ? reservation.periodIds
      : knownPeriodIds;
    const seatAssignments = {
      ...Object.fromEntries(
        sourcePeriodIds.map((idValue) => [String(idValue), reservation.seatId]),
      ),
      ...(reservation.seatAssignments || {}),
      [periodKey]: newSeatId,
    };
    transaction.update(reservationRef, {
      periodIds: sourcePeriodIds,
      seatAssignments,
      seatId: sourcePeriodIds[0] === periodId ? newSeatId : reservation.seatId,
      updatedAt: serverTimestamp(),
    });
    transaction.set(newLockRef, {
      reservationId: id,
      studentId: reservation.studentId,
      date: reservation.date,
      periodId,
      periodKey,
      seatId: newSeatId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function cancelStudyReservation(id) {
  const reservationRef = doc(db, "reservations", id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reservationRef);
    if (!snapshot.exists()) throw new Error("RESERVATION_NOT_FOUND");
    const reservation = snapshot.data();
    (reservation.periodIds || []).forEach((periodId) => {
      const seatId =
        reservation.seatAssignments?.[String(periodId)] || reservation.seatId;
      transaction.delete(
        doc(
          db,
          "reservationLocks",
          `${reservation.date}_${periodId}_${seatId}`,
        ),
      );
      transaction.delete(
        doc(
          db,
          "studentReservationLocks",
          `${reservation.studentId}_${reservation.date}_${periodId}`,
        ),
      );
    });
    transaction.update(reservationRef, {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateSeat(id, data) {
  await setDoc(
    doc(db, "seats", id),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateStudent(id, data) {
  await updateDoc(doc(db, "users", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function publishRankingProfile(id, profile) {
  await setDoc(
    doc(db, "publicRankings", id),
    {
      name: profile.name || "이름 없음",
      className:
        classNameFromStudentNumber(profile.studentNumber) ||
        profile.className ||
        "학급 미지정",
      points: profile.points || 0,
      streak: profile.streak || 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function publishRankingProfiles(students) {
  const batch = writeBatch(db);
  students.forEach((student) => {
    batch.set(
      doc(db, "publicRankings", student.id),
      {
        name: student.name || "이름 없음",
        className:
          classNameFromStudentNumber(student.studentNumber) ||
          student.className ||
          "학급 미지정",
        points: student.points || 0,
        streak: student.streak || 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
}

function dateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null;
}

export function calculateAutomaticPointDetails(reservations, settings = {}) {
  const attended = reservations.filter(
    (item) =>
      item.status !== "cancelled" &&
      ["출석", "학습 중"].includes(item.attendanceStatus),
  );
  const policies = Object.fromEntries(
    (settings.rewardPolicies || []).map((policy) => [policy.id, policy]),
  );
  const reward = (id, fallback) =>
    policies[id]?.enabled === false ? 0 : Number(policies[id]?.points ?? fallback);
  const uniqueDates = [...new Set(attended.map((item) => dateKey(item.date)).filter(Boolean))].sort();
  const months = {};
  attended.forEach((item) => {
    const date = dateKey(item.date);
    if (!date) return;
    const month = date.slice(0, 7);
    months[month] ||= { dates: new Set(), minutes: 0 };
    months[month].dates.add(date);
    months[month].minutes += Number(item.studyMinutes || 0);
  });

  let longestStreak = uniqueDates.length ? 1 : 0;
  let streak = longestStreak;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDates[index]}T00:00:00`);
    streak = (current - previous) / 86400000 === 1 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
  }

  const basePoints = attended.length * Number(settings.attendancePoints ?? 10);
  const firstStudy = attended.length ? reward("firstStudy", 30) : 0;
  const streakPoints = longestStreak >= 5 ? reward("streak5", 50) : 0;
  const monthlyConsistency = Object.values(months).filter(
    (month) => month.dates.size >= 15,
  ).length * reward("monthly15", 150);
  const monthlyGoal = Object.values(months).filter(
    (month) => month.minutes >= 40 * 60,
  ).length * reward("monthlyGoal", 100);
  const active = reservations.filter((item) => item.status !== "cancelled");
  const perfectAttendance =
    active.length > 0 &&
    active.every((item) => ["출석", "학습 중"].includes(item.attendanceStatus))
      ? reward("perfectAttendance", 50)
      : 0;

  const weeks = {};
  active.forEach((item) => {
    const date = dateKey(item.date);
    if (!date) return;
    const value = new Date(`${date}T00:00:00`);
    const monday = new Date(value);
    monday.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    weeks[key] ||= [];
    weeks[key].push(item);
  });
  const perfectWeeks = Object.values(weeks).filter(
    (items) =>
      new Set(items.map((item) => item.date)).size >= 2 &&
      items.every((item) => ["출석", "학습 중"].includes(item.attendanceStatus)),
  ).length;
  const perfectWeekPoints = perfectWeeks * reward("perfectWeek", 70);

  const items = [
    {
      id: "attendance",
      name: "출석 기본 포인트",
      condition: `${attended.length}회 참여 × ${Number(settings.attendancePoints ?? 10)}P`,
      points: basePoints,
      earned: attended.length > 0,
    },
    { id: "firstStudy", name: "첫 도전", condition: "처음 자율학습 참여", points: firstStudy, earned: attended.length > 0 },
    { id: "streak5", name: "출석 스트릭", condition: `최장 ${longestStreak}일 연속 참여`, points: streakPoints, earned: longestStreak >= 5 },
    { id: "monthly15", name: "이달의 꾸준이", condition: "월 15회 이상 참여", points: monthlyConsistency, earned: monthlyConsistency > 0 },
    { id: "monthlyGoal", name: "목표 달성", condition: "월 40시간 학습", points: monthlyGoal, earned: monthlyGoal > 0 },
    { id: "perfectAttendance", name: "성실 출석", condition: "지각·결석 없이 신청 일정 참여", points: perfectAttendance, earned: perfectAttendance > 0 },
    { id: "perfectWeek", name: "퍼펙트 위크", condition: `${perfectWeeks}주 신청 일정 모두 참여`, points: perfectWeekPoints, earned: perfectWeeks > 0 },
    { id: "studyonChallenge", name: "StudyON 챌린지", condition: "운영 중인 특별 챌린지 달성", points: 0, earned: false },
    { id: "classTogether", name: "함께 공부하기", condition: "학급 전체 목표 달성", points: 0, earned: false },
  ];
  return {
    total: items.reduce((sum, item) => sum + item.points, 0),
    items,
    attendedCount: attended.length,
    totalMinutes: attended.reduce(
      (sum, item) => sum + Number(item.studyMinutes || 0),
      0,
    ),
  };
}

export function calculateAutomaticPoints(reservations, settings = {}) {
  return calculateAutomaticPointDetails(reservations, settings).total;
}

export async function syncAutomaticPoints(students, reservations, settings) {
  const changed = students
    .map((student) => ({
      student,
      points: calculateAutomaticPoints(
        reservations.filter((item) => item.studentId === student.id),
        settings,
      ),
    }))
    .filter(({ student, points }) => Number(student.points || 0) !== points);
  if (!changed.length) return false;
  const batch = writeBatch(db);
  changed.forEach(({ student, points }) => {
    batch.update(doc(db, "users", student.id), {
      points,
      updatedAt: serverTimestamp(),
    });
    batch.set(
      doc(db, "publicRankings", student.id),
      {
        name: student.name || "이름 없음",
        className:
          classNameFromStudentNumber(student.studentNumber) ||
          student.className ||
          "학급 미지정",
        points,
        streak: student.streak || 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
  return true;
}

export async function seedStudyRoom(students) {
  const batch = writeBatch(db);
  students.forEach((student, index) => {
    const studentId = `demo-student-${student.id}`;
    batch.set(
      doc(db, "users", studentId),
      {
        uid: studentId,
        name: student.name,
        studentNumber: student.no,
        className: "2학년 1반",
        role: "student",
        points: 300 + index * 120,
        streak: student.streak,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    batch.set(
      doc(db, "reservations", `demo-reservation-${student.id}`),
      {
        studentId,
        studentName: student.name,
        studentNumber: student.no,
        date: new Date().toISOString().slice(0, 10),
        timeSlot: student.time,
        seatId: student.seat,
        status: "applied",
        attendanceStatus: student.status,
        studyMinutes: student.minutes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  for (let index = 0; index < 40; index += 1) {
    const seatId = `${String.fromCharCode(65 + Math.floor(index / 10))}-${String((index % 10) + 1).padStart(2, "0")}`;
    const reservation = students.find((student) => student.seat === seatId);
    batch.set(
      doc(db, "seats", seatId),
      {
        roomId: "room-1",
        roomName: "제1 자율학습실",
        seatNumber: seatId,
        status: reservation ? "occupied" : "available",
        studentId: reservation ? `demo-student-${reservation.id}` : null,
        studentName: reservation?.name || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}
