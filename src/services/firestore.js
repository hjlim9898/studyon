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
