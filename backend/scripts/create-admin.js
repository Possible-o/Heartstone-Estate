require("dotenv").config();
const dns = require("node:dns");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("node:readline");
const Admin = require("../models/Admin");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

function askHiddenPassword(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("Use an interactive terminal."));
      return;
    }

    const stdin = process.stdin;
    let password = "";

    rl.pause();
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    function onData(buffer) {
      for (const character of buffer.toString()) {
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(password);
          return;
        }

        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Admin setup cancelled."));
          return;
        }

        if (character === "\b" || character === "\u007f") {
          password = password.slice(0, -1);
        } else if (character >= " ") {
          password += character;
        }
      }
    }

    stdin.on("data", onData);
  });
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI.");
    }

    const email = (await ask("Admin email: ")).trim().toLowerCase();
    const fullName = (await ask("Admin full name: ")).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || fullName.length < 2) {
      throw new Error("Invalid administrator details.");
    }

    const password = await askHiddenPassword("Admin password (hidden): ");

    const validPassword =
      password.length >= 12 &&
      password.length <= 128 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9\s]/.test(password);

    if (!validPassword) {
      throw new Error(
        "Password must contain at least 12 characters, uppercase, lowercase, number and special character.",
      );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    if (mongoose.connection.db.databaseName !== "heartstone_estate") {
      throw new Error("Wrong database. Expected heartstone_estate.");
    }

    if (await Admin.exists({ email })) {
      throw new Error("Account already exists.");
    }

    await Admin.create({
      email,
      fullName,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
    });

    console.log("Heartstone Estate administrator created successfully.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
})();
