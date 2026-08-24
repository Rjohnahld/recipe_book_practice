require('dotenv').config();
const express = require('express');
const app = express();
const { connect } = require("./db");
const cors = require("cors");
const mongoUri = process.env.MONGODB_URI;
const dbname = "recipe_book";

//create the app
app.use(express.json())

app.use(cors());

app.get('/health', function(req,res){
    res.json({
        "message": "I am alive!"
    })
})

async function main() {
    const db = await connect(mongoUri, dbname);
    try {
        
        console.log('Connected to MongoDB')
            app.get("/", function(req,res){

            })
    } catch (error){
        console.error('Error connecting to MongoDB', error)
    }
    
    app.get("/recipes", async function(req,res){
        try{
            const recipes = await db.collection("recipes").find().project({
                _id: 0,
                name: 1,
                cuisine: 1,
                prepTime: 1,
            }).toArray();
            res.json({recipes});
        }catch (error){
            console.error('Errror Fetching Recipes:', error);
            res.status(500).json({error: "Internal server error"})
        }
    })
}
main()

app.listen(3000, function(){
    console.log("server has started")
})