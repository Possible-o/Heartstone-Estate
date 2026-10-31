const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many password reset attempts. Please try again in 15 minutes."
  }
});
const User = require("./models/User");
const Admin = require("./models/Admin");
const Property = require("./models/Property");
const InspectionRequest = require("./models/InspectionRequest");
const Enquiry = require("./models/Enquiry");
const { sendPasswordResetEmail } = require("./heartstone-mailer");

const app = express();
const frontend = path.resolve(__dirname, "../frontend");
if (
  !process.env.MONGODB_URI ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  console.error(
    "Set MONGODB_URI and a SESSION_SECRET of at least 32 characters in backend/.env",
  );
  process.exit(1);
}
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(
  session({
    name: "heartstone.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`)
      return res.status(403).json({ message: "Request origin not allowed." });
  }
  next();
});

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many enquiries. Please try again in 15 minutes.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});

app.use(
  ["/api/auth/login", "/api/auth/admin-login", "/api/auth/register"],
  authLimiter,
);

const IDLE_TIMEOUT = {
  user: 15 * 60 * 1000,
  admin: 5 * 60 * 1000,
};

app.use((req, res, next) => {
  const { userId, role, lastActivityAt } = req.session;

  if (!userId || !["user", "admin"].includes(role)) {
    return next();
  }

  const now = Date.now();
  const limit = IDLE_TIMEOUT[role];

  if (typeof lastActivityAt !== "number" || now - lastActivityAt >= limit) {
    const expiredRole = role;

    return req.session.destroy((error) => {
      if (error) return next(error);

      res.clearCookie("heartstone.sid", { path: "/" });

      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        return res.redirect(
          expiredRole === "admin"
            ? "/admin-login.html?reason=expired"
            : "/signin.html?reason=expired",
        );
      }

      return res.status(401).json({
        authenticated: false,
        code: "SESSION_IDLE_EXPIRED",
        message: "Your session expired due to inactivity.",
      });
    });
  }

  if (
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH" ||
    req.method === "DELETE"
  ) {
    if (!req.path.startsWith("/api/auth/")) {
      req.session.lastActivityAt = now;
    }
  }

  next();
});

app.post("/api/auth/activity", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ authenticated: false });
  }

  
if (req.session.role === "user") {
  try {
    const user = await User.findById(req.session.userId);

    if (
      !user ||
      user.role !== "user" ||
      req.session.sessionVersion !== (user.sessionVersion ?? 0)
    ) {
      return req.session.destroy((err) => {
        if (err) return res.status(500).json({
          message: "Could not end session."
        });

        res.clearCookie("heartstone.sid", { path: "/" });

        return res.status(401).json({
          authenticated: false,
          code: "SESSION_INVALIDATED",
          message: "Your session has expired. Please sign in again."
        });
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: "Could not verify session."
    });
  }
}


  req.session.lastActivityAt = Date.now();
  res.set("Cache-Control", "no-store");
  res.json({ ok: true });
});

const emailOK = (s) =>
  typeof s === "string" &&
  s.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const passOK = (s) =>
  typeof s === "string" &&
  s.length >= 8 &&
  s.length <= 128 &&
  /[A-Z]/.test(s) &&
  /[a-z]/.test(s) &&
  /\d/.test(s) &&
  /[^A-Za-z0-9\s]/.test(s);
const publicUser = (u) => ({
  id: String(u._id),
  fullName: u.fullName,
  email: u.email,
  phone: u.phone,
  role: u.role,
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const { fullName, email, phone, password, confirmPassword, terms } =
      req.body || {};
    if (
      typeof fullName !== "string" ||
      !/^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(fullName.trim()) ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 80 ||
      !emailOK(email) ||
      typeof phone !== "string" ||
      !/^(\+[1-9]\d{7,14}|0\d{10})$/.test(phone.replace(/[\s().-]/g, "")) ||
      !passOK(password) ||
      password !== confirmPassword ||
      terms !== true
    )
      return res
        .status(400)
        .json({ message: "Please correct the registration fields." });
    const normalized = email.trim().toLowerCase();
    if (await User.exists({ email: normalized }))
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await User.create({
        fullName: fullName.trim(),
        email: normalized,
        phone: phone.trim(),
        passwordHash,
        role: "user",
      });
    } catch (e) {
      if (e.code === 11000)
        return res
          .status(409)
          .json({ message: "An account with this email already exists." });
      throw e;
    }
    res.status(201).json({ message: "Account created. Please sign in." });
  }),
);

app.delete(
  "/api/properties/:id/images",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const { imageUrl } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    if (typeof imageUrl !== "string") {
      return res.status(400).json({
        message: "A valid image URL is required.",
      });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    if (!property.images.includes(imageUrl)) {
      return res.status(404).json({
        message: "Picture not found on this property.",
      });
    }

    const prefix = "/uploads/properties/";
    const filename = imageUrl.slice(prefix.length);

    if (
      !imageUrl.startsWith(prefix) ||
      !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(filename)
    ) {
      return res.status(400).json({
        message: "Invalid uploaded image path.",
      });
    }

    const updated = await Property.findOneAndUpdate(
      { _id: id, images: imageUrl },
      { $pull: { images: imageUrl } },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(409).json({
        message: "Picture was already removed.",
      });
    }

    const filePath = path.join(uploadsDirectory, filename);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Picture file cleanup failed:", error);
      }
    }

    res.json({
      message: "Picture removed successfully.",
      property: updated,
    });
  }),
);

async function login(req, res, role) {
  const { email, password } = req.body || {};

  if (!emailOK(email) || typeof password !== "string") {
    return res.status(400).json({
      message: "Enter a valid email and password.",
    });
  }

  const Model = role === "admin" ? Admin : User;
  const user = await Model.findOne({
    email: email.trim().toLowerCase(),
    role,
  }).select("+passwordHash");

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).json({
        message: "Could not start a session.",
      });
    }

    req.session.userId = String(user._id);
    req.session.role = role;

    if (role === "user") {
      req.session.sessionVersion = user.sessionVersion ?? 0;
    }
    req.session.lastActivityAt = Date.now();

    req.session.save((err) =>
      err
        ? res.status(500).json({
            message: "Could not save the session.",
          })
        : res.json({ user: publicUser(user) }),
    );
  });
}

app.post(
  "/api/auth/login",
  wrap((req, res) => login(req, res, "user")),
);
app.post(
  "/api/auth/admin-login",
  wrap((req, res) => login(req, res, "admin")),
);

app.post(
  "/api/auth/forgot-password",
  passwordResetLimiter,
  wrap(async (req, res) => {
    const message =
      "If an account exists with this email, a password reset link will be sent.";

    res.set("Cache-Control", "no-store");

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!emailOK(email)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({ message });
    }

    const token = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    const baseUrl = process.env.APP_BASE_URL;

    const resetUrl = `${baseUrl}/reset-password.html?token=${encodeURIComponent(token)}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      console.error("Password reset email delivery failed:", error);

      await User.updateOne(
        {
          _id: user._id,
          passwordResetTokenHash: tokenHash,
        },
        {
          $set: {
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
          },
        },
      );
    }

    return res.json({ message });
  }),
);

app.post(
  "/api/auth/reset-password",
  wrap(async (req, res) => {
    res.set("Cache-Control", "no-store");

    const token = String(req.body?.token || "");
    const password = req.body?.password;

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        message: "This password reset link is invalid or expired.",
      });
    }

    if (!passOK(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least 8 characters, including uppercase, lowercase, a number and a special character.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetExpiresAt");

    if (!user) {
      return res.status(400).json({
        message: "This password reset link is invalid or expired.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const updated = await User.updateOne(
      {
        _id: user._id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
        $inc: {
          sessionVersion: 1,
        },
      },
    );

    if (updated.modifiedCount !== 1) {
      return res.status(400).json({
        message: "This password reset link is invalid or expired.",
      });
    }

    return res.json({
      message: "Your password has been reset successfully. Please sign in.",
    });
  }),
);

app.get(
  "/api/auth/session",
  wrap(async (req, res) => {
    if (!req.session.userId)
      return res.status(401).json({ authenticated: false });
    const Model = req.session.role === "admin" ? Admin : User;
    const user = await Model.findById(req.session.userId);
    if (!user || user.role !== req.session.role)
      return res.status(401).json({ authenticated: false });
    if (
      req.session.role === "user" &&
      req.session.sessionVersion !== (user.sessionVersion ?? 0)
    ) {
      return req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({
            message: "Could not end the session.",
          });
        }

        res.clearCookie("heartstone.sid", { path: "/" });

        return res.status(401).json({
          authenticated: false,
          message: "Your session has expired. Please sign in again.",
        });
      });
    }
    res.json({ authenticated: true, user: publicUser(user) });
  }),
);
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Could not log out." });
    res.clearCookie("heartstone.sid", { path: "/" });
    res.json({ message: "Signed out." });
  });
});
app.get(
  ["/user-dashboard.html", "/admin.html"],
  wrap(async (req, res) => {
    const role = req.path === "/admin.html" ? "admin" : "user";
    if (!req.session.userId || req.session.role !== role)
      return res.redirect(
        role === "admin"
          ? "/admin-login.html"
          : "/signin.html?reason=required&next=user-dashboard.html",
      );
    const Model = req.session.role === "admin" ? Admin : User;
    const user = await Model.findById(req.session.userId);
    if (!user || user.role !== role)
      return res.redirect(
        role === "admin" ? "/admin-login.html" : "/signin.html?reason=required",
      );
      if (
  role === "user" &&
  req.session.sessionVersion !== (user.sessionVersion ?? 0)
) {
  return req.session.destroy((err) => {
    if (err) return res.status(500).send("Could not end session.");

    res.clearCookie("heartstone.sid", { path: "/" });

    return res.redirect("/signin.html?reason=required");
  });
}
    const fs = require("fs");
    const html = fs.readFileSync(path.join(frontend, req.path), "utf8");
    const safe = JSON.stringify({ user: publicUser(user) }).replace(
      /</g,
      "\u003c",
    );
    res
      .set("Cache-Control", "no-store")
      .type("html")
      .send(
        html.replace(
          /<head([^>]*)>/i,
          `<head$1><script>window.__HEARTSTONE_SESSION__=${safe};</script>`,
        ),
      );
  }),
);

async function requireAdmin(req, res, next) {
  try {
    if (!req.session.userId || req.session.role !== "admin") {
      return res.status(401).json({
        message: "Administrator login required.",
      });
    }

    const admin = await Admin.findById(req.session.userId);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        message: "Administrator access denied.",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function requireUser(req, res, next) {
  try {
    if (!req.session.userId || req.session.role !== "user") {
      return res.status(401).json({
        message: "Please sign in to request an inspection.",
      });
    }

    if (!mongoose.isValidObjectId(req.session.userId)) {
      return res.status(401).json({
        message: "Your session is invalid. Please sign in again.",
      });
    }

    const user = await User.findById(req.session.userId);

    if (!user || user.role !== "user") {
      return res.status(403).json({
        message: "User access required.",
      });
    }

    if (req.session.sessionVersion !== (user.sessionVersion ?? 0)) {
      return req.session.destroy((err) => {
        if (err) return next(err);

        res.clearCookie("heartstone.sid", { path: "/" });

        return res.status(401).json({
          code: "SESSION_INVALIDATED",
          message: "Your password has changed. Please sign in again.",
        });
      });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

const uploadsDirectory = path.join(__dirname, "uploads", "properties");

async function cleanupPropertyImages(images) {
  const prefix = "/uploads/properties/";
  const validFilename = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

  for (const imageUrl of images) {
    if (typeof imageUrl !== "string") continue;
    if (!imageUrl.startsWith(prefix)) continue;

    const filename = imageUrl.slice(prefix.length);

    if (!validFilename.test(filename)) {
      console.warn("Skipped invalid image path:", imageUrl);
      continue;
    }

    const filePath = path.join(uploadsDirectory, filename);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Unable to delete property image:", filename, error);
      }
    }
  }
}

fs.mkdirSync(uploadsDirectory, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadsDirectory);
  },

  filename: (req, file, callback) => {
    const extension = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    }[file.mimetype];

    callback(null, crypto.randomUUID() + extension);
  },
});

const uploadPropertyImages = multer({
  storage: imageStorage,

  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 8,
    fields: 0,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG and WebP images are allowed."));
    }

    callback(null, true);
  },
});

const validatePropertyImages = async (files) => {
  const allowedFormats = new Set(["jpeg", "png", "webp"]);

  const invalidImage = (message) => {
    const error = new Error(message);
    error.code = "INVALID_PROPERTY_IMAGE";
    return error;
  };

  for (const file of files) {
    let metadata;
    let verifiedImage;

    try {
      metadata = await sharp(file.path, {
        limitInputPixels: 40000000,
      }).metadata();

      if (!allowedFormats.has(metadata.format)) {
        throw invalidImage("Only valid JPG, PNG and WebP images are allowed.");
      }

      const expectedFormat = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
      }[file.mimetype];

      if (metadata.format !== expectedFormat) {
        throw invalidImage("Image content does not match its file type.");
      }

      verifiedImage = await sharp(file.path, {
        limitInputPixels: 40000000,
      })
        .rotate()
        .toFormat(metadata.format)
        .toBuffer();
    } catch (error) {
      if (error.code === "INVALID_PROPERTY_IMAGE") {
        throw error;
      }

      if (error instanceof Error && error.message) {
        throw invalidImage("The uploaded file is not a valid supported image.");
      }

      throw error;
    }

    if (verifiedImage.length > 100 * 1024 * 1024) {
      throw invalidImage("Processed images must not exceed 100 MB.");
    }

    const extension =
      metadata.format === "jpeg" ? ".jpg" : `.${metadata.format}`;
    const processedFilename = `${require("crypto").randomUUID()}${extension}`;
    const processedPath = require("path").join(
      require("path").dirname(file.path),
      processedFilename,
    );

    const originalPath = file.path;
    file.originalUploadPath = originalPath;

    try {
      await fs.promises.writeFile(processedPath, verifiedImage, {
        flag: "wx",
      });

      file.path = processedPath;
      file.filename = processedFilename;

      await fs.promises.unlink(originalPath).catch((error) => {
        console.warn("Original upload cleanup failed:", error.message);
      });
    } catch (error) {
      await fs.promises.unlink(processedPath).catch(() => {});
      throw error;
    }
  }
};

app.post(
  "/api/properties/:id/images",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    uploadPropertyImages.array("images", 8)(req, res, async (error) => {
      const uploadedFiles = req.files || [];

      const removeUploadedFiles = async () => {
        const paths = new Set();

        for (const file of uploadedFiles) {
          if (file.path) paths.add(file.path);
          if (file.originalUploadPath) {
            paths.add(file.originalUploadPath);
          }
        }

        await Promise.all(
          [...paths].map(async (filePath) => {
            try {
              await fs.promises.unlink(filePath);
            } catch (error) {
              if (error.code !== "ENOENT") {
                console.error("Image cleanup failed:", error);
              }
            }
          }),
        );
      };

      if (error) {
        await removeUploadedFiles();

        return res.status(400).json({
          message: error.message || "Image upload failed.",
        });
      }

      try {
        if (!uploadedFiles.length) {
          return res.status(400).json({
            message: "Select at least one picture.",
          });
        }

        if (property.images.length + uploadedFiles.length > 8) {
          await removeUploadedFiles();

          return res.status(400).json({
            message: "A property can have a maximum of 8 pictures.",
          });
        }

        await validatePropertyImages(uploadedFiles);

        const imageUrls = uploadedFiles.map(
          (file) => "/uploads/properties/" + file.filename,
        );

        property.images.push(...imageUrls);

        await property.save();

        res.status(201).json({
          message: "Pictures uploaded successfully.",
          property,
        });
      } catch (error) {
        await removeUploadedFiles();

        if (error.code === "INVALID_PROPERTY_IMAGE") {
          return res.status(400).json({
            message: error.message,
          });
        }

        console.error("Image upload failed:", error);

        return res.status(500).json({
          message: "Unable to save uploaded pictures.",
        });
      }
    });
  }),
);

app.post(
  "/api/inspections",
  requireUser,
  wrap(async (req, res) => {
    const {
      propertyId,
      requester,
      email,
      phone,
      preferredDate,
      message = "",
    } = req.body || {};

    const validDate =
      typeof preferredDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(preferredDate) &&
      !Number.isNaN(Date.parse(preferredDate)) &&
      new Date(preferredDate + "T00:00:00Z").toISOString().slice(0, 10) ===
        preferredDate;

    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (
      !mongoose.isValidObjectId(propertyId) ||
      typeof requester !== "string" ||
      requester.trim().length < 2 ||
      requester.trim().length > 80 ||
      !emailOK(email) ||
      typeof phone !== "string" ||
      !/^(\+[1-9]\d{7,14}|0\d{10})$/.test(phone.replace(/[\s().-]/g, "")) ||
      !validDate ||
      new Date(preferredDate + "T00:00:00Z") < tomorrow ||
      typeof message !== "string" ||
      message.length > 500
    ) {
      return res.status(400).json({
        message: "Please correct your inspection request details.",
      });
    }

    const property = await Property.findById(propertyId);

    if (!property) {
      return res.status(404).json({
        message: "This property is no longer listed.",
      });
    }

    if (property.availability !== "available") {
      return res.status(409).json({
        message: "This property is not currently available for inspection.",
      });
    }

    const existing = await InspectionRequest.exists({
      user: req.currentUser._id,
      property: property._id,
      preferredDate,
      status: "pending",
    });

    if (existing) {
      return res.status(409).json({
        message:
          "You already have a pending inspection request for this property on that date.",
      });
    }

    const inspection = await InspectionRequest.create({
      user: req.currentUser._id,
      property: property._id,
      requester: requester.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      preferredDate,
      message: message.trim(),
      status: "pending",
    });

    return res.status(201).json({
      message: "Inspection request submitted successfully.",
      request: {
        id: String(inspection._id),
        propertyId: String(inspection.property),
        requester: inspection.requester,
        email: inspection.email,
        phone: inspection.phone,
        preferredDate: inspection.preferredDate,
        message: inspection.message,
        status: inspection.status,
        agreedDate: inspection.agreedDate,
        agreedTime: inspection.agreedTime,
        note: inspection.note,
        createdAt: inspection.createdAt,
      },
    });
  }),
);

app.get(
  "/api/favourites",
  requireUser,
  wrap(async (req, res) => {
    const user = await User.findById(req.currentUser._id)
      .select("favourites")
      .lean();

    if (!user) {
      return res.status(401).json({
        message: "Please sign in again.",
      });
    }

    const properties = await Property.find({
      _id: { $in: user.favourites || [] },
    })
      .select("_id")
      .lean();

    res.set("Cache-Control", "no-store");
    res.json({
      favourites: properties.map((property) => String(property._id)),
    });
  }),
);

app.post(
  "/api/favourites/:propertyId",
  requireUser,
  wrap(async (req, res) => {
    const { propertyId } = req.params;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    const property = await Property.exists({ _id: propertyId });

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    await User.updateOne(
      { _id: req.currentUser._id },
      { $addToSet: { favourites: propertyId } },
    );

    res.json({
      ok: true,
      message: "Property added to favourites.",
    });
  }),
);

app.delete(
  "/api/favourites/:propertyId",
  requireUser,
  wrap(async (req, res) => {
    const { propertyId } = req.params;

    if (!mongoose.isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    await User.updateOne(
      { _id: req.currentUser._id },
      { $pull: { favourites: propertyId } },
    );

    res.json({
      ok: true,
      message: "Property removed from favourites.",
    });
  }),
);

app.patch(
  "/api/users/me",
  requireUser,
  wrap(async (req, res) => {
    const { fullName, email, phone } = req.body || {};
    const errors = {};

    if (
      typeof fullName !== "string" ||
      !/^[\p{L}][\p{L}\s'.-]{1,79}$/u.test(fullName.trim())
    ) {
      errors.fullName = "Enter a valid full name.";
    }

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      errors.email = "Enter a valid email address.";
    }

    if (
      typeof phone !== "string" ||
      !/^(?:0\d{10}|\+[1-9]\d{7,14})$/.test(phone.trim())
    ) {
      errors.phone = "Enter a valid phone number.";
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({
        message: "Invalid profile details.",
        errors,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.exists({
      email: normalizedEmail,
      _id: { $ne: req.currentUser._id },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email address is already registered.",
        errors: {
          email: "This email address is already in use.",
        },
      });
    }

    let user;

    try {
      user = await User.findByIdAndUpdate(
        req.currentUser._id,
        {
          $set: {
            fullName: fullName.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      ).select("_id fullName email phone role");
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Email address is already registered.",
          errors: {
            email: "This email address is already in use.",
          },
        });
      }

      throw error;
    }

    if (!user) {
      return res.status(401).json({
        message: "Please sign in again.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      message: "Profile updated successfully.",
      user: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  }),
);

app.post(
  "/api/enquiries",
  enquiryLimiter,
  requireUser,
  wrap(async (req, res) => {
    const { interest, message } = req.body || {};
    const errors = {};
    const allowedInterests = [
      "Buying a property",
      "Selling a property",
      "Renting a property",
      "Letting a property",
      "Property valuation",
      "General enquiry",
    ];

    if (!allowedInterests.includes(interest)) {
      errors.interest = "Choose a valid enquiry type.";
    }

    if (
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.trim().length > 1000
    ) {
      errors.message = "Enter an enquiry of 1,000 characters or fewer.";
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({
        message: "Please correct the enquiry details.",
        errors,
      });
    }

    await Enquiry.create({
      user: req.currentUser._id,
      fullName: req.currentUser.fullName,
      email: req.currentUser.email,
      phone: req.currentUser.phone || "",
      interest,
      message: message.trim(),
      status: "pending",
    });

    res.set("Cache-Control", "no-store");

    return res.status(201).json({
      message: "Your enquiry has been received successfully.",
    });
  }),
);

app.get(
  "/api/enquiries/mine",
  requireUser,
  wrap(async (req, res) => {
    const enquiries = await Enquiry.find({
      user: req.currentUser._id,
    })
      .sort({ createdAt: -1, _id: -1 })
      .select("interest message status createdAt updatedAt")
      .lean();

    res.set("Cache-Control", "no-store");

    return res.json({
      enquiries: enquiries.map((enquiry) => ({
        id: String(enquiry._id),
        interest: enquiry.interest,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt,
      })),
    });
  }),
);

app.get(
  "/api/admin/enquiries",
  requireAdmin,
  wrap(async (req, res) => {
    const page = Math.max(
      1,
      Math.min(100000, Number.parseInt(req.query.page, 10) || 1),
    );

    const limit = 20;

    const [enquiries, total] = await Promise.all([
      Enquiry.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Enquiry.countDocuments(),
    ]);

    res.set("Cache-Control", "no-store");

    return res.json({
      enquiries: enquiries.map((enquiry) => ({
        id: String(enquiry._id),
        fullName: enquiry.fullName,
        email: enquiry.email,
        phone: enquiry.phone,
        interest: enquiry.interest,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        updatedAt: enquiry.updatedAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

app.patch(
  "/api/admin/enquiries/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid enquiry ID.",
      });
    }

    if (!["pending", "reviewed", "resolved"].includes(status)) {
      return res.status(400).json({
        message: "Choose a valid enquiry status.",
      });
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, runValidators: true },
    );

    if (!enquiry) {
      return res.status(404).json({
        message: "Enquiry not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      message: "Enquiry status updated successfully.",
      enquiry: {
        id: String(enquiry._id),
        status: enquiry.status,
        updatedAt: enquiry.updatedAt,
      },
    });
  }),
);

app.get(
  "/api/inspections/mine",
  requireUser,
  wrap(async (req, res) => {
    const inspections = await InspectionRequest.find({
      user: req.currentUser._id,
    })
      .populate("property", "name location")
      .sort({ createdAt: -1 })
      .lean();

    const requests = inspections.map((inspection) => ({
      id: String(inspection._id),
      userId: String(inspection.user),
      propertyId: inspection.property ? String(inspection.property._id) : null,
      propertyName: inspection.property?.name || "Removed property",
      propertyLocation: inspection.property?.location || "",
      requester: inspection.requester,
      email: inspection.email,
      phone: inspection.phone,
      preferredDate: inspection.preferredDate,
      message: inspection.message,
      status: inspection.status,
      agreedDate: inspection.agreedDate,
      agreedTime: inspection.agreedTime,
      note: inspection.note,
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
    }));

    res.set("Cache-Control", "no-store");
    res.json({ requests });
  }),
);

app.patch(
  "/api/inspections/:id/cancel",
  requireUser,
  wrap(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid inspection request.",
      });
    }

    const request = await InspectionRequest.findOneAndUpdate(
      {
        _id: id,
        user: req.currentUser._id,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
          note: "Cancelled by the requester.",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!request) {
      return res.status(404).json({
        message: "Pending inspection request not found or cannot be cancelled.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      message: "Inspection request cancelled successfully.",
      request: {
        id: String(request._id),
        status: request.status,
        note: request.note,
        updatedAt: request.updatedAt,
      },
    });
  }),
);

app.get(
  "/api/admin/inspections",
  requireAdmin,
  wrap(async (req, res) => {
    const inspections = await InspectionRequest.find()
      .populate("property", "name location type")
      .sort({ createdAt: -1 })
      .lean();

    const requests = inspections.map((inspection) => ({
      id: String(inspection._id),
      propertyId: inspection.property ? String(inspection.property._id) : null,
      propertyName: inspection.property?.name || "Removed property",
      propertyLocation: inspection.property?.location || "",
      userId: String(inspection.user),
      requester: inspection.requester,
      email: inspection.email,
      phone: inspection.phone,
      preferredDate: inspection.preferredDate,
      message: inspection.message,
      status: inspection.status,
      agreedDate: inspection.agreedDate,
      agreedTime: inspection.agreedTime,
      note: inspection.note,
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
    }));

    res.set("Cache-Control", "no-store");
    res.json({ requests });
  }),
);

app.patch(
  "/api/admin/inspections/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const { status, agreedDate, agreedTime, note = "" } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid inspection request ID.",
      });
    }

    if (!["confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({
        message: "Choose confirmed or cancelled.",
      });
    }

    if (typeof note !== "string" || note.length > 500) {
      return res.status(400).json({
        message: "Agent note must not exceed 500 characters.",
      });
    }

    const validDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;

      const date = new Date(value + "T00:00:00Z");

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    const validTime = (value) =>
      typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

    if (
      status === "confirmed" &&
      (!validDate(agreedDate) || !validTime(agreedTime))
    ) {
      return res.status(400).json({
        message: "Provide a valid appointment date and time.",
      });
    }

    const request = await InspectionRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Inspection request not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        message: "This request has already been reviewed.",
      });
    }

    request.status = status;
    request.agreedDate = status === "confirmed" ? agreedDate : null;
    request.agreedTime = status === "confirmed" ? agreedTime : null;
    request.note = note.trim();

    await request.save();

    res.json({
      message:
        status === "confirmed"
          ? "Inspection appointment confirmed."
          : "Inspection request cancelled.",
      request: {
        id: String(request._id),
        propertyId: String(request.property),
        requester: request.requester,
        email: request.email,
        phone: request.phone,
        preferredDate: request.preferredDate,
        message: request.message,
        status: request.status,
        agreedDate: request.agreedDate,
        agreedTime: request.agreedTime,
        note: request.note,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    });
  }),
);

app.get(
  "/api/properties",
  wrap(async (req, res) => {
    const properties = await Property.find().sort({ createdAt: -1 }).lean();

    res.json({ properties });
  }),
);

app.post(
  "/api/properties",
  requireAdmin,
  wrap(async (req, res) => {
    const data = req.body || {};

    const kinds = ["Apartment", "House", "Penthouse", "Duplex", "Terrace"];

    const availabilityOptions = ["available", "under-offer", "let-agreed"];

    const validText = (value, max) =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max;

    const validNumber = (value, minimum, integer = false) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= minimum &&
      (!integer || Number.isInteger(value));

    if (
      !validText(data.name, 90) ||
      !validText(data.location, 150) ||
      !["sale", "rent"].includes(data.type) ||
      !kinds.includes(data.kind) ||
      !validNumber(data.price, 1) ||
      !validNumber(data.beds, 0, true) ||
      !validNumber(data.baths, 0, true) ||
      !validNumber(data.area, 1) ||
      (data.description != null &&
        (typeof data.description !== "string" ||
          data.description.length > 240)) ||
      (data.availability != null &&
        !availabilityOptions.includes(data.availability)) ||
      (data.featured != null && typeof data.featured !== "boolean") ||
      (data.type === "rent" && !["year", "month"].includes(data.pricePeriod)) ||
      (data.features != null &&
        (!Array.isArray(data.features) ||
          data.features.length > 12 ||
          !data.features.every(
            (feature) =>
              typeof feature === "string" &&
              feature.trim().length > 0 &&
              feature.length <= 60,
          ))) ||
      (data.images != null &&
        (!Array.isArray(data.images) || data.images.length !== 0))
    ) {
      return res.status(400).json({
        message: "Invalid property details. Correct the fields and try again.",
      });
    }

    const property = await Property.create({
      name: data.name.trim(),
      type: data.type,
      price: data.price,
      pricePeriod: data.type === "rent" ? data.pricePeriod : null,
      location: data.location.trim(),
      kind: data.kind,
      beds: data.beds,
      baths: data.baths,
      area: data.area,
      description: data.description || "",
      features: data.features || [],
      images: [],
      availability: data.availability || "available",
      featured: data.featured === true,
    });

    res.status(201).json({
      message: "Property created successfully.",
      property,
    });
  }),
);

app.patch(
  "/api/properties/:id/featured",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const { featured } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    if (typeof featured !== "boolean") {
      return res.status(400).json({
        message: "Featured must be true or false.",
      });
    }

    const property = await Property.findByIdAndUpdate(
      id,
      { $set: { featured } },
      { new: true, runValidators: true },
    );

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    res.json({
      message: featured
        ? "Property featured successfully."
        : "Property removed from featured listings.",
      property,
    });
  }),
);

app.put(
  "/api/properties/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const data = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    const kinds = ["Apartment", "House", "Penthouse", "Duplex", "Terrace"];

    const availabilityOptions = ["available", "under-offer", "let-agreed"];

    const validText = (value, max) =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.trim().length <= max;

    const validNumber = (value, minimum, integer = false) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= minimum &&
      (!integer || Number.isInteger(value));

    if (
      !validText(data.name, 90) ||
      !validText(data.location, 150) ||
      !["sale", "rent"].includes(data.type) ||
      !kinds.includes(data.kind) ||
      !validNumber(data.price, 1) ||
      !validNumber(data.beds, 0, true) ||
      !validNumber(data.baths, 0, true) ||
      !validNumber(data.area, 1) ||
      (data.description != null &&
        (typeof data.description !== "string" ||
          data.description.length > 240)) ||
      (data.availability != null &&
        !availabilityOptions.includes(data.availability)) ||
      (data.featured != null && typeof data.featured !== "boolean") ||
      (data.type === "rent" && !["year", "month"].includes(data.pricePeriod)) ||
      (data.features != null &&
        (!Array.isArray(data.features) ||
          data.features.length > 12 ||
          !data.features.every(
            (feature) =>
              typeof feature === "string" &&
              feature.trim().length > 0 &&
              feature.length <= 60,
          ))) ||
      (data.images != null &&
        (!Array.isArray(data.images) || data.images.length !== 0))
    ) {
      return res.status(400).json({
        message: "Invalid property details.",
      });
    }

    const property = await Property.findByIdAndUpdate(
      id,
      {
        $set: {
          name: data.name.trim(),
          type: data.type,
          price: data.price,
          pricePeriod: data.type === "rent" ? data.pricePeriod : null,
          location: data.location.trim(),
          kind: data.kind,
          beds: data.beds,
          baths: data.baths,
          area: data.area,
          description: data.description || "",
          features: data.features || [],
          availability: data.availability || "available",
          featured: data.featured === true,
        },
      },
      { new: true, runValidators: true },
    );

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    res.json({
      message: "Property updated successfully.",
      property,
    });
  }),
);

app.delete(
  "/api/properties/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    const property = await Property.findByIdAndDelete(id);

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    await cleanupPropertyImages(property.images || []);

    res.json({
      message: "Property and associated pictures deleted successfully.",
      property: {
        id: String(property._id),
        name: property.name,
      },
    });
  }),
);

app.patch(
  "/api/properties/:id/cover",
  requireAdmin,
  wrap(async (req, res) => {
    const { id } = req.params;
    const { imageUrl } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid property ID.",
      });
    }

    if (
      typeof imageUrl !== "string" ||
      !imageUrl.startsWith("/uploads/properties/")
    ) {
      return res.status(400).json({
        message: "A valid cover image URL is required.",
      });
    }

    const property = await Property.findById(id);

    if (!property) {
      return res.status(404).json({
        message: "Property not found.",
      });
    }

    if (!property.images.includes(imageUrl)) {
      return res.status(404).json({
        message: "This picture does not belong to the property.",
      });
    }

    const updatedImages = [
      imageUrl,
      ...property.images.filter((image) => image !== imageUrl),
    ];

    const updatedProperty = await Property.findOneAndUpdate(
      {
        _id: id,
        images: imageUrl,
      },
      {
        $set: {
          images: updatedImages,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedProperty) {
      return res.status(409).json({
        message: "The property pictures changed. Please refresh and try again.",
      });
    }

    res.json({
      message: "Cover image updated successfully.",
      property: updatedProperty,
    });
  }),
);

app.use(
  "/uploads/properties",
  express.static(uploadsDirectory, {
    index: false,
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    },
  }),
);

app.use(
  express.static(frontend, {
    index: "index.html",
    extensions: ["html"],
    setHeaders: (res, file) => {
      if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    },
  }),
);
app.use("/api", (req, res) =>
  res.status(404).json({ message: "Endpoint not implemented." }),
);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error." });
});
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(process.env.PORT || 3000, () => {
      console.log(
        `Heartstone Estate server running at http://localhost:${process.env.PORT || 3000}`,
      );
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
