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
        // TODO: Room needs to be created before? || We follow the exact same scheme
        IO.socket.on('newGameCreated', IO.onNewGameCreated );
        IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
        IO.socket.on('beginNewGame', IO.beginNewGame );
        // IO.socket.on('newWordData', IO.onNewWordData);
        // IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
        // IO.socket.on('gameOver', IO.gameOver);
        // IO.socket.on('error', IO.error );
        // IO.socket.on('showLeader',IO.showLeader);
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
      // TODO: do it for player as well
      console.log("DONT FORGET TO DO IT FOR PLAYER");
      App[App.myRole].gameCountdown(data);
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
     * Identifies the current round. Starts at 0 because it corresponds
     * to the array of word data stored on the server.
     */
    currentRound: 0,

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
      // Host
      App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

      // Player
      App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
      App.$doc.on('click', '#btnStart', App.Player.onPlayerStartClick);
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
        console.log('Clicked "Create A Game"');
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
       * @param data{{playerName: string}}
       */
      updateWaitingScreen: function(data) {
        // If this is a restarted game, show the screen.
        console.log(App.Host.isNewGame);
        if ( App.Host.isNewGame ) {
            App.Host.displayNewGameScreen();
        }
        // TODO: not working
        // Update host screen
        $('#playersWaiting').append('<p>Player ' + data.playerName + ' joined the game.</p>');

        // Store the new player's data on the Host.
        App.Host.players.push(data);

        // Increment the number of players in the room
        App.Host.numPlayersInRoom += 1;

        // TODO: this is where I need to change for 4
        // If two players have joined, start the game!
        if (App.Host.numPlayersInRoom === 4) {
            console.log('Room is full. Almost ready!');

            // Let the server know that two players are present.
            IO.socket.emit('hostRoomFull', App.gameId);
        }
      },

      /**
       * Show the countdown screen
       */
      gameCountdown : function() {
        // TODO
        // Prepare the game screen with new HTML
        App.$gameArea.html(App.$hostGame);
        // App.doTextFit('#hostWord');

        // Begin the on-screen countdown timer
        var $secondsLeft = $('#hostBlock');
        App.countDown( $secondsLeft, 5, function(){
            IO.socket.emit('hostCountdownFinished', App.gameId);
        });

        // // Display the players' names on screen
        // $('#player1Score')
        //     .find('.playerName')
        //     .html(App.Host.players[0].playerName);

        // $('#player2Score')
        //     .find('.playerName')
        //     .html(App.Host.players[1].playerName);

        // // Set the Score section on screen to 0 for each player.
        // $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
        // $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
      }
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
        // console.log('Player clicked "Start"');
        // collect data to send to the server
        var data = {
          gameId : +($('#inputGameId').val()),
          playerName : $('#inputPlayerName').val() || 'Undefined'
        };

        // Send the gameId and playerName to the server
        IO.socket.emit('playerJoinGame', data);

        // TODO: is there any other data I should add ? Don't forget to change the DB model
        // Set the appropriate properties for the current player.
        App.myRole = 'Player';
        App.Player.myName = data.playerName;
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
              .text('Joined Game ' + data.gameId + '. Please wait for game to begin.');
        };
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