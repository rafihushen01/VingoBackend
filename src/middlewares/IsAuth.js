const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const secretkey = process.env.SECRET_KEY;

const extractBearerToken = (headerValue) => {
  if (!headerValue || typeof headerValue !== "string") return null;
  if (!headerValue.toLowerCase().startsWith("bearer ")) return null;
  const token = headerValue.slice(7).trim();
  return token || null;
};

const getTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  const bearerToken = extractBearerToken(
    req.headers.authorization || req.headers.Authorization
  );
  if (bearerToken) return bearerToken;

  const customHeaderToken = req.headers["x-access-token"] || req.headers["x-auth-token"];
  if (typeof customHeaderToken === "string" && customHeaderToken.trim()) {
    return customHeaderToken.trim();
  }

  return null;
};

const isAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized access, token missing" });
    }

    const decodedtoken = jwt.verify(token, secretkey);
    if (!decodedtoken?.id) {
      return res.status(401).json({ message: "Unauthorized access, token invalid" });
    }

    req.userId = decodedtoken.id;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized access, token invalid" });
  }
};

module.exports = isAuth;
