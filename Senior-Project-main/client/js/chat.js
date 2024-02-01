var messages = document.getElementById('messages');
var form = document.getElementById('inputMessage');
var input = document.getElementById('input');
var chatScreen = document.getElementById('chat-screen');
var chatRoom = document.getElementById('room');
var nameInput = document.getElementById('name');
var usersList = document.getElementById('user-list');
var displayRoomName = document.getElementById('display-room-name');
var activity = document.querySelector('.activity');
var roomList = document.querySelector('.room-list');
var joinForm = document.querySelector('.join-form');
var keyPair;
var userKeys = [];
const IP = 'localhost';
const PORT = '3000';
var socket = io(`ws://${IP}:${PORT}`, {
    auth: {
        user: getLocalStorageItem('nameInput'),
        room: getLocalStorageItem('roomInput')
    }
});
var userName = '';
var roomName = '';

//Join room when loading page
//Event listener that's called when the chat page has loaded
addEventListener('load', async (e) => {
    userName = getLocalStorageItem('nameInput');
    roomName = getLocalStorageItem('roomInput');
    keyPair = await generateKeyPair(); //keypair has two objects: keyPair.publicKey, and keyPair.privateKey
    let exportedKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    joinRoom(userName, roomName, exportedKey);

    //emit an event to let the server generate the qrcode
    //qrcode data will be received at socket.on('qrcode')
    socket.emit('qrcode', {
        roomName: roomName
    });
});

//Event listener for joining room
joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    userName = nameInput.value;
    roomName = chatRoom.value;
    joinRoom(userName, roomName);
});

//send message to the server
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    //Check if we have a user logged in, a message, and a selected room
    if (userName && input.value && roomName) {
        //Encrypt the message before sending
        //send it with the key we encrypted it with
        //we are going to loop through every key, and end send and encrypt each one
        userKeys.forEach(async userKey => {
            let myMessage = await encryptSingleMesssage(userKey.key, input.value);
            socket.emit('message', { //send data as json object
                "name": userName,
                "text": myMessage,
                "recipient": userKey.user,
            });
        });
        //also send message to ourselves
        let myMessage = await encryptSingleMesssage(keyPair.publicKey, input.value);
        socket.emit('message', {
            "name": userName,
            "text": myMessage,
            "recipient": userName,
        });
        input.value = ''; //empty message after sending
    }
    input.focus(); //return focus to the field
});

//Event listener for user typing
input.addEventListener('keypress', () => {
    socket.emit('activity', userName);
});


/* Socket Listeners */

//receive messages from server
socket.on('message', async (data) => {
    //only going to deal with messagees that have our own public key
    activity.textContent = "";
    let { name: user, text: msg, recipient: target, time } = data;
    
    //check if the message is for us, someone else, or the the one we sent to ourselves.
    if (target === userName && user !== target) {
        console.log("A message arrived for us!")
        let decodedMessage = await decryptMessage(msg);
        displayMessage(decodedMessage, user, time, false); //false because it's not the message we sent to oursself
    }
    else if (user === userName && target === user) {
        console.log('own message');
        let decodedMessage = await decryptMessage(msg);
        displayMessage(decodedMessage, user, time, true);
    }
    else {
        console.log("This message is for someone else, ignoring.")
    }
});

socket.on('admin_message', (data) => {
    let { name: user, text: msg, time } = data;
    //create necessary elements
    let item = document.createElement('span');
    let itemMessage = document.createElement('span');

    //set the content
    //itemTime.textContent = time;
    itemMessage.textContent = msg;

    //set appropriate classes
    //itemTime.setAttribute('class', 'show-time');
    itemMessage.setAttribute('class', 'message-font');

    item.append(itemMessage);
    item.setAttribute('class', 'admin-message-span');

    //append to list
    messages.appendChild(item);
    chatScreen.scrollTop = chatScreen.scrollHeight;
});

socket.on('publicKey', async ({ keyOwner, publicKey }) => {
    //takes publicKey and imports it as a cryptoKey object, 
    //and adds the public key to the userKeys array.
    await importJWKKey(keyOwner, publicKey);
});

//on 'keyRecieve->save an array of key objects
//that have the 1:user, 2:key
socket.on('qrcode', ({ imageData }) => {
    displayQRCode(imageData);
});

//used to send publicKey of existing users to new users
socket.on('new-user-joined', async (user) => {
    let exportedKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    socket.emit('publicKey', {
        keyOwner: userName,
        publicKey: exportedKey,
    });
    console.log('socket.on user joined', user);
});

/* ADD: functionality to see multiple users typing at once */
var activityTimer;
socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`

    //clear after 3 seconds
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activity.textContent = "";
    }, 300000);
});

socket.on('connect_error', (data) => {
    //redirect to join.html if there was an error.
    console.log(data);
    window.location.replace('../html/join.html');
});

socket.on('userList', ({ users }) => {
    showUsers(users);
});
/* socket.on('roomList', ({ rooms }) => {
    showRooms(rooms);
}); */


/* Functions */

/* function displayOwnMessage(msg) {
    let item = document.createElement('li');
    item.textContent = msg;
    item.setAttribute('class', 'floatRight');
    messages.appendChild(item);
    chatScreen.scrollTo(0, document.body.scrollHeight);
}
 */
function showUsers(users) {
    usersList.textContent = '';
    if (users) {
        displayRoomName.textContent = `Users in room ${roomName}:`
        users.forEach((user, i) => {
            //user is an object
            let item = document.createElement('li');
            item.textContent = `${user.name}`;
            if (user.name === userName) {
                item.textContent += ' (You)';
            }
            usersList.appendChild(item);
        });
    }
}

function joinRoom(userName, roomName, publicKey) {
    //Check for userName and selected chat room
    if (userName && roomName) {
        socket.emit('enterRoom', {
            "name": userName,
            "room": roomName,
            "publicKey": publicKey
        });

    }
}

async function generateKeyPair() {
    options = {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    }

    let cryptoKeyPair = await crypto.subtle.generateKey(options, true, ['encrypt', 'decrypt']);
    return cryptoKeyPair;
}

async function encryptSingleMesssage(key, message) {
    let txtEnc = new TextEncoder();
    let encodedText = txtEnc.encode(message);

    options = {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    }
    let encryptedMessage = await crypto.subtle.encrypt(options, key, encodedText);
    return encryptedMessage;
};

async function decryptMessage(msg) {
    options = {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    }
    let decryptedMessage = await crypto.subtle.decrypt(options, keyPair.privateKey, msg);
    let decoder = new TextDecoder();
    let decodedMessage = decoder.decode(decryptedMessage);
    return decodedMessage;
}

async function importJWKKey(keyOwner, publicKey) {
    //don't import if the public key already exists in userKeys
    if (userKeys.find(key => key.user === keyOwner)) {
        return;
    }

    //maybe go back to storing non imported??
    options = {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
    }
    // console.log(publicKey);
    let keyObject = await crypto.subtle.importKey('jwk', publicKey, options, true, ['encrypt']); //maybe fix this if there is a problem with decrypting/encrypting

    userKeys.push({
        user: keyOwner,
        key: keyObject,
    });
}

//ownMessage is bool that tells the function whether to display the function on the right or left
//right if it is our own, and left if it's from someone else.
function displayMessage(msg, user, time, isOwnMessage) {
    //create necessary elements
    let item = document.createElement('span');
    let itemTime = document.createElement('div');
    let itemUsername = document.createElement('div');
    let itemMessage = document.createElement('div');
    let messageAndTimeContainer = document.createElement('div');

    itemTime.textContent = time;
    itemMessage.textContent = msg;

    //set css classes
    itemTime.setAttribute('class', 'show-time');
    itemUsername.setAttribute('class', 'message-font');
    itemMessage.setAttribute('class', 'message-font');
    messageAndTimeContainer.setAttribute('class', 'message-time-container');

    if(!isOwnMessage) {
        //if the message is not the one we sent, add username to textContent
        //and float the message bubble to the left.
        itemUsername.textContent = `${user}`;
        itemMessage.setAttribute('class', 'message-font other-message');
        messageAndTimeContainer.append(itemMessage, itemTime);
        item.append(itemUsername, messageAndTimeContainer);
        item.setAttribute('class', 'float-left message-span');
    } else if (isOwnMessage) {
        //if message is our own, float the message bubble to the right.
        itemMessage.setAttribute('class', 'message-font own-message');
        messageAndTimeContainer.append(itemMessage, itemTime);
        item.append(messageAndTimeContainer);
        item.setAttribute('class', 'float-right message-span');
    }

    messages.appendChild(item);
    chatScreen.scrollTop = chatScreen.scrollHeight;
}


function displayQRCode(imageData) {
    const qrCodeImg = document.getElementById('qrcode');
    qrCodeImg.src = imageData;
}

function getLocalStorageItem(name) {
    return localStorage.getItem(name);
}

function saveArrayToLocalStorage(arrayName, array) {
    localStorage.setItem(arrayName, JSON.stringify(array));
}

window.onbeforeunload = (e) => {
    return 'Are you sure you want to leave?';
};