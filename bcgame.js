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
  // gameSocket.on('hostCreateNewGame', hostCreateNewGame);
  // gameSocket.on('hostRoomFull', hostPrepareGame);
  // gameSocket.on('hostCountdownFinished', hostStartGame);
  // gameSocket.on('hostNextRound', hostNextRound);

  // // Player Events
  // gameSocket.on('playerJoinGame', playerJoinGame);
  // gameSocket.on('playerAnswer', playerAnswer);
  // gameSocket.on('playerRestart', playerRestart);
}