import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
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
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      onData(items);
    },
    onError,
  );
}

export async function createStudyReservation(data) {
  return addDoc(collection(db, "reservations"), {
    ...data,
    status: "applied",
    attendanceStatus: "신청",
    studyMinutes: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelStudyReservation(id) {
  await updateDoc(doc(db, "reservations", id), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
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
