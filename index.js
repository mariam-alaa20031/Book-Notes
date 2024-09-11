import bodyParser from 'body-parser'
import express from 'express'
import pg from 'pg'
import axios from 'axios'
import dotenv from 'dotenv'

const app = express()
const port= 3000
let currentUserId;
let currentUser;
let books;

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




async function fetchBooks(sortOption){
    try{
     let query="";   
     switch(sortOption){
        case "title":  query="SELECT * FROM book WHERE user_id=$1 ORDER BY title ASC";
                       break;
        case "date" :  query="SELECT * FROM book WHERE user_id=$1 ORDER BY date DESC";
                       break;
        case "rating": query="SELECT * FROM book WHERE user_id=$1 ORDER BY rating DESC";
                       break;                            
        default:       query="SELECT * FROM book WHERE user_id=$1"             
                      
     }
    const response= await db.query(query,[currentUserId])
    for(let i=0;i<response.rows.length;i++){
        response.rows[i].cover=response.rows[i].cover.toString('base64');
     }
    return response.rows;
}
    catch(err){
        console.log(err);
    }
}

async function fetchBook(id) {
    try {
      const response = await db.query('SELECT * FROM book WHERE id=$1', [id]);
      if (response.rowCount > 0) {
        response.rows[0].cover = response.rows[0].cover.toString('base64');
        console.log(response.rows[0]);
        return response.rows[0];
      } else {
        console.log('No book found with this ID');
        return null;
      }
    } catch (err) {
      console.log(err);
    }
  }
  

app.get("/", async (req,res)=>{
    res.render("index.ejs");
})



app.get("/login",  async (req,res)=>{
    const sortOption =req.query.sort?req.query.sort:"none"
    if(currentUserId){
          books=await fetchBooks(sortOption);
          if (sortOption === "date") {
            books.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
          res.render("books.ejs",{books:books, user:currentUser, sortOption: sortOption})
    }
    else{
     res.render("index.ejs",{login:"login"})}})

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
        books= await fetchBooks("none");
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
    const {title, isbn, rating}= req.body;
    
    // check format isbn
    let isbnFormat=true;
    let books= await fetchBooks("none")

    for(let i=0;i<isbn.length;i++){
        if(isbn.charAt(i)<'0' || isbn.charAt(i)>'9'){
            isbnFormat=false;
        }
    }
    if(isbn && !isbnFormat){
        res.render("books.ejs", {error:"ISBN digits must be 0-9!", user:currentUser})
    }
    //check if isbn already present
    let alreadyAdded; 
    try{
      alreadyAdded= await db.query("SELECT * FROM book WHERE user_id=$1 AND LOWER(title)=$2",[currentUserId,title])
     }catch(err){
        console.log("Error trying to check if book exists in user list or not!");
    }

    if(alreadyAdded && alreadyAdded.rowCount>0){
        res.render("books.ejs", {error:"Book already in list!", user:currentUser });
    }
    else{
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
           await db.query("INSERT INTO book (user_id,isbn,title,cover,rating,date) VALUES ($1,$2,$3,$4,$5,$6)",[currentUserId,isbn,title,response.data,rating,new Date()])
           books= await fetchBooks("none")
           res.render("books.ejs", {success:"Added book successfully!",books:books, user:currentUser});
        }
    }
})

app.post("/login/sort",async (req,res)=>{
    let option;
    if(req.body.sortOption){
        option=req.body.sortOption;
        console.log(option);
        res.redirect(`/login?sort=${option}`)
    }
    else{
        res.redirect('/login')
    }
   

})

app.post("/login/book", async(req, res) => {
    const book= await fetchBook(req.body.userBookId)
    console.log(req.body.userBookId);
    console.log(book);
    res.render("book.ejs",{book:book,user:currentUser})
   
    
});


app.listen(port, ()=>{
    console.log("Server up and listening on port "+port + "!");
})
