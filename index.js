import bodyParser from 'body-parser'
import express from 'express'
import pg from 'pg'
import axios from 'axios'
import dotenv from 'dotenv'

const app = express()
const port= 3000
let currentUserId;
let currentUser;

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


async function fetchBooks(){
    try{
    const response= await db.query("SELECT * FROM book WHERE user_id=$1",[currentUserId])
    for(let i=0;i<response.rows.length;i++){
        response.rows[i].cover=response.rows[i].cover.toString('base64');
        console.log(response.rows[i].cover);
     }
    return response.rows;
}
    catch(err){
        console.log(err);
    }
}

app.get("/", async (req,res)=>{
    res.render("index.ejs");
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
    const user=await db.query("SELECT * FROM users WHERE username=$1",[username])
    const success= "Successfully registered!"
    res.render("index.ejs",{user:user.rows[0], success:success, login:"login"})}
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
     try{
     const user=await db.query("SELECT * FROM users WHERE username=$1 AND password=$2",[username,password])
     if(user.rowCount>0){
        currentUserId=user.rows[0].id
        currentUser=user.rows[0];
        const books= await fetchBooks()
        res.render("books.ejs",{user:currentUser, books:books})
     }
     else{
        res.render("index.ejs", {login:"login", error:"Wrong username or password!"})
     }}
     catch(err){
        res.render("index.ejs", {login:"login", error:"Error occured while authenticating!"})
     }
})    

app.post("/add", async (req,res)=>{
    const isbn= req.body.isbn;
    let isbnFormat=true;
    let books= await fetchBooks()
    for(let i=0;i<isbn.length;i++){
        if(isbn.charAt(i)<'0' || isbn.charAt(i)>'9'){
            isbnFormat=false;
        }
    }
    if(isbn && !isbnFormat){
        res.render("books.ejs", {error:"ISBN digits must be 0-9!", user:currentUser})
    }
    let alreadyAdded; 
    try{
      alreadyAdded= await db.query("SELECT * FROM book WHERE user_id=$1 AND isbn=$2",[currentUserId,isbn])
     }catch(err){
        console.log("Error trying to check if book exists in user list or not!");
    }

    if(alreadyAdded && alreadyAdded.rowCount>0){
        res.render("books.ejs", {error:"Book already in list!", user:currentUser });
    }
    else{
        console.log("Inside else");
        const url = 'https://covers.openlibrary.org/b/isbn/'+ isbn + '-M.jpg';
        let response;
        try{
        response = await axios.get(url, {
            responseType: 'arraybuffer',
        });}
        catch(err){
            res.render("books.ejs", {error:"ISBN doesn't exist!", user:currentUser , books:books});}
       
        if(response.data.toString('base64')==="R0lGODlhAQABAPAAAAAAAP///yH5BAUAAAAALAAAAAABAAEAAAICRAEAOw=="){
            res.render("books.ejs",{error:"ISBN doesn't exist!", books:books,user:currentUser})}
        else{    
           await db.query("INSERT INTO book (user_id,isbn,cover,date) VALUES ($1,$2,$3,$4)",[currentUserId,isbn,response.data,new Date()])
           books= await fetchBooks()
           res.render("books.ejs", {success:"Added book successfully!",books:books, user:currentUser});
        }
    }
})

app.listen(port, ()=>{
    console.log("Server up and listening on port "+port + "!");
})
