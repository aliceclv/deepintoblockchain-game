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
      // IO.bindEvents();
    },

    /**
     * While connected, Socket.IO will listen to the following events emitted
     * by the Socket.IO server, then run the appropriate function.
     */
    bindEvents : function() {
        IO.socket.on('connected', IO.onConnected );
        // IO.socket.on('newGameCreated', IO.onNewGameCreated );
        // IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
        // IO.socket.on('beginNewGame', IO.beginNewGame );
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
        console.log(data.message);
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
      App.$templateJoinGame = $('#join-game-template').html();
    },

    bindEvents: function() {
      // Host
      // Player
      App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
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
      }
    }
  };

  IO.init();
  App.init();
}($));