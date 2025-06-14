const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(express.json());
app.use(cors());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ddy6nyc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // DB name 
    const db = client.db('pickPerfectDB');
    // Collection name
    const usersQueriesCollection = db.collection("usersQueries");
    const allRecCollection = db.collection('allRecommendation');

    // adding queries
    app.post('/allqueries', async (req, res) =>{
        const queriesData = req.body;
        const result = await usersQueriesCollection.insertOne(queriesData);
        res.send(result);
    })


    // all queries increment
    app.patch("/allqueries/:id", async (req, res) =>{
        const id = req.params.id;
        try{
            const result = await usersQueriesCollection.updateOne(
                { _id: new ObjectId(id) },
                { $inc: { recommendationCount: 1 } }
            );
            res.send(result);
        }
        catch (error) {
            res.status(500).send({ message: "Failed to increment", error });
          }
    })


    // all queries
    app.get('/allqueries', async (req, res) =>{
        try{
            const result = await usersQueriesCollection.find().toArray();
            res.send(result);
        } catch (error){
            console.error("Error fetching data:", error);
        }
    })
    // all recommendation 
    app.get('/recommendation', async (req, res) =>{
        try{
           const result = await allRecCollection.find().toArray();
           res.send(result);
        } catch(error){
            console.error("Error fetching data:", error);
        }
    })

    // sending recommendation to DB
    app.post('/recommendation', async (req, res) =>{
        const recData = req.body;
        const result = await allRecCollection.insertOne(recData);
        res.send(result);
    })


    // deleting a document using the id
    app.delete('/recommendation/:id', async (req, res) =>{
        const id = req.params.id;
        try {
            const result = await allRecCollection.deleteOne({_id: new ObjectId(id)});
            if (result.deletedCount > 0) {
                res.send({ success: true, message: "Recommendation deleted." });
              }
        }
        catch(error){
            res.status(500).send({ success: false, error: error.message });
        }
    })










    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.get('/', (req, res) =>{
    res.send("hello form express");
});

app.listen(port, () =>{
    console.log(`Server running at http://localhost:${port}`);
})