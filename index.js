import bodyParser from 'body-parser'
import express from 'express'
import pg from 'pg'
import axios from 'axios'
import dotenv from 'dotenv'

const app = express()
const port= 3000
let currentUserId;

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

app.get("/login", (req,res)=>{
     res.render("index.ejs",{login:"login"})
})

app.get("/logout",(req,res)=>{
    currentUserId=undefined;
    res.redirect("/")
})

app.post("/signup", async (req,res)=>{
    const {username, password}= req.body
    try{
    const response= await db.query("SELECT * FROM users WHERE username=$1",[username])
    if(response.rows.length==0){
    await db.query("INSERT INTO users (username, password) VALUES ($1,$2)",[username,password])
    const response=await db.query("SELECT * FROM users WHERE username=$1",[username])
    const success= "Successfully registered!"
    res.render("index.ejs",{user:response.rows, success:success, login:"login"})}
    else{
        const error="Username already exists!"
        res.render("index.ejs", {error:error})
    }
}
    catch(err){
        console.log(err);
    }})

app.post("/login", async (req,res)=>{
     const {username, password}=req.body
     const exists=await db.query("SELECT * FROM users WHERE username=$1 AND password=$2",[username,password])
     if(exists.rowCount>0){
        res.render("new.ejs",{user:exists.rows[0]})
     }
     else{
        res.render("index.ejs", {login:"login", error:"Wrong username or password!"})
     }
})    

app.listen(port, ()=>{
    console.log("Server up and listening on port "+port + "!");
})
