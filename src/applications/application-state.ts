import type { Application } from "./application-data.ts";

export type AddApplicationInput = Pick<
  Application,
  "company" | "position" | "stage"
>;

export type ApplicationDetailsInput = Pick<
  Application,
  "company" | "position" | "location" | "employmentType" | "appliedAt"
>;

export type ApplicationScheduleInput = {
  nextActionAt: string;
  nextActionTitle: string;
};
