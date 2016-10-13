var io;
var gameSocket;
var db;
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

  // // Host Events
  gameSocket.on('hostCreateNewGame', hostCreateNewGame);
  gameSocket.on('hostRoomFull', hostPrepareGame);
  gameSocket.on('hostCountdownFinished', hostStartGame);
  // gameSocket.on('hostNextRound', hostNextRound);

  // // Player Events
  gameSocket.on('playerJoinGame', playerJoinGame);
  // gameSocket.on('playerAnswer', playerAnswer);
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



/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);
        db.serialize(function()
            {
                var stmt = " SELECT * FROM player WHERE player_name='"+data.playerName+"';";
                db.get(stmt, function(err, row){
                    if(err) throw err;
                    if(typeof row == "undefined") {
                            db.prepare("INSERT INTO player (player_name,player_win) VALUES(?,?)").run(data.playerName,0).finalize();
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
    //     word : words[0],   // Displayed Word
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
  [1, "hello", "gdkkn"], [1, "cup", "bto"]
];
