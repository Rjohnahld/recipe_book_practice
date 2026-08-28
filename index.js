require('dotenv').config();
const express = require('express');
const app = express();
const { connect } = require("./db");
const cors = require("cors");
const mongoUri = process.env.MONGODB_URI;
const dbname = "recipe_book";
const { ObjectId } = require('mongodb')

//create the app
app.use(express.json())

app.use(cors());

app.get('/health', function (req, res) {
    res.json({
        "message": "I am alive!"
    })
})

async function main() {
    const db = await connect(mongoUri, dbname);
    try {

        console.log('Connected to MongoDB')
        app.get("/", function (req, res) {

        })
    } catch (error) {
        console.error('Error connecting to MongoDB', error)
    }
    // Search Engine
    app.get('/recipes', async function (req, res) {
        try {
            const { tags, cuisine, ingredients, name } = req.query;
            let query = {};

            if (tags) {
                query['tags.name'] = { $in: tags.split(',') };
            }

            if (cuisine) {
                query['cuisine.name'] = { $regex: cuisine, $options: 'i' };
            }

            if (ingredients) {
                query['ingredients.name'] = { $all: ingredients.split(',').map(i => new RegExp(i, 'i')) };
            }

            if (name) {
                query.name = { $regex: name, $options: 'i' };
            }

            const recipes = await db.collection('recipes').find(query).project({
                name: 1,
                'cuisine.name': 1,
                'tags.name': 1,
                _id: 0
            }).toArray();

            res.json({ recipes });
        } catch (error) {
            console.error('Error searching recipes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    //middleware
    async function creatingRecipe(req, res, next) {
        const { name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags } = req.body;

        // Basic validation
        if (!name || !cuisine || !ingredients || !instructions || !tags) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Fetch the cuisine document
        const cuisineDoc = await db.collection('cuisines').findOne({ name: cuisine });
        if (!cuisineDoc) {
            return res.status(400).json({ error: 'Invalid cuisine' });
        }

        // Fetch the tag documents
        const tagDocs = await db.collection('tags').find({ name: { $in: tags } }).toArray();
        if (tagDocs.length !== tags.length) {
            return res.status(400).json({ error: 'One or more invalid tags' });
        }

        // Create the new recipe object
        req.newRecipe = {
            name,
            cuisine: {
                _id: cuisineDoc._id,
                name: cuisineDoc.name
            },
            prepTime,
            cookTime,
            servings,
            ingredients,
            instructions,
            tags: tagDocs.map(tag => ({
                _id: tag._id,
                name: tag.name
            }))
        }
        next()
    }
    // Add new recipe
    app.post('/recipes', [creatingRecipe], async function (req, res) {
        try {
            // Insert the new recipe into the database
            const result = await db.collection('recipes').insertOne(req.newRecipe);

            // Send back the created recipe
            res.status(201).json({
                message: 'Recipe created successfully',
                recipeId: result.insertedId
            });
        } catch (error) {
            console.error('Error creating recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // Update Recipe
    app.put("/recipes/:id", [creatingRecipe], async function (req, res) {
        try {
            const results = await db.collection('recipes').updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: req.newRecipe }
            )
            if (results.matchedCount === 0) {
                return res.status(404).json({ error: 'Recipe not found' })
            }
            res.json({
                message: 'Recipe updated Successfully'
            })
        } catch (error) {
            console.error('Error updating recipe', error)
            res.status(500).json({ error: 'Internal Server error' })
        }
    })
    //Delete Recipe
    app.delete('/recipes/:id', async function (req, res) {
        try {
            const recipeId = req.params.id;

            // Attempt to delete the recipe
            const result = await db.collection('recipes').deleteOne({ _id: new ObjectId(recipeId) });

            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Recipe not found' });
            }

            res.json({ message: 'Recipe deleted successfully' });
        } catch (error) {
            console.error('Error deleting recipe:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
}
main()

app.listen(3000, function () {
    console.log("server has started")
})