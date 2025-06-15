const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const admin = require('firebase-admin');
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: "http://localhost:5173", // 👈 specific origin, not *
  credentials: true,               // 👈 allow sending cookies
}));


// Initialize Firebase Admin SDK with service account key
admin.initializeApp({
  credential: admin.credential.cert(require("./firebase-service-account.json")),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ddy6nyc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // DB name
    const db = client.db("pickPerfectDB");
    // Collection name
    const usersQueriesCollection = db.collection("usersQueries");
    const allRecCollection = db.collection("allRecommendation");


    // POST /jwt — Verify Firebase token & create JWT cookie
app.post("/jwt", async (req, res) => {
  const { token } = req.body;

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const email = decodedToken.email;

    // Create your JWT token
    const jwtToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Set JWT token in HTTP-only cookie
    res.cookie("access-token", jwtToken, {
      httpOnly: true,
      secure: false,       // true if HTTPS
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,  // 1 hour
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
});


// Middleware to verify JWT cookie
const verifyJWT = (req, res, next) => {
  const token = req.cookies["access-token"];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Forbidden" });
    req.user = decoded;
    next();
  });
};









    // adding queries
    app.post("/allqueries",verifyJWT, async (req, res) => {
      const queriesData = req.body;
      const result = await usersQueriesCollection.insertOne(queriesData);
      res.send(result);
    });


    

    // all queries increment
    app.patch("/allqueries/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await usersQueriesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { recommendationCount: 1 } }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to increment", error });
      }
    });

    // all queries decrement
    app.patch("/allqueries/:id/decrement",verifyJWT,async (req, res) =>{
      const id = req.params.id;
      try{
        const result = await usersQueriesCollection.updateOne(
          { _id: new ObjectId(id) },
      { $inc: { recommendationCount: -1 } }
        )
        res.send(result);
      }catch (error) {
        res.status(500).send({ message: "Failed to decrement", error });
      }
    })

    // all queries
    app.get("/allqueries", async (req, res) => {
      try {
        const result = await usersQueriesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    });
    // all recommendation
    app.get("/recommendation",verifyJWT, async (req, res) => {
      try {
        const result = await allRecCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    });

    // sending recommendation to DB
    app.post("/recommendation",verifyJWT, async (req, res) => {
      const recData = req.body;
      const result = await allRecCollection.insertOne(recData);
      res.send(result);
    });

    // deleting a document using the id
    app.delete("/recommendation/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await allRecCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Recommendation deleted." });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // Put or replace a document
    app.put('/allqueries/:id',verifyJWT, async  (req, res) =>{
      const id = req.params.id;
      const newData = req.body;
      try{
        const result = await usersQueriesCollection.updateOne(
          {_id: new ObjectId(id)},
          {$set: newData}
        );
        if (result.matchedCount === 0) {
          return res.status(404).send("Document not found");
        }
    
        res.send({ message: "Document updated successfully", result });
      }
      catch (error) {
        console.error("Update error:", error);
        res.status(500).send("Internal server error");
      }
    })







    // delete my queries
    app.delete("/allqueries/:id",verifyJWT, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await usersQueriesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        await allRecCollection.deleteMany({ postID: id });

        if (result.deletedCount > 0) {
          res.send({ success: true, message: "Recommendation deleted." });
        }
      } catch (error) {
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // logout
    app.post("/logout", (req, res) => {
      res.clearCookie("access-token");
      res.json({ message: "Logged out successfully." });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello form express");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
