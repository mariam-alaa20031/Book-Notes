import bodyParser from 'body-parser'
import express from 'express'
import pg from 'pg'
import axios from 'axios'
import dotenv from 'dotenv'

const app = express()
const port= 3000
app.use(express.static('public'));
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

let currentUserId;
let currentUser;
let books;
let book;
let userBookId;

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
        return response.rows[0];
      } else {
        return null;
      }
    } catch (err) {
      console.log("Error occured while fetching book!");
    }
  }

async function deleteReview(user_id,book_id,review){
    try{
        const response= await db.query("SELECT FROM reviews WHERE book_id=$1 AND user_id=$2 AND review=$3",[book_id,user_id,review])
        console.log(user_id+ " "+book_id + " "+review);
        await db.query("DELETE FROM reviews WHERE book_id=$1 AND user_id=$2 AND review=$3",[book_id,user_id,review])
        console.log(response.rows[0]);
        await db.query("DELETE FROM reviews WHERE book_id=$1 AND user_id=$2 AND review=$3",[book_id,user_id,review])
        return {"success":"Deleted note successfully!"}
    }
    catch(err){
        return {"error":"Error occured while deleting!"}
    }
}  

async function updateReview(user_id,book_id,review, newReview){
    try{
        await db.query("UPDATE reviews SET review=$1 WHERE book_id=$2 AND user_id=$3 AND review=$4",[newReview,book_id,user_id,review])
        return {"success":"Updated note successfully!"}
    }
    catch(err){
        return {"error":"Error occured while deleting!"}
    }
}  

async function checkBookAdded(title){
    try{
        const bookAddedBefore= await db.query("SELECT * FROM book WHERE user_id=$1 AND LOWER(title)=$2",[currentUserId,title])
        return bookAddedBefore.rowCount>0?true:false;
       }catch(err){
          console.log("Error trying to check if book exists in user list or not!");
      }
}  

async function fetchReviews(bookUserId){
    try{
        const reviews= await db.query("SELECT * FROM reviews WHERE user_id=$1 AND book_id=$2",[currentUserId,bookUserId])
        return reviews.rowCount>0?reviews.rows:null;
       }catch(err){
          console.log("Error trying to check if book exists in user list or not!");
      }
}  

app.get("/", async (req,res)=>{
    res.render("index.ejs");
})

app.get("/login",  async (req,res)=>{
    const sortOption =req.query.sort?req.query.sort:"none"
    books= currentUserId? await fetchBooks(sortOption):books;
    if (sortOption === "date") {
            books.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    currentUserId? res.render("books.ejs",{books:books, user:currentUser, sortOption: sortOption}):
    res.render("index.ejs",{login:"login"})})

app.get("/logout",(req,res)=>{
    currentUserId=undefined;
    res.redirect("/")
})

app.post("/signup", async (req,res)=>{
    const {username, password}= req.body
    try{
    const response= await db.query("SELECT * FROM users WHERE username=$1",[username])
    if(response.rows.length==0){
    const user= await db.query("INSERT INTO users (username, password) VALUES ($1,$2) RETURNING *",[username,password])
    console.log(user.rows[0]);
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
    let isbnFormat=isbn.length===9||isbn.length===13?true:false;
    books=await fetchBooks("none")
    if(isbn && !isbnFormat){
        return res.render("books.ejs", {error:"Only 10/13 ISBN digits are accepted!", user:currentUser})
    }
    //check if isbn already present
    let alreadyExists= await checkBookAdded(title)
    if(alreadyExists){
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
            res.render("books.ejs", {error:"Error while trying to fetch book!", user:currentUser , books:books});}
       
        if(response.data.toString('base64')==="R0lGODlhAQABAPAAAAAAAP///yH5BAUAAAAALAAAAAABAAEAAAICRAEAOw=="){
            res.render("books.ejs",{error:"ISBN doesn't exist!", books:books,user:currentUser})}
        else{    
           await db.query("INSERT INTO book (user_id,isbn,title,cover,rating,date) VALUES ($1,$2,$3,$4,$5,$6)",[currentUserId,isbn,title,response.data,rating,new Date()])
           books= await fetchBooks("none")
           res.render("books.ejs", {success:"Added book successfully!",books:books, user:currentUser});
        }
    }
})


app.post("/login/sort",(req,res)=>{
    let option=req.body.sortOption;
    res.redirect(option?`/login?sort=${option}`:'/login')
})


app.post("/login/book", async(req, res) => {
    userBookId=req.body.userBookId
    book= await fetchBook(req.body.userBookId)
    let reviews = await fetchReviews(req.body.userBookId)
    res.render("book.ejs",{book:book,user:currentUser,reviews:reviews===null?"":reviews})    
});

app.post("/login/book/add-review", async(req,res)=>{
   const{userBookId, review}= req.body
   console.log(req.body);
   const book= await fetchBook(userBookId)
   let reviews;
   if(review){
      try{
          await db.query("INSERT INTO reviews (user_id,book_id,review) VALUES ($1,$2,$3)",[currentUserId,userBookId,review])
          reviews= await fetchReviews(userBookId)
          res.render("book.ejs",{book:book, user:currentUser,reviews:reviews===null?"":reviews, success:"Note added successfully!"})    

        }
      catch(err){
           let reviews = await fetchReviews(userBookId)
           res.render("book.ejs",{book:book,user:currentUser,reviews:reviews===null?"":reviews, error:"Note already exists!"})    

      } 
   }

})

app.post("/login/book/update-reviews",async (req,res)=>{
      const {book_id,user_id,review,updatedReview,type}= req.body
      console.log(req.body);
      console.log("book: "+book_id+ " user:"+user_id+ " review: "+review+ " updated: "+updatedReview+ " type"+type);
      const responseState= type==='delete'? await deleteReview(user_id,book_id,review): await updateReview(user_id,book_id,review,updatedReview)
      let reviews = await fetchReviews(userBookId)
      res.render("book.ejs",{book:book,user:currentUser,reviews:reviews===null?"":reviews,state:responseState})  
})

app.listen(port, ()=>{
    console.log("Server up and listening on port "+port + "!");
})
