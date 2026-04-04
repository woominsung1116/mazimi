"use client";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps?: number;
}

export default function OnboardingProgress({
  currentStep,
  totalSteps = 2,
}: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center gap-3">
            {i > 0 && (
              <div
                className={`h-0.5 w-8 ${
                  isCompleted ? "bg-teal-600" : "bg-gray-200"
                }`}
              />
            )}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                isActive
                  ? "bg-teal-600 text-white"
                  : isCompleted
                    ? "bg-teal-600 text-white"
                    : "bg-gray-200 text-gray-400"
              }`}
            >
              {isCompleted ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                step
              )}
            </div>
          </div>
        );
      })}
      <span className="ml-2 text-sm text-gray-500">
        {currentStep} / {totalSteps}
      </span>
    </div>
  );
}
