// Today's date as "YYYY-MM-DD"
export const todayStr = () => new Date().toISOString().slice(0, 10);

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// No grace window — anything after the shift's own start time counts as late.
const LATE_GRACE_MINUTES = 0;

// Absolute half-day cutoff, regardless of an employee's own shift start —
// matches the auto-absent job's cutoff for punching in at all.
export const HALF_DAY_CUTOFF = "12:30";

// "HH:mm" -> minutes since midnight. Falls back to the default 10:00 shift start
// if the value is missing/malformed (e.g. records created before shifts existed).
export const parseTimeToMinutes = (hhmm, fallback = "10:00") => {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm || "") ? hhmm : fallback).split(":").map(Number);
  return h * 60 + m;
};

export const shiftDurationMinutes = (shiftStart, shiftEnd) =>
  parseTimeToMinutes(shiftEnd, "18:30") - parseTimeToMinutes(shiftStart, "10:00");

export const istMinutesOfDay = (date = new Date()) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// Computed off the UTC instant + a fixed IST offset, so this is correct
// regardless of the server's own local timezone. Late past the shift's own
// grace window, OR past the absolute 12:30 cutoff — whichever comes first —
// so a late shift start can't push the effective deadline past 12:30.
export const isLateArrival = (punchInTime, shiftStart = "10:00") => {
  const minutesOfDay = istMinutesOfDay(punchInTime);
  const graceDeadline = parseTimeToMinutes(shiftStart) + LATE_GRACE_MINUTES;
  return minutesOfDay > graceDeadline || minutesOfDay > parseTimeToMinutes(HALF_DAY_CUTOFF);
};

// An unforgiven late arrival (monthly rebate quota already used up) is already
// locked to absent regardless of hours worked.
export const computePunchOutStatus = (record, totalMinutes) => {
  const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;
  const lockedAbsent = record.lateArrival && !record.lateRebateApplied;
  return lockedAbsent ? "absent" : (totalMinutes >= halfDayMinutes ? "present" : "half-day");
};
