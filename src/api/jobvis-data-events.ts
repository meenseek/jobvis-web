export const JOBVIS_APPLICATIONS_INVALIDATED =
  "jobvis:applications-invalidated";

export function invalidateJobvisApplications() {
  window.dispatchEvent(new Event(JOBVIS_APPLICATIONS_INVALIDATED));
}
