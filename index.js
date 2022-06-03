const express = require("express");
constexpress = require('express')
const app = express();

// accept json in post request
app.use(express.json())

const { Coin, User, Wallet } = require('./src/db/models');

//http://localhost:5555/

//rutas
app.get('/', function (req,res) {
    res.send('hola')
})

app.get('/listwallets', async function(req,res) {
	const wallets = await Wallet.findAll();
    return res.send(wallets);
})

// get user wallets 
app.get('/getonewallet/:id', async function(req,res) {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    const wallet = await user.getWallets();
    return res.send(wallet);
})

app.get('/listcoins', async function(req,res) {
	const coins = await Coin.findAll();
    return res.send(coins);
})


/* ---- BEGIN USERS -------------------------------------------------------- */

app.get('/users/all', async function(req,res) {
	const users = await User.findAll();
    return res.send(users);
})

app.get('/users/find/:id', async function(req,res) {
	const userId = req.params.id;
    const user = await User.findByPk(userId);
    return res.send(user);
})

// sending params via post json
app.post('/users/register', async function(req,res) {
    const { firstName, lastName, email, password } = req.body;
    try {
        let newUser = await User.build({
            firstName: firstName, 
            lastName: lastName, 
            email: email, 
            password: password
          });
        newUser.save();
        res.status(201).send();
    } catch(err) {
        res.status(500).send();
    }
})

// login with email and password
app.post('/users/login', async function(req,res) {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email, password }})
    
        if( user == null) {
            return res.status(400).send('Usuario no encontrado');
        }
    
        res.status(201).send('Login Ok');
    
        } catch (error) {
            res.status(500).send();
        }
})

/* ---- END USERS -------------------------------------------------------- */


app.listen(5555);