// Today's date as "YYYY-MM-DD"
export const todayStr = () => new Date().toISOString().slice(0, 10);

// "HH:mm" -> minutes since midnight. Falls back to the default 10:00 shift start
// if the value is missing/malformed (e.g. records created before shifts existed).
export const parseTimeToMinutes = (hhmm, fallback = "10:00") => {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm || "") ? hhmm : fallback).split(":").map(Number);
  return h * 60 + m;
};

export const shiftDurationMinutes = (shiftStart, shiftEnd) =>
  parseTimeToMinutes(shiftEnd, "18:30") - parseTimeToMinutes(shiftStart, "10:00");

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const istMinutesOfDay = (date = new Date()) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// Computed off the UTC instant + a fixed IST offset, so this is correct
// regardless of the server's own local timezone. Late = punched in any time
// after the employee's own shift start, no grace window.
export const isLateArrival = (punchInTime, shiftStart = "10:00") =>
  istMinutesOfDay(punchInTime) > parseTimeToMinutes(shiftStart);

// A day locked absent by the 3rd-late-arrival-in-the-month rule is absent
// regardless of hours worked.
export const computePunchOutStatus = (record, totalMinutes) => {
  if (record.lateCycleAbsent) return "absent";
  const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;
  return totalMinutes >= halfDayMinutes ? "present" : "half-day";
};
