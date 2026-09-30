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

export const computePunchOutStatus = (record, totalMinutes) => {
  const halfDayMinutes = shiftDurationMinutes(record.shiftStart, record.shiftEnd) / 2;
  return totalMinutes >= halfDayMinutes ? "present" : "half-day";
};
