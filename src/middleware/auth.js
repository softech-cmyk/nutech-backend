import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized. No token." });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// Must run after `protect` — only lets managers through.
export const requireManager = (req, res, next) => {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ message: "Access denied. Managers only." });
  }
  next();
};