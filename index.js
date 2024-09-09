import bodyParser from 'body-parser'
import express from 'express'
import pg from 'pg'
import axios from 'axios'
import dotenv from 'dotenv'

const app = express()
const port= 3000
app.use(express.static("public"))
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
dotenv.config();

const db= new pg.Client({
    user:process.env.USER,
    password:process.env.PASS,
    host:"localhost",
    database:"books",
    port: 5432
})

db.connect();
 
app.get("/", async (req,res)=>{
    const url = 'https://covers.openlibrary.org/b/id/12547191-M.jpg';
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
    });
    console.log(response.data.toString('base64'));
    res.render("index.ejs", {img: response.data.toString('base64') });
})

app.post("/signup", async (req,res)=>{
    const {username, password}= req.body
    await d
})

app.listen(port, ()=>{
    console.log("Server up and listening on port "+port + "!");
})
