import { create } from "zustand";

interface OnboardingState {
  // Step 0 (nickname)
  nickname: string;
  // Step 1
  region: string;
  // Step 2
  age: string;
  enrollmentStatus: string;
  schoolName: string;
  incomeBracket: number | null;
  // Step 3
  employmentStatus: string;

  setNickname: (nickname: string) => void;
  setRegion: (region: string) => void;
  setAge: (age: string) => void;
  setEnrollmentStatus: (status: string) => void;
  setSchoolName: (name: string) => void;
  setIncomeBracket: (bracket: number | null) => void;
  setEmploymentStatus: (status: string) => void;

  // Legacy step setters kept for any callers that used the old API
  setStep1: (region: string, birthYear: number) => void;
  setStep2: (
    enrollmentStatus: string,
    schoolName: string,
    incomeBracket: number | null
  ) => void;

  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  nickname: "",
  region: "",
  age: "",
  enrollmentStatus: "",
  schoolName: "",
  incomeBracket: null,
  employmentStatus: "",

  setNickname: (nickname) => set({ nickname }),
  setRegion: (region) => set({ region }),
  setAge: (age) => set({ age }),
  setEnrollmentStatus: (enrollmentStatus) => set({ enrollmentStatus }),
  setSchoolName: (schoolName) => set({ schoolName }),
  setIncomeBracket: (incomeBracket) => set({ incomeBracket }),
  setEmploymentStatus: (employmentStatus) => set({ employmentStatus }),

  // Legacy — kept for backward compatibility with any existing callers
  setStep1: (region, birthYear) => {
    const age = String(new Date().getFullYear() - birthYear);
    set({ region, age });
  },
  setStep2: (enrollmentStatus, schoolName, incomeBracket) =>
    set({ enrollmentStatus, schoolName, incomeBracket }),

  reset: () =>
    set({
      nickname: "",
      region: "",
      age: "",
      enrollmentStatus: "",
      schoolName: "",
      incomeBracket: null,
      employmentStatus: "",
    }),
}));

/**
 * Derive birth year from age string outside the store.
 * Usage: getBirthYear(store.age)
 */
export function getBirthYear(age: string): number {
  const parsed = parseInt(age, 10);
  if (isNaN(parsed) || parsed <= 0) return 0;
  return new Date().getFullYear() - parsed;
}
