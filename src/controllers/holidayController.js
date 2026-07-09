import Holiday from "../models/Holiday.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

// GET /api/holidays?year=2026
export const getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    const filter = year ? { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } : {};
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    return res.json({ holidays });
  } catch (err) {
    return res.status(500).json({ message: "Could not fetch holidays.", error: err.message });
  }
};

// GET /api/holidays/today
export const getTodayHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findOne({ date: todayStr() });
    return res.json({ holiday: holiday || null });
  } catch (err) {
    return res.status(500).json({ message: "Could not check today's holiday.", error: err.message });
  }
};

// POST /api/holidays  (manager-only)  body: { date: "YYYY-MM-DD", name }
export const createHoliday = async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !name?.trim()) {
      return res.status(400).json({ message: "date (YYYY-MM-DD) and name are required." });
    }

    const holiday = await Holiday.findOneAndUpdate(
      { date },
      { date, name: name.trim(), createdBy: req.user.id },
      { upsert: true, new: true }
    );

    return res.status(201).json({ message: "Holiday saved.", holiday });
  } catch (err) {
    return res.status(500).json({ message: "Could not save holiday.", error: err.message });
  }
};

// DELETE /api/holidays/:id  (manager-only)
export const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ message: "Holiday not found." });
    return res.json({ message: "Holiday removed." });
  } catch (err) {
    return res.status(500).json({ message: "Could not remove holiday.", error: err.message });
  }
};
