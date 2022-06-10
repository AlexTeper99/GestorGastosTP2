const express = require('express');
const session = require('express-session');
const { randBitcoinAddress } = require('@ngneat/falso');
const moment = require('moment');

const app = express();


// accept json in post request
app.use(express.json());
app.use(
    session({
        secret:"Secret_Key",
        resave:false,
        saveUninitialized: false
    })
)

const isAuth = (req,res,next) => {
    if(req.session.isAuth) {
        next()
    } else {
        res.status(500).send('Usuario No Logueado')
    }
}

const isAdmin = (req,res,next) => {
    if(req.session.isAdmin) {
        next()
    } else {
        res.status(500).send('Usuario No Autorizado')
    }
}

const { Coin, User, Wallet, Notification, Admin, Cronbuy, Transaction } = require('./src/db/models');
const res = require('express/lib/response');

//http://localhost:5555/

//rutas
app.get('/', function (req,res) {
    res.send('hola')
})


// get user wallets

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

app.get('/users/profile',isAuth, async function(req,res) {
	const userId = req.session.userId;
    const user = await User.findByPk(userId);
    const viewData = {
        "Full Name": user.firstName + ' ' + user.lastName,
        "Email": user.email,
        "Member Since": user.createdAt
    }
    return res.send(viewData);
})

// sending params via post json
app.post('/users/register', async function(req,res) {
    const { firstName, lastName, email, password } = req.body;
    console.log(email)
    try {
        let user = await User.findOne({ where:{ email:email }});

        if(user) {
            res.status(201).send('Ya existe un usuario con ese email');
         } else {
            let newUser = await User.build({
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: password
              });

            newUser.save().then(async function() {
                let user = await User.findOne({ where:{ email:email }});
                let userId = user.id;
                let allCoins = await Coin.findAll();
                // creating an empty wallet for the User, with every Coin
                allCoins.forEach(
                    (coin) => {
                      let tableCoinId = coin.dataValues.id;
                      let newWallet = Wallet.build({
                        coinId: tableCoinId,
                        userId: userId,
                        balance: 0,
                        adress: randBitcoinAddress(),
                      });
                      newWallet.save();
                    }
                  );

            });

            res.status(201).send('Usuario Creado');
         }

    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})

// update a user
app.put('/users/update/:id', async function(req,res) {
    const { firstName, lastName, email, password } = req.body;
    const userId = req.params.id;
    try {
        await User.update({
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
          },{
              where:{ id:userId }
            });
        res.status(201).send('Usuario Actualizado');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion')
    }
})

// delete a user by id // asociations not checked
app.delete('/users/delete/:id', isAdmin, async function(req,res) {
    const userId = req.params.id;
    try {
        await User.destroy({
              where:{ id:userId }
            });
        res.status(201).send('Usuario Borrado');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
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

        req.session.isAuth = true;
        req.session.userId = user.id;
        req.session.isAdmin = false;

        // check if user is admin
        const admin = await Admin.findOne({ where: { userId:user.id }})
        if( admin !== null) {
            req.session.isAdmin = true;
            console.log("user is Admin !!")
        }

        res.status(201).send('Login Ok');

        } catch (error) {
            res.status(500).send();
        }
})

app.post('/users/logout', async function(req,res) {
    req.session.isAuth = false;
    req.session.userId = null;
    res.status(201).send('Logout Ok');
})

/*list user wallets*/
app.get('/listUserWallets', isAuth, async function(req,res) {
	const userId = req.session.userId;

    const wallets = await Wallet.findAll({
            where:{
                userId:userId
            }
    });
    return res.send(wallets);
})


/* ---- END USERS -------------------------------------------------------- */

/* ---- BEGIN WALLET -------------------------------------------------------- */


/*list wallets*/
app.get('/listwallets', async function(req,res) {
	const wallets = await Wallet.findAll();
    return res.send(wallets);
})

/*get wallet by id*/
app.get('/getonewallet/:id', async function(req,res) {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    const wallet = await user.getWallets();
    return res.send(wallet);
})

/* add wallet */
app.post('/wallets/new', async function(req,res) {
    const { coinId, userId, balance, adress } = req.body;
    try {
        let newWallet = await Wallet.build({
            coinId: coinId,
            userId: userId,
            balance: balance,
            adress: adress,
          });
          newWallet.save();
        res.status(201).send('Wallet Registrada');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion')
    }
})

app.put('/wallets/update/:id', async function(req,res) {
    const { coinId, userId, balance, adress } = req.body;
    const walletId = req.params.id;
    try {
        await Wallet.update({
            coinId: coinId,
            userId: userId,
            balance: balance,
            adress: adress,
          },{
              where:{ id:walletId }
            });
        res.status(201).send('Wallet Actualizada');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion')
    }
})

app.delete('/wallets/delete/:id', isAdmin, async function(req,res) {
    const walletId = req.params.id;
    try {
        await Wallet.destroy({
              where:{ id:walletId }
            });
        res.status(201).send('Wallet Borrada / se fue a cero');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})

/* ---- END WALLET -------------------------------------------------------- */

/* ---- BEGIN COINS --------------------------------------------------------*/

app.post('/coins/buy', isAuth, async function(req,res) {
    const { tickerSearch, quantity } = req.body;

    let coinToBuy = await Coin.findOne({ where: { ticker: tickerSearch }});
    let coinUsdt = await Coin.findOne({ where: { ticker: 'USDT' }});
    let userIdBuscado = req.session.userId;


   try {
       const walletUsdt = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinUsdt.id }});
       const walletCoin = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinToBuy.id }});

         let netPrice = coinToBuy.unitDolarPrice * quantity;
         let resString = "";

        if (walletUsdt.balance >= netPrice) {

            walletUsdt.balance = walletUsdt.balance - netPrice;
           await walletUsdt.save();

           walletCoin.balance = walletCoin.balance + quantity;
           await walletCoin.save();

           resString = 'Compraste ' + quantity + ' ' + tickerSearch;
        } else {
           resString = 'No tienes suficiente dinero para comprar ' + quantity + ' ' + tickerSearch;
        }
       res.status(201).send(resString);

    } catch(err) {
       res.status(500).send('No se pudo realizar la operacion');
    }

})

app.post('/coins/sell', isAuth, async function(req,res) {
    const { tickerSearch, quantity } = req.body;

    let coinToSell = await Coin.findOne({ where: { ticker: tickerSearch }});
    let coinUsdt = await Coin.findOne({ where: { ticker: 'USDT' }});
    let userIdBuscado = req.session.userId;

   try {
       const walletUsdt = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinUsdt.id }});
       const walletCoin = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinToSell.id }});

         let netPay = coinToSell.unitDolarPrice * quantity;
         let resString = "";

        if (walletCoin.balance >= quantity) {

            walletUsdt.balance = walletUsdt.balance + netPay;
           await walletUsdt.save();

           walletCoin.balance = walletCoin.balance - quantity;
           await walletCoin.save();

           resString = 'Vendiste ' + quantity + ' ' + tickerSearch + ' por ' + netPay + ' USDT';
        } else {
           resString = 'No tienes esa cantidad de ' + tickerSearch;
        }
       res.status(201).send(resString);

    } catch(err) {
       res.status(500).send('No se pudo realizar la operacion');
    }

})

app.post('/coins/swap', isAuth, async function(req,res) {
    const { tickerSell, tickerBuy, quantity } = req.body;

    let coinToSell = await Coin.findOne({ where: { ticker: tickerSell }});
    let coinToBuy = await Coin.findOne({ where: { ticker: tickerBuy }});
    let userIdBuscado = req.session.userId;

   try {
        const walletSell = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinToSell.id }});
        const walletBuy = await Wallet.findOne({ where: { userId:userIdBuscado, coinId:coinToBuy.id }});
        let resString = "";

        
        if (walletSell.balance >= quantity) {

           let netUsdt = quantity * coinToSell.unitDolarPrice;
           walletSell.balance = walletSell.balance - quantity;         
           let quantityCoin = netUsdt/coinToBuy.unitDolarPrice;
           walletBuy.balance = walletBuy.balance + quantityCoin;

           await walletSell.save();
           await walletBuy.save();

           resString = 'Vendiste ' + quantity + ' ' + tickerSell + ' por ' + quantityCoin + tickerBuy;
        } else {
           resString = 'No tienes esa cantidad de ' + tickerSell;
        }
       res.status(201).send(resString);

    } catch(err) {
       res.status(500).send('No se pudo realizar la operacion');
    }

})

app.post('/coins/deposit', isAuth, async function(req,res) {
    const { adress, quantity } = req.body;
    let resString = "";
    
   try {
        let depositWallet = await Wallet.findOne({ where: { adress: adress }});
        
        if(depositWallet != null) {
            let depositCoin = await Coin.findOne({ where: { id: depositWallet.coinId}})
            
            depositWallet.balance += quantity;
            await depositWallet.save();

            resString = 'Depositaste ' + quantity + ' ' + depositCoin.ticker;
        } else {
            resString = 'No existe la wallet';
        }
       
        res.status(201).send(resString);
    } catch(err) {
       res.status(500).send('No se pudo realizar la operacion');
    }

})

app.post('/coins/withdraw', isAuth, async function(req,res) {
    const { adress, ticker, quantity } = req.body;
    let resString = "";
    let userId = req.session.userId;

   try {
        let withdrawCoin = await Coin.findOne({ where: { ticker: ticker}})
        let withdrawWallet = await Wallet.findOne({ where: { coinId: withdrawCoin.id, userId: userId }});

        if(withdrawWallet != null && withdrawWallet.balance >= quantity) {
            withdrawWallet.balance -= quantity;
            await withdrawWallet.save();
            resString = 'Retiraste ' + quantity + ' ' + ticker + " a la direccion " + adress + ". Balance: " + withdrawWallet.balance;
        } else {
            resString = 'No tienes esa cantidad de ' + ticker;
        }

        res.status(201).send(resString);
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }

})

//  send coins to a user with email
app.post('/coins/sendToEmail', isAuth, async function(req,res) {
    const { email, ticker, quantity } = req.body;
    let userLoggedId = req.session.userId;
    
    try {
        
        let coin = await Coin.findOne({ where: { ticker: ticker}});
        let withdrawWallet = await Wallet.findOne({ where: { coinId: coin.id, userId: userLoggedId }});
        
        let userToSend = await User.findOne({ where: { email: email}});
        let userToSendWallet = await Wallet.findOne({ where: { coinId: coin.id, userId: userToSend.id }});
        
        if(withdrawWallet.balance >= quantity && userToSend != null) {
            
            withdrawWallet.balance = withdrawWallet.balance - quantity;
            userToSendWallet.balance = userToSendWallet.balance + quantity;
            
            await withdrawWallet.save();
            await userToSendWallet.save();
            
            var resString = 'Enviaste ' + quantity + ' ' + ticker + " a " + email + ". Balance: " + withdrawWallet.balance;
             
        } else {
            res.status(201).send("No se pudo realizar la operacion");    
        }
        
        res.status(201).send(resString);
        
    } catch(err) {
        res.status(500).send(err.error);
    }

})


//END COINS

//------BEGIN NOTIFICATION ------

//LIST ALL NOTIFICATIONS
app.get('/notifications', async function (req,res){
    let notifications = await Notification.findAll()
    return res.send(notifications)
})

//get user notifications (logged user)
app.get('/notifications/notificationsfromlogged', isAuth, async function (req,res){
    const userId = req.session.userId;

    const user = await User.findByPk(userId);
    console.log("TODAS LAS WALLETS DE ESTE USUARIO " + allWallets)
    const notification = await user.getNotifications();

    return res.send(notification)
})

//new notification
// sending params via post json
app.post('/notifications/newnotification', async  function (req, res){
   console.log('METODO NEW NOTIFICATION')
    const {title, text, userId} = req.body;
    console.log('TITULO ' + title);
    try{
        let user = await User.findOne({ where:{ id:userId }});
        console.log('USUARIO BUSCADO ' + user.firstName)

        if(user == null){
            res.status(500).send('No se encontro a un usuario con ese id');
        }else{
            let newNotification = await Notification.create({title: title, text: text, userId:userId, seen: 0}) //COMO LE PASO LA FECHA?
            console.log(newNotification)


        }
        res.status(201).send('NOTIFICACION CREADA');

    }catch (err){
        res.status(500).send('No se pudo realizar la operacion' + err);
    }
})

app.delete('/notifications/delete/:id', async function(req,res) {
    const notificationId = req.params.id;
    try {
        await Notification.destroy({
            where:{ id:notificationId }
        });
        res.status(201).send('Notificacion Borrada del sistema');
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})


//------END NOTIFICATION---------

//---------------------------------------BEGIN TRANSACTIONS---------------------------------
//LIST ALL TRANSACTIONS
app.get('/transactions', async function (req,res){
    let transactions = await Transaction.findAll();
    return res.send(transactions)
})



//---------------------------------------END TRANSACTIONS-----------------------------------

/* METODOS JS -----------------------------------------------------------------------------------------------*/

const getCoinIdByTicker = async function(ticker) {

    let coinSearchedByTicker = await Coin.findOne({ where: { ticker: ticker }});

    return coinSearchedByTicker.id;
}


// ---- CRON BUYs -------------------------------

// set a cron buy for a user
app.post('/cronbuys/set', isAuth, async function(req,res) {
    const { ticker, usdAmount, frequency } = req.body;
    let userId = req.session.userId;
    try {
        let coin   = await Coin.findOne({ where:{ ticker:ticker }});
        let coinId = coin.id;
        let cron = await Cronbuy.findOne({ where:{ userId:userId, coinId:coinId }});

        if(cron) {
            try {
                await cron.update({
                    userId: userId,
                    coinId: coinId,
                    usdAmount: usdAmount,
                    frequency: frequency
                });
                res.status(201).send('Compra Recurrente Actualizada');
            } catch(err) {
                res.status(500).send('No se pudo realizar la operacion')
            }
         } else {
            let newCron = await Cronbuy.build({
                userId: userId,
                coinId: coinId,
                usdAmount: usdAmount,
                frequency: frequency,
                lastPurchaseDate: new Date()
            });
            newCron.save();
            res.status(201).send('Compra Recurrente Creada');
         }

    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})

// delete a cron buy for a user
app.delete('/cronbuys/delete/:ticker', isAuth, async function(req,res) {
    const userId = req.session.userId;
    const ticker = req.params.ticker;
    try {
        let coin = await Coin.findOne({ where:{ ticker:ticker }});
        let coinId = coin.id;
        await Cronbuy.destroy({
              where:{ userId:userId,coinId:coinId }
            });
        res.status(201).send('Se Ha Eliminado La Compra Recurrente de ' + ticker);
    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})

// modify $usd Amount or frequency (days) for a cron buy
app.post('/cronbuys/update', isAuth, async function(req,res) {
    const { ticker, usdAmount, frequency } = req.body;
    let userId = req.session.userId;

    try {

        let coin   = await Coin.findOne({ where:{ ticker:ticker }});
        let coinId = coin.id;

        let cron = await Cronbuy.findOne({ where:{ userId:userId, coinId:coinId }});

        if(cron) {
            try {
                await cron.update({
                    userId: userId,
                    coinId: coinId,
                    usdAmount: usdAmount,
                    frequency: frequency
                });
                res.status(201).send('Compra Recurrente Actualizada');
            } catch(err) {
                res.status(500).send('No Tiene Compras Recurrentes de ' + ticker)
            }
         } else {

            res.status(500).send('No se pudo realizar la operacion');
         }

    } catch(err) {
        res.status(500).send('No se pudo realizar la operacion');
    }
})

// run the cron buy
async function runCronBuys() {
    const cronBuys = await Cronbuy.findAll();
    let today = moment();
    try{
        cronBuys.forEach(async (cron) => {
            let diffDays = today.diff(cron.lastPurchaseDate,'days');

            if(diffDays >= cron.frequency) {
                let coinToBuy = await Coin.findByPk(cron.coinId);
                let usdtCoin  = await Coin.findOne({ where: { ticker: 'USDT' }});

                // User USD wallet
                let usdUserWallet = await Wallet.findOne({ where: { coinId:usdtCoin.id, userId:cron.userId }});
                // User XX Coin Wallet
                let coinUserWallet = await Wallet.findOne({ where: { coinId:cron.coinId, userId:cron.userId }});

                if (usdUserWallet.balance >= cron.usdAmount) {
                    usdUserWallet.balance = usdUserWallet.balance - cron.usdAmount;
                    await usdUserWallet.save();

                    // calculo de cantidad de moneda a comprar
                    let amtBuy = cron.usdAmount / coinToBuy.netPrice; 

                    coinUserWallet.balance = coinUserWallet.balance + amtBuy;
                    await coinUserWallet.save();

                    await cron.update({
                        lastPurchaseDate: new Date()
                    });

                    // emitir notificacion a usuario // compra recurrente de X coin
                    console.log('User id: ' + cron.userId + ' compro ' + cron.usdAmount + ' de ' + coinToBuy.ticker);

                }
            }

        });
    } catch(e) {
        console.log(e.error);
        res.status(500).send('Error en Cron Buys');
    }
}

// probando cron buy / seria un cron job del servidor en realidad
app.get('/cronbuys/run', async function(req,res) {
    try {
        await runCronBuys();
        res.status(201).send('Cron Buys Ejecutado Ok');
    } catch(e) {
        res.status(501).send('Error en Cron buys');
    }


});


// ---- END CRON BUY -------------------------------


app.listen(5555);