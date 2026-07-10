// Today's date as "YYYY-MM-DD"
export const todayStr = () => new Date().toISOString().slice(0, 10);

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const LATE_GRACE_MINUTES = 15;

// "HH:mm" -> minutes since midnight. Falls back to the default 10:00 shift start
// if the value is missing/malformed (e.g. records created before shifts existed).
export const parseTimeToMinutes = (hhmm, fallback = "10:00") => {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm || "") ? hhmm : fallback).split(":").map(Number);
  return h * 60 + m;
};

export const shiftDurationMinutes = (shiftStart, shiftEnd) =>
  parseTimeToMinutes(shiftEnd, "18:30") - parseTimeToMinutes(shiftStart, "10:00");

// Computed off the UTC instant + a fixed IST offset, so this is correct
// regardless of the server's own local timezone.
export const isLateArrival = (punchInTime, shiftStart = "10:00") => {
  const ist = new Date(punchInTime.getTime() + IST_OFFSET_MS);
  const minutesOfDay = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutesOfDay > parseTimeToMinutes(shiftStart) + LATE_GRACE_MINUTES;
};

export const istMinutesOfDay = (date = new Date()) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// An unforgiven late arrival is already locked to half-day regardless of hours worked.
export const computePunchOutStatus = (record, totalMinutes) => {
  const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;
  const lockedHalfDay = record.lateArrival && !record.lateRebateApplied;
  return lockedHalfDay ? "half-day" : (totalMinutes >= halfDayMinutes ? "present" : "half-day");
};
