type ScheduleOptions = {
  replace?: boolean;
};

type ScheduleFn = (target: string, options?: ScheduleOptions) => void;

let scheduleCrossModuleNav: ScheduleFn | null = null;

export function registerSoftNavCoordinator(schedule: ScheduleFn): () => void {
  scheduleCrossModuleNav = schedule;
  return () => {
    if (scheduleCrossModuleNav === schedule) scheduleCrossModuleNav = null;
  };
}

export function scheduleCrossModuleNavImperative(
  target: string,
  options?: ScheduleOptions,
): void {
  scheduleCrossModuleNav?.(target, options);
}
