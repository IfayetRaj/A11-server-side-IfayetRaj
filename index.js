const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "https://pick-perfect-1f90f.web.app",
    credentials: true,
  })
);

app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ddy6nyc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("pickPerfectDB");
    const usersQueries = db.collection("usersQueries");
    const recommendations = db.collection("allRecommendation");

    // Middleware: Verify JWT from cookie
    const verifyJWT = (req, res, next) => {
      const token = req.cookies["access-token"];
      if (!token) return res.status(401).json({ message: "Unauthorized" });

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Forbidden" });
        req.user = decoded;
        next();
      });
    };

    // Exchange Firebase token for JWT
    app.post("/jwt", async (req, res) => {
      const { token } = req.body;

      try {
        const decoded = await admin.auth().verifyIdToken(token);
        const jwtToken = jwt.sign({ email: decoded.email }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });

        res.cookie("access-token", jwtToken, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
          maxAge: 60 * 60 * 1000,
        });

        res.json({ success: true });
      } catch (error) {
        console.error("Token verification failed:", error);
        res.status(401).json({ message: "Unauthorized" });
      }
    });

    // Logout: clear cookie
    app.post("/logout", (req, res) => {
      res.clearCookie("access-token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      res.json({ message: "Logged out successfully." });
    });

    // Queries
    app.get("/allqueries", async (req, res) => {
      const result = await usersQueries.find().toArray();
      res.send(result);
    });

    app.post("/allqueries", verifyJWT, async (req, res) => {
      const result = await usersQueries.insertOne(req.body);
      res.send(result);
    });

    app.put("/allqueries/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await usersQueries.updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.patch("/allqueries/:id", verifyJWT, async (req, res) => {
      const result = await usersQueries.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $inc: { recommendationCount: 1 } }
      );
      res.send(result);
    });

    app.patch("/allqueries/:id/decrement", verifyJWT, async (req, res) => {
      const result = await usersQueries.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $inc: { recommendationCount: -1 } }
      );
      res.send(result);
    });

    app.delete("/allqueries/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      await usersQueries.deleteOne({ _id: new ObjectId(id) });
      await recommendations.deleteMany({ postID: id });
      res.json({ success: true });
    });

    // Recommendations
    app.get("/recommendation", verifyJWT, async (req, res) => {
      const result = await recommendations.find().toArray();
      res.send(result);
    });

    app.post("/recommendation", verifyJWT, async (req, res) => {
      const result = await recommendations.insertOne(req.body);
      res.send(result);
    });

    app.delete("/recommendation/:id", verifyJWT, async (req, res) => {
      const result = await recommendations.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Ping test
    await client.db("admin").command({ ping: 1 });
    console.log(" MongoDB Connected");
  } catch (err) {
    console.error(" DB error:", err);
  }
}
run();

app.get("/", (req, res) => {
  res.send(" Backend is running");
});

app.listen(port, () => {
  console.log(`Server is live at http://localhost:${port}`);
});
