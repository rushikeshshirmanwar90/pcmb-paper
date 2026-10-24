import React, { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { MOCK_QUESTIONS } from '@/services/apiService';
import type { ExamRoom } from '@/types/pcmb';

// Demo rooms so the Exam Rooms list isn't empty; rooms aren't saved anywhere yet.
const DEMO_ROOMS: ExamRoom[] = [
  {
    _id: 'room-demo-1',
    roomCode: 'NEET-7842',
    title: 'NEET 2026 Physics & Chemistry Weekly Test',
    examCategory: 'JEE/NEET',
    standard: '12th',
    subject: 'Physics',
    difficulty: 'Mid',
    durationMinutes: 45,
    totalMarks: 16,
    questions: MOCK_QUESTIONS.filter((q) => q.examCategory === 'JEE/NEET'),
    createdAt: new Date().toISOString(),
    status: 'active',
  },
  {
    _id: 'room-demo-2',
    roomCode: 'FOUND-3910',
    title: 'Class 10 Foundation Math & Science Quiz',
    examCategory: 'Foundation',
    standard: '10th',
    subject: 'Mathematics',
    difficulty: 'Easy',
    durationMinutes: 30,
    totalMarks: 12,
    questions: MOCK_QUESTIONS.filter((q) => q.examCategory === 'Foundation'),
    createdAt: new Date().toISOString(),
    status: 'active',
  },
];

interface RoomsContextValue {
  rooms: ExamRoom[];
  addRoom: (room: ExamRoom) => void;
  updateRoom: (room: ExamRoom) => void;
  deleteRoom: (roomId: string) => void;
}

const RoomsContext = createContext<RoomsContextValue | null>(null);

/** Exam rooms, shared by the Questions tab (which creates them) and the Papers tab (which lists them). */
export function RoomsProvider({ children }: PropsWithChildren) {
  const [rooms, setRooms] = useState<ExamRoom[]>(DEMO_ROOMS);

  const addRoom = useCallback((room: ExamRoom) => setRooms((prev) => [room, ...prev]), []);
  const updateRoom = useCallback(
    (room: ExamRoom) => setRooms((prev) => prev.map((r) => (r._id === room._id ? room : r))),
    []
  );
  const deleteRoom = useCallback((roomId: string) => setRooms((prev) => prev.filter((r) => r._id !== roomId)), []);

  return (
    <RoomsContext.Provider value={{ rooms, addRoom, updateRoom, deleteRoom }}>{children}</RoomsContext.Provider>
  );
}

export function useRooms() {
  const ctx = useContext(RoomsContext);
  if (!ctx) {
    throw new Error('useRooms must be used within a RoomsProvider');
  }
  return ctx;
}
