import { create } from "zustand";

export interface OnboardingState {
  region: string;
  birthYear: number;
  enrollmentStatus: string;
  schoolName: string;
  incomeBracket: number | null;
  setStep1: (region: string, birthYear: number) => void;
  setStep2: (
    status: string,
    school: string,
    income: number | null
  ) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  region: "",
  birthYear: 0,
  enrollmentStatus: "",
  schoolName: "",
  incomeBracket: null,

  setStep1: (region, birthYear) => set({ region, birthYear }),

  setStep2: (enrollmentStatus, schoolName, incomeBracket) =>
    set({ enrollmentStatus, schoolName, incomeBracket }),

  reset: () =>
    set({
      region: "",
      birthYear: 0,
      enrollmentStatus: "",
      schoolName: "",
      incomeBracket: null,
    }),
}));
