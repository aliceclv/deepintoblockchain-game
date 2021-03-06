;
jQuery(function($){
  'use strict';

  /**
   * All the code relevant to Socket.IO is collected in the IO namespace.
   *
   * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
   */

  var IO = {
    /**
     * This is called when the page is displayed. It connects the Socket.IO client
     * to the Socket.IO server
     */

    init: function() {
      // This function is provided by Socket.IO
      IO.socket = io.connect();

      // This function has to be defined
      IO.bindEvents();
    },

    /**
     * While connected, Socket.IO will listen to the following events emitted
     * by the Socket.IO server, then run the appropriate function.
     */
    bindEvents : function() {
        IO.socket.on('connected', IO.onConnected );
        IO.socket.on('newGameCreated', IO.onNewGameCreated );
        IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
        IO.socket.on('beginNewGame', IO.beginNewGame);
        IO.socket.on('newWordData', IO.onNewWordData);
        IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
        IO.socket.on('gameOver', IO.gameOver);
        // IO.socket.on('error', IO.error );
        // IO.socket.on('showLeader',IO.showLeader);

        IO.socket.on('playerWrongAnswer', IO.onWrongAnswer);
    },

    /**
     * The client is successfully connected!
     */
    onConnected : function() {
        // Cache a copy of the client's socket.IO session ID on the App
        App.mySocketId = IO.socket.socket.sessionid;
        // Error: data not defined
        // console.log(data.message);
    },

    /**
     * A new game has been created and a random game ID has been generated.
     * @param data {{ gameId: int, mySocketId: * }}
     */
    onNewGameCreated : function(data) {
        App.Host.gameInit(data);
    },

    /**
     * A player has successfully joined the game.
     * @param data {{playerName: string, gameId: int, mySocketId: int}}
     */
    playerJoinedRoom : function(data) {
        // When a player joins a room, do the updateWaitingScreen funciton.
        // There are two versions of this function: one for the 'host' and
        // another for the 'player'.
        //
        // So on the 'host' browser window, the App.Host.updateWiatingScreen function is called.
        // And on the player's browser, App.Player.updateWaitingScreen is called.
        App[App.myRole].updateWaitingScreen(data);
    },

    /**
     * Both players have joined the game.
     * @param data
     */
    beginNewGame : function(data) {
      App[App.myRole].gameCountdown(data);
    },

    /**
     * A new word for the round is returned from the server.
     * @param data{{chainNumber: *, blockNumber: *, word: *, answer: *}}
     */
    onNewWordData : function(data) {
        // Here is the structure of the data:
        // var wordData = {
        //   chainNumber: i,
        //   blockNumber: wordPool[i][0],
        //   word: wordPool[i][1],
        //   answer: wordPool[i][2]
        // };

        // Update the current round || chainNumber
        App.currentChain = data.chainNumber;

        // Update the current block || When we have to validate a block after
        App.currentBlock = data.blockNumber;

        // Change the word for the Player
        App[App.myRole].newWord(data);
    },

    /**
     * A player answered. If this is the host, check the answer.
     * @param data { gameId: *, playerId: *, answer: *, currentBlock: *, currentChain: * }
     */
    hostCheckAnswer : function(data) {
        if(App.myRole === 'Host') {
            App.Host.checkAnswer(data);
        }
    },

    /**
     * A player answered. But it's the wrong answer.
     */
    onWrongAnswer : function() {
      App.Player.onWrongAnswer();
    },

    /**
     * Let everyone know the game has ended.
     * @param data
     */
    gameOver : function(data) {
        App[App.myRole].endGame(data);
    }

  };

  var App = {
    /**
     * Keep track of the gameId, which is identical to the ID
     * of the Socket.IO Room used for the players and host to communicate
     *
     */
    gameId: 0,

    /**
     * This is used to differentiate between 'Host' and 'Player' browsers.
     */
    myRole: '',   // 'Player' or 'Host'

    /**
     * The Socket.IO socket object identifier. This is unique for
     * each player and host. It is generated when the browser initially
     * connects to the server when the page loads for the first time.
     */
    mySocketId: '',

    /**
     * Identifies the current chain || round. Starts at 0 because it corresponds
     * to the array of word data stored on the server.
     */
    currentChain: 0,


    /**
     * Identifies the current block || where we're going to have to change after 4. Starts at 0 because it corresponds
     * to the array of word data stored on the server.
     */
    currentBlock: 0,

    /* *************************************
     *                Setup                *
     * *********************************** */

    /**
     * This runs when the page initially loads.
     */
    init: function() {
      App.cacheElements();
      App.showInitScreen();
      // This function has to be defined with proper events
      App.bindEvents();

      // Initialize the fastclick library
      FastClick.attach(document.body);
    },

    cacheElements: function() {
      App.$doc = $(document);

      // Templates located on index.html
      App.$gameArea = $('#gameArea');
      App.$templateIntroScreen = $('#intro-screen-template').html();
      App.$templateNewGame = $('#create-game-template').html();
      App.$templateJoinGame = $('#join-game-template').html();
      App.$hostGame = $('#host-game-template').html();
    },

    bindEvents: function() {
      // Host
      App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

      // Player
      App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
      App.$doc.on('click', '#btnStart', App.Player.onPlayerStartClick);
      App.$doc.on('click', '#btnAnswer', App.Player.onPlayerAnswerClick);
      App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);

    },

    /* *************************************
     *             Game Logic              *
     * *********************************** */

    /**
     * Show the initial game title screen
     * (with Start and Join buttons)
     */

     showInitScreen: function() {
         App.$gameArea.html(App.$templateIntroScreen);
         // Utility function provided by Ana (needs to be copied into app.js)
         // App.doTextFit('.title');
     },

     /* *******************************
        *         HOST CODE           *
        ******************************* */
    Host : {
      /**
       * Contains references to player data
       */
      players : [],

      /**
       * Flag to indicate if a new game is starting.
       * This is used after the first game ends, and players initiate a new game
       * without refreshing the browser windows.
       */
      isNewGame : false,

      /**
       * Keep track of the number of players that have joined the game.
       */
      numPlayersInRoom: 0,

      /**
       * A reference to the correct answer for the current round.
       */
      currentCorrectAnswer: '',

      /**
       * Handler for the "Start" button on the Title Screen.
       */
      onCreateClick: function () {
        IO.socket.emit('hostCreateNewGame');
      },

      /**
       * The Host screen is displayed for the first time.
       * @param data{{ gameId: int, mySocketId: * }}
       */
      gameInit: function (data) {
        App.gameId = data.gameId;
        App.mySocketId = data.mySocketId;
        App.myRole = 'Host';
        App.Host.numPlayersInRoom = 0;

        App.Host.displayNewGameScreen();
        console.log("Game started with ID: " + App.gameId + ' by host: ' + App.mySocketId);
      },

      /**
       * Show the Host screen containing the game URL and unique game ID
       */
      displayNewGameScreen : function() {
        // Fill the game screen with the appropriate HTML
        App.$gameArea.html(App.$templateNewGame);

        // Display the URL on screen
        $('#gameURL').text(window.location.href);
        // App.doTextFit('#gameURL');

        // Show the gameId / room id on screen
        $('#spanNewGameCode').text(App.gameId);
      },

      /**
       * Update the Host screen when the first player joins
       * @param data{{playerName: string, playerColor: string}}
       */
      updateWaitingScreen: function(data) {
        // If this is a restarted game, show the screen.
        if ( App.Host.isNewGame ) {
            App.Host.displayNewGameScreen();
        }

        // Update the host screen
        $('#playersWaiting').append('<h1 style="color:' + data.playerColor + ';">Player ' + data.playerName + ' joined the game.</h1>');

        // Store the new player's data on the Host.
        App.Host.players.push(data);

        // Increment the number of players in the room
        App.Host.numPlayersInRoom += 1;

        // If four players have joined, start the game!
        if (App.Host.numPlayersInRoom === 4) {
            // console.log('Room is full. Almost ready!');

            // Let the server know that two players are present.
            IO.socket.emit('hostRoomFull', App.gameId);
        }
      },

      /**
       * Show the countdown screen
       */
      gameCountdown : function(data) {
        // Prepare the game screen with new HTML
        App.$gameArea.html(App.$hostGame);

        // Begin the on-screen countdown timer
        var $secondsLeft = $('#countDownBlock');
        App.countDown( $secondsLeft, 15, function(){
            IO.socket.emit('hostCountdownFinished', App.gameId);
        });


        // TODO: find a way not to display this part
        $('#player1Score')
            .find('.playerName')
            .html(App.Host.players[0].playerName);

        $('#player2Score')
            .find('.playerName')
            .html(App.Host.players[1].playerName);

        $('#player3Score')
            .find('.playerName')
            .html(App.Host.players[2].playerName);

        $('#player4Score')
            .find('.playerName')
            .html(App.Host.players[3].playerName);

        $('#player1BlockScore')
            .find('.playerName')
            .html(App.Host.players[0].playerName);

        $('#player2BlockScore')
            .find('.playerName')
            .html(App.Host.players[1].playerName);

        $('#player3BlockScore')
            .find('.playerName')
            .html(App.Host.players[2].playerName);

        $('#player4BlockScore')
            .find('.playerName')
            .html(App.Host.players[3].playerName);

        // Set the Score section on screen to 0 for each player with the socket id
        $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
        $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
        $('#player3Score').find('.score').attr('id',App.Host.players[2].mySocketId);
        $('#player4Score').find('.score').attr('id',App.Host.players[3].mySocketId);

        // Set the Score section on screen to 0 for each player with the socket id
        $('#player1BlockScore').find('.score').attr('id',App.Host.players[0].mySocketId + 'Block');
        $('#player2BlockScore').find('.score').attr('id',App.Host.players[1].mySocketId + 'Block');
        $('#player3BlockScore').find('.score').attr('id',App.Host.players[2].mySocketId + 'Block');
        $('#player4BlockScore').find('.score').attr('id',App.Host.players[3].mySocketId + 'Block');
      },

      /**
       * Show the word for the current round on screen.
       * @param data{{chainNumber: *, blockNumber: *, word: *, answer: *}}
       */
      newWord : function(data) {
          // Update the data for the current chain (correct answer & current chain)
          App.Host.currentCorrectAnswer = data.answer.toLowerCase();
          App.Host.currentChain = data.chainNumber;
          App.Host.currentBlock = data.blockNumber;
      },

      // /**
      //  * TODO: NOT WORKING
      //  * Check the answer clicked by a player.
      //  * @param data { gameId: *, playerId: *, playerColor: *, answer: *, currentBlock: *, currentChain: * }
      //  */
      // checkAnswer : function(data) {
      //     // Verify that the answer clicked is from the current chain.
      //     // This prevents a 'late entry' from a player whos screen has not
      //     // yet updated to the current round.
      //     if (data.currentChain === App.currentChain && data.currentBlock === App.currentBlock){
      //         // Get the player's score
      //         var $pScore = $('#' + data.playerId);
      //         // var $pBlockScore = $('#' + data.playerId + 'Block');

      //         // Advance player's score if it is correct
      //         if( App.Host.currentCorrectAnswer === data.answer ) {

      //             // Add 1 to the player's score
      //             $pScore.text(+$pScore.text() + 1);

      //             // Advance the chain
      //             App.currentChain += 1;

      //             // Advance the block if it's the second chain of the block
      //             if ( App.currentChain % 2 === 0 ){
      //                 // Advance the block
      //                 App.currentBlock += 1;

      //                 // TODO: find a way to increment block score
      //                 // Add 1 to the player's blockScore of the highest player's score for the round
      //                 // Get the data for player 1 from the host screen
      //                 var $p1 = $('#player1Score');
      //                 var p1Score = +$p1.find('.score').text();

      //                 // Get the data for player 2 from the host screen
      //                 var $p2 = $('#player2Score');
      //                 var p2Score = +$p2.find('.score').text();

      //                 // Get the data for player 3 from the host screen
      //                 var $p3 = $('#player3Score');
      //                 var p3Score = +$p3.find('.score').text();

      //                 // Get the data for player 4 from the host screen
      //                 var $p4 = $('#player4Score');
      //                 var p4Score = +$p4.find('.score').text();

      //                 // Find the winner of the block round based on the scores
      //                 var divPlayers = [$p1, $p2, $p3, $p4];
      //                 var scores = [p1Score, p2Score, p3Score, p4Score];
      //                 var maxScore = Math.max.apply(Math, scores);
      //                 var indexOfWinner = [];
      //                 for (var i = 0; i < scores.length; i++) {
      //                     if(scores[i] === maxScore) {
      //                       indexOfWinner.push(i);
      //                     }
      //                 }

      //                 var tie = false;
      //                 // Check if there is a tie situation
      //                 if(indexOfWinner.length > 1) {
      //                   tie = true;

      //                   // Take a random players amoung the winners
      //                   var blockWinners = [];
      //                   for (var i = 0; i < indexOfWinner; i++) {
      //                     blockWinners.push(divPlayers[i]);
      //                   }
      //                   var blockWinner = blockWinners.splice(Math.floor(Math.random()*blockWinners.length), 1);
      //                 } else {
      //                   var blockWinner = divPlayers[indexOfWinner];
      //                 }

      //                 // Find the actual score of the winner of the block
      //                 var winnerScore = +$blockWinner.find('.score').text();
      //                 $blockWinner.text(+$pBlockScore.text() + 1);


      //                 // Display a nice color block to host screen
      //                 App.Host.displayColorBlock(data.playerColor);

      //                 // Reset the chain scores to O
      //                 // Set the Score section on screen to 0 for each player with the socket id
      //                 $('#player1Score').find('.score').text('0');
      //                 $('#player2Score').find('.score').text('0');
      //                 $('#player3Score').find('.score').text('0');
      //                 $('#player4Score').find('.score').text('0');
      //             };

      //             // Prepare data to send to the server
      //             var data = {
      //                 gameId : App.gameId,
      //                 chain : App.currentChain,
      //                 block : App.currentBlock
      //             };

      //             // Notify the server to start the next round.
      //             IO.socket.emit('hostNextChain', data);

      //         } else {
      //             IO.socket.emit('playerWrongAnswer', data.playerId);
      //         }
      //     }
      // },


      /**
       * Check the answer clicked by a player.
       * @param data { gameId: *, playerId: *, playerColor: *, answer: *, currentBlock: *, currentChain: * }
       */
      checkAnswer : function(data) {
          // Verify that the answer clicked is from the current chain.
          // This prevents a 'late entry' from a player whos screen has not
          // yet updated to the current round.
          if (data.currentChain === App.currentChain){
              // Get the player's score (from the chain)
              // var $pScore = $('#' + data.playerId);
              var $pBlockScore = $('#' + data.playerId + 'Block');

              // Advance player's score if it is correct
              if( App.Host.currentCorrectAnswer === data.answer ) {

                  // Add 1 to the player's score
                  $pBlockScore.text(+$pBlockScore.text() + 1);

                  // Advance the chain
                  App.currentChain += 1;

                  // Display a nice color block to host screen
                  App.Host.displayColorBlock(data.playerColor);

                  // Prepare data to send to the server
                  var data = {
                      gameId : App.gameId,
                      chain : App.currentChain,
                      block : App.currentBlock
                  };

                  // Notify the server to start the next round.
                  IO.socket.emit('hostNextChain', data);

              } else {
                  IO.socket.emit('playerWrongAnswer', data.playerId);
              }
          }
      },

      displayColorBlock : function(playerColor) {
        var color = playerColor;
        var $blockArea = $('#colorBlocks');
        var $divColored = $("<div class='colorBlock' style='background-color:" + color + ";'></div>");

        $divColored.hide().prependTo($blockArea).fadeIn('slow');
      },

      /**
       * All blocks have played out. End the game.
       * @param data { gameId: *, chain: *, block: * }
       */
      endGame : function(data) {
          // Get the data for player 1 from the host screen
          var $p1 = $('#player1BlockScore');
          var p1Score = +$p1.find('.score').text();
          var p1Name = $p1.find('.playerName').text();

          // Get the data for player 2 from the host screen
          var $p2 = $('#player2BlockScore');
          var p2Score = +$p2.find('.score').text();
          var p2Name = $p2.find('.playerName').text();

          // Get the data for player 3 from the host screen
          var $p3 = $('#player3BlockScore');
          var p3Score = +$p3.find('.score').text();
          var p3Name = $p3.find('.playerName').text();

          // Get the data for player 4 from the host screen
          var $p4 = $('#player4BlockScore');
          var p4Score = +$p4.find('.score').text();
          var p4Name = $p4.find('.playerName').text();

          // Find the winner based on the scores
          var players = [p1Name, p2Name, p3Name, p4Name];
          var scores = [p1Score, p2Score, p3Score, p4Score];
          var maxScore = Math.max.apply(Math, scores);
          var indexOfWinner = [];
          for (var i = 0; i < scores.length; i++) {
              if(scores[i] === maxScore) {
                indexOfWinner.push(i);
              }
          }

          var tie = false;
          // Check if there is a tie situation
          if(indexOfWinner.length > 1) {
            tie = true;
          } else {
            var winner = players[indexOfWinner];
          }

          data.winner = winner;
          if(data.done>0)
          {

          }
          else {
            data.done=0;
            IO.socket.emit('hostNextChain',data);
            // Display the winner (or tie game message)
            if(tie){
                $('#hostBlock').append($('<h1/>').text("It's a Tie!"));
            } else {
                $('#hostBlock').append($('<h1/>').text( winner + ' wins this challenge!' ));
            }
          }
          // TODO: Wtf is that?
          // IO.socket.emit("clientEndGame",data);

          // Reset game data
          App.Host.numPlayersInRoom = 0;
          App.Host.isNewGame = true;

      },
    },

    /* *****************************
       *        PLAYER CODE        *
       ***************************** */
    Player : {
      /**
       * A reference to the socket ID of the Host
       */
      hostSocketId: '',

      /**
       * The player's name entered on the 'Join' screen.
       */
      myName: '',


      /**
       * The player's default block color
       */

      myColor: '',

      /**
       * Click handler for the 'JOIN' button
       */
      onJoinClick: function() {
          console.log('Clicked "Join A Game"');

          // Display the Join Game HTML on the player's screen.
          App.$gameArea.html(App.$templateJoinGame);
      },

      /**
       * The player entered their name and gameId (hopefully)
       * and clicked Start.
       */
      onPlayerStartClick: function() {
        // collect data to send to the server
        var data = {
          gameId : +($('#inputGameId').val()),
          playerName : $('#inputPlayerName').val() || 'Undefined'
        };

        // Send the gameId and playerName to the server
        IO.socket.emit('playerJoinGame', data);

        // Set the appropriate properties for the current player.
        App.myRole = 'Player';
        App.Player.myName = data.playerName;
      },

      /**
       *  Click handler for the Player hitting a word in the word list.
       */
      onPlayerAnswerClick: function() {
          var answer = $('#inputWordAnswer').val();
          console.log('The answer is' + answer);

          // Send the player info and typed word to the server so
          // the host can check the answer.
          var data = {
              gameId: App.gameId,
              playerId: App.mySocketId,
              playerColor: App.Player.myColor,
              answer: answer,
              currentBlock: App.currentBlock,
              currentChain: App.currentChain
          }
          IO.socket.emit('playerAnswer',data);
      },

      /**
       *  Button is bouncing when wrong answer given.
       */
      onWrongAnswer : function() {
        $('#btnAnswer').effect('bounce', 'slow');
      },


      /**
       *  Click handler for the "Start Again" button that appears
       *  when a game is over.
       */
      onPlayerRestart : function() {
          var data = {
              gameId : App.gameId,
              playerName : App.Player.myName
          }
          IO.socket.emit('playerRestart',data);
          App.currentRound = 0;
          $('#gameArea').html("<h3>Waiting on host to start new game.</h3>");
      },

      /**
       * Display the waiting screen for player 1
       * @param data
       */
      updateWaitingScreen : function(data) {
        console.log('Update' + IO.socket.socket.sessionid === data.mySocketId);
        if(IO.socket.socket.sessionid === data.mySocketId){
            App.myRole = 'Player';
            App.gameId = data.gameId;
            App.Player.myColor = data.playerColor;

            $('#joinGameForm').fadeOut();
            $('.btnStartClass').html("<div class='shaft-load3'>" +
              "<div class='shaft1'></div>" +
              "<div class='shaft2'></div>" +
              "<div class='shaft3'></div>" +
              "<div class='shaft4'></div>" +
              "<div class='shaft5'></div>" +
              "<div class='shaft6'></div>" +
              "<div class='shaft7'></div>" +
              "<div class='shaft8'></div>" +
              "<div class='shaft9'></div>" +
              "<div class='shaft10'></div>" +
              "</div>");

            $('#playerWaitingMessage')
              .append('<p/>')
              .text('Almost there... Please wait now for the game to begin.');
              // .text('Almost there... ' + data.gameId + ' Please wait now for the game to begin.');
        };
      },

      /**
       * Display 'Get Ready' while the countdown timer ticks down.
       * @param hostData
       */
      gameCountdown : function(hostData) {
          // Update the hostSocketId of the player (to link them with the host?)
          App.Player.hostSocketId = hostData.mySocketId;
          $('#gameArea')
              .html('<div class="getReady"><h1>Get Ready for the block!</h1></div>' +
                "<div class='shaft-load3'>"   +
                "<div class='shaft1'></div>"  +
                "<div class='shaft2'></div>"  +
                "<div class='shaft3'></div>"  +
                "<div class='shaft4'></div>"  +
                "<div class='shaft5'></div>"  +
                "<div class='shaft6'></div>"  +
                "<div class='shaft7'></div>"  +
                "<div class='shaft8'></div>"  +
                "<div class='shaft9'></div>"  +
                "<div class='shaft10'></div>" +
                "</div>");
      },

      /**
       * Show the word of the current round.
       * @param data{{chainNumber: *, blockNumber: *, word: *, answer: *}}
       */
      newWord : function(data) {
          var $question = $('<div/>').attr('class','questionAreaWrapper');

          $question.append($('<div/>').attr('class', 'container')
              .append( $('<div/>').attr('id', 'questionArea')
                  .append($('<div/>').attr('class', 'col-xs-6 col-xs-offset-4')
                      .append($('<label/>').attr('for', 'inputWordAnswer').html(data.word))
                  )
                  .append($('<div/>').attr('class', 'col-xs-6 col-xs-offset-4')
                      .append($('<input/>').attr('id', 'inputWordAnswer').attr('type', 'text'))
                  )
                  .append($('<div/>').attr('class', 'col-xs-6 col-xs-offset-4')
                      .append($('<div/>').attr('class', 'buttons')
                        .append($('<button/>').attr('id', 'btnAnswer').html('Check'))
                      )
                  )
              )
          );

          $('#gameArea').html($question);
      },

      /**
       * Show the "Game Over" screen.
       */
      endGame : function() {
          $('#gameArea')
              .html($('<div/>').attr('class', 'gameOver')
                  .append($('<h1/>').text('Game Over!'))
                  .append($('<div/>').attr('class', 'buttons')
                      .append(
                          // Create a button to start a new game.
                          $('<button>Start Again</button>')
                              .attr('id','btnPlayerRestart')
                              .addClass('btn')
                              .addClass('btnGameOver')
                      )
                  )
              );
      }
    },

    /* **************************
              UTILITY CODE
       ************************** */

    /**
     * Display the countdown timer on the Host screen
     *
     * @param $el The container element for the countdown timer
     * @param startTime
     * @param callback The function to call when the timer ends.
     */
    countDown : function($el, startTime, callback) {
      // Display the starting time on the screen.
      $el.text(startTime);
      // I don't have it inside the utility functions
      // App.doTextFit('#hostBlock');

      console.log('Starting Countdown...');

      // Start a 1 second timer
      var timer = setInterval(countItDown,1000);

      // Decrement the displayed timer value on each 'tick'
      function countItDown(){
        startTime -= 1
        $el.text(startTime);
        // I don't have it inside the utility functions
        // App.doTextFit('#hostBlock');

        if( startTime <= 0 ){
            // console.log('Countdown Finished.');

            $('#countDownArea').fadeOut();

            // Stop the timer and do the callback.
            clearInterval(timer);
            callback();
            return;
        }
      }
    }
  };

  IO.init();
  App.init();
}($));