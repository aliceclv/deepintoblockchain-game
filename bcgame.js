var io;
var gameSocket;
var db;
var colors = ['#E74C3C', '#2185C5', '#FFF6E5', '#7ECEFD'];

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket, sdb) {
  io = sio;
  gameSocket = socket;
  db = sdb;
  gameSocket.emit('connected', { message: "You are connected!" });

  // Provided by Ana
  // //common event
  // gameSocket.on('findLeader',findLeader);

  // Host Events
  gameSocket.on('hostCreateNewGame', hostCreateNewGame);
  gameSocket.on('hostRoomFull', hostPrepareGame);
  gameSocket.on('hostCountdownFinished', hostStartGame);
  gameSocket.on('hostNextChain', hostNextChain);

  // Player Events
  gameSocket.on('playerJoinGame', playerJoinGame);
  gameSocket.on('playerAnswer', playerAnswer);
  // gameSocket.on('playerRestart', playerRestart);
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
function hostCreateNewGame() {
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;
    console.log(thisGameId);
    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Join the Room and wait for the players
    this.join(thisGameId.toString());
};

/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    console.log("All Players Present. Preparing game...");

    io.sockets.in(data.gameId).emit('beginNewGame', data);
};

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');

    // TODO: we send words
    sendWordToPlayers(0,gameId);
};


/**
 * A player answered correctly. Time for the next word.
 * @param data { gameId: *, chain: *, block: * }
 * @param data Sent from the client. Contains the current round and gameId (room)
 */
function hostNextChain(data) {
    if(data.chain < wordPool.length){
      // Send a new word back to the players.
      sendWordToPlayers(data.chain, data.gameId);
    } else {
      if(!data.done) {
        //updating players win count
        db.all("SELECT * FROM player WHERE player_name=?",data.winner, function(err, rows) {
            rows.forEach(function (row) {
                win=row.player_win;
                win++;
                console.log(win);
                db.run("UPDATE player SET player_win = ? WHERE player_name = ?", win, data.winner);
                console.log(row.player_name, row.player_win);
            })
        });
        data.done++;
      }
        // If the current round exceeds the number of words, send the 'gameOver' event.
      io.sockets.in(data.gameId).emit('gameOver',data);
    }
};



/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName, playerColor and gameId.
 */
function playerJoinGame(data) {
    console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // Attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Attach color to player
        data.playerColor = colors.splice(Math.floor(Math.random()*colors.length), 1);

        // Join the room
        sock.join(data.gameId);
        db.serialize(function()
            {
                var stmt = " SELECT * FROM player WHERE player_name='"+data.playerName+"';";
                db.get(stmt, function(err, row){
                    if(err) throw err;
                    if(typeof row == "undefined") {
                            db.prepare("INSERT INTO player (player_name,player_color,player_win) VALUES(?,?,?)").run(data.playerName,data.playerColor,0).finalize();
                    } else {
                        console.log("row is: ", row);
                    }
                });
            });
        //console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
};


/**
 * A player has entered an answer word.
 * @param data { gameId: *, playerId: *, answer: *, currentBlock: *, currentChain: * }
 */
function playerAnswer(data) {
    // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // The player's answer is attached to the data object.
    // Emit an event with the answer so it can be checked by the 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
};



/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

/**
 * Get a word for the host, and a list of words for the player.
 *
 * @param wordPoolIndex
 * @param gameId The room identifier
 */
// TODO: implement my own game logic
// function sendWord(wordPoolIndex, gameId) {
//     var data = getWordData(wordPoolIndex);
//     io.sockets.in(data.gameId).emit('newWordData', data);
// };

// We don't need to get a word for the host, we need to display color blocks
// if the color of the team has been chosen!
//

function sendWordToPlayers(wordPoolIndex, gameId) {
    // Get a word to send
    // TODO: wordPoolIndex corresponds to the rounds of the game
    var data = getWordData(wordPoolIndex);

    // Send it to the client through the rooms of Socket.IO
    // TODO: Was like that before but said it's undefined || Should I make a PR?
    // io.sockets.in(data.gameId).emit('newWordData', data);
    io.sockets.in(gameId).emit('newWordData', data);
};

/**
 * This function does all the work of getting a new words from the pile
 * and organizing the data to be sent back to the clients.
 *
 * @param i The index of the wordPool.
 * @returns {{chainNumber: *, blockNumber: *, word: *, answer: *}}
 */
function getWordData(i){
    // // Randomize the order of the available words.
    // // The first element in the randomized array will be displayed on the host screen.
    // // The second element will be hidden in a list of decoys as the correct answer
    // var words = shuffle(wordPool[i].words);

    // // Randomize the order of the decoy words and choose the first 5
    // var decoys = shuffle(wordPool[i].decoys).slice(0,5);

    // // Pick a random spot in the decoy list to put the correct answer
    // var rnd = Math.floor(Math.random() * 5);
    // decoys.splice(rnd, 0, words[1]);

    // // Package the words into a single object.
    // var wordData = {
    //     round: i,
    //     word : words[0],
    // Displayed Word
    //     answer : words[1], // Correct Answer
    //     list : decoys      // Word list for player (decoys and answer)
    // };

    // return wordData;
    var wordData = {
      chainNumber: i,
      blockNumber: wordPool[i][0],
      word: wordPool[i][1],
      answer: wordPool[i][2]
    };

    return wordData;
};


/*
 * Javascript implementation of Fisher-Yates shuffle algorithm
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
// function shuffle(array) {
//     var currentIndex = array.length;
//     var temporaryValue;
//     var randomIndex;

//     // While there remain elements to shuffle...
//     while (0 !== currentIndex) {

//         // Pick a remaining element...
//         randomIndex = Math.floor(Math.random() * currentIndex);
//         currentIndex -= 1;

//         // And swap it with the current element.
//         temporaryValue = array[currentIndex];
//         array[currentIndex] = array[randomIndex];
//         array[randomIndex] = temporaryValue;
//     }

//     return array;
// };

/**
 * Each element in the array provides data for a single round in the game.
 *
 * In each round, two random "words" are chosen as the host word and the correct answer.
 * Five random "decoys" are chosen to make up the list displayed to the player.
 * The correct answer is randomly inserted into the list of chosen decoys.
 *
 * @type {Array}
 */


var wordPool = [
  [1, "block", "aknbj"],
  [1, "blockchain", "aknbjbgzhm"],
  [1, "chain", "bgzhm"],
  [1, "contract", "bnmsqzbs"],
  [2, "drugs", "cqtfr"],
  [2, "ethereum", "dsgdqdtl"],
  [2, "future", "etstqd"],
  [2, "golem", "fnkdl"]
];

// var wordPool = [
//   [1, "block", "aknbj"],
//   [1, "blockchain", "aknbjbgzhm"],
//   [1, "chain", "bgzhm"],
//   [1, "contract", "bnmsqzbs"],
//   [2, "drugs", "cqtfr"],
//   [2, "ethereum", "dsgdqdtl"],
//   [2, "future", "etstqd"],
//   [2, "golem", "fnkdl"],
//   [3, "insurance", "hmrtqzmbd"],
//   [3, "ledger", "kdcfdq"],
//   [3, "litecoin", "khsdbnhm"],
//   [3, "marketplace", "lzqjdsokzbd"],
//   [4, "organization", "nqfzmhyzshnm"],
//   [4, "payment system", "ozxldmszrxrsdl"],
//   [4, "political", "onkhshbzk"],
//   [4, "proof of work", "oqnneznezvnqj"],
//   [5, "transactions", "sqzmrzbshnmr"],
//   [5, "transparency", "sqzmrozqdmbx"],
//   [5, "trust", "sqtrs"],
//   [5, "wallet", "vzkkds"],
//   [6, "api", "bqj"],
//   [6, "autonomous", "bvupopnpvt"],
//   [6, "banks", "cbolt"],
//   [6, "bitcoin", "cjudpjo"],
//   [7, "crypto-currency", "dszqup.dvssfodz"],
//   [7, "database", "ebubcbtf"],
//   [7, "decentralization", "efdfousbmjabujpo"],
//   [7, "disrupt", "ejtsvqu"],
//   [8, "government", "hpwfsonfou"],
//   [8, "guns", "hvot"],
//   [8, "hash", "ibti"],
//   [8, "industry", "joevtusz"],
//   [9, "media", "nfejb"],
//   [9, "mining", "njojoh"],
//   [9, "network", "ofuxpsl"],
//   [9, "openness", "pqfooftt"],
//   [10, "satoshi nakamoto", "tbuptij!oblbnpup"],
//   [10, "silkroad", "tjmlspbe"],
//   [10, "system", "tztufn"],
//   [10, "technology", "ufdiopmphz"]
// ];
