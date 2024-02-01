//const exp = require('constants'); //no idea what this is for
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const RoomsState = require('./rooms.js'); //room states
const cors = require('cors');
const qrcode = require('./qrcodegen.js');

const ADMIN = "Admin";
const PORT = 3000;
const IP = 'localhost';

const expressServer = app.listen(PORT, IP, () => {
    console.log(`listening on port ${PORT}`);
})

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})

//state for user (not connecting to database), users state 
const UsersState = {
    users: [],
    setUsers: function (newUsersArray) {
        this.users = newUsersArray;
    }
};

app.use(express.static(__dirname + '/client', { index: '/html/index.html' }));
app.use(express.json());
//app.use(express.urlencoded({extended: true}));
app.use(cors({
    origin: `http://${IP}:${PORT}`,
    credentials: true
}));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/html/index.html');
});

app.get('/roomState', (req, res) => {
    let roomName = req.query.roomName;
    let roomExists = RoomsState.checkIfRoomExists(roomName);
    res.json(roomExists);
});

app.get('/userInRoom', (req, res) =>
{
    let roomName = req.query.roomName;
    let userToCheck = req.query.userToCheck;
    let response = RoomsState.checkIfUserInRoom(roomName, userToCheck);
    res.json(response);
});

/* app.get('/getAllRooms', (req, res) => {
    res.json(RoomsState.getAllRooms());
}); */

app.post('/createRoom', (req, res) => {
    let roomName = req.body.roomName;
    let maxCap = req.body.maxCap;
    if (!RoomsState.checkIfRoomExists(roomName)) {
        RoomsState.createRoom(roomName, parseInt(maxCap));
        res.json('room created');
    }
});

//Only allow connection if the room exists and the username isn't a duplicate
//ADD: functionality for passkey authentication
io.use((socket, next) => {
    const userName = socket.handshake.auth.user;
    const roomName = socket.handshake.auth.room;

    //We have to check if the room exists first, otherwise the checkIfUserInRoom function will return a error.
    if(!RoomsState.checkIfRoomExists(roomName)) {
        next(new Error('Room does not exist'));
    }
    else if(RoomsState.getCapacity(roomName) >= RoomsState.getMaxCapacity(roomName)) {
        next(new Error('Room is full'));
    }
    else if(RoomsState.checkIfUserInRoom(roomName, userName)) {
        next(new Error('User already exists in room'));
    }
    else {
        //go to io.on('connection')
        RoomsState.addUserToRoom(roomName, userName);
        next();
    }
});

io.on('connection', (socket) => {
    //Upon connection - Only to user
    socket.emit('admin_message', buildMsg(ADMIN, "Welcome to Samvaad!"))
    
    //Upon Connection - To All Users in room
    socket.on('enterRoom', ({ name, room, publicKey }) => {
        //also get the public key, and broadcast
        //leave previous room if we were in one
        
        const prevRoom = getUser(socket.id)?.room;
        if (prevRoom) {
            socket.leave(prevRoom);
            io.to(prevRoom).emit('admin_message', buildMsg(ADMIN, `${name} has left the room.`));
        }
        //let keyString = JSON.stringify(publicKey);
        console.log(`Activating user: ${name} with id ${socket.id} in room ${room}`);
        const user = activateUser(socket.id, name, room);

        //cannot update previous room users until after the state update in activate user
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
            })
        }
        socket.join(user.room);

        //To the user who joined
        socket.emit('admin_message', buildMsg(ADMIN, `You have joined the ${user.room} chat room`));

        //To current room members
        socket.broadcast.to(user.room).emit('admin_message', buildMsg(ADMIN, `${user.name} has joined the room`));
        socket.broadcast.to(user.room).emit('publicKey', {
                keyOwner:user.name,
                publicKey: publicKey
            }
        );
        //emits an event to existing users to allow the client to emit an event
        //to send their keys to new users
        socket.broadcast.to(user.room).emit('new-user-joined', user.name);

        //Update user list for room
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        });

        //update room list for everyone
        /* io.emit('roomList', {
            rooms: getAllActiveRooms()
        }); */
    });

    socket.on('qrcode', async ({roomName})=> {
        let url = `http://${IP}:${PORT}/html/join.html?room=${roomName}`
        let imageData = await qrcode.generateRoomQRCode(url); //generate qrcode
        socket.emit('qrcode', {
            imageData: imageData
        });
    });

    socket.on('disconnect', () => {
        //reminder: user is an object with id, name, and room
        const user = getUser(socket.id);
        userLeavesApp(socket.id);
        //destroy room if last person left
        if (user) {
            RoomsState.removeUserFromRoom(user.room, user.name);
            io.to(user.room).emit('admin_message', buildMsg(ADMIN,
                `${user.name} has left the room`));
            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            });
            io.emit('roomList', {
                rooms: getAllActiveRooms()
            });
        }
        console.log(`User ${socket.id} disconnected`);
    });

    // socket.on('message', ({ name, text }) => {
    //     const room = getUser(socket.id)?.room;
    //     console.log("Encrypted message Block recieved: "+text);
    //     if (room) {
    //         io.to(room).emit('message', buildMsg(name, text));
    //     }
    // });
    socket.on('message', ({name, text,recipient}) => {
       console.log(`${name} has sent encrypted message with a target recipient of ${recipient}`);
       console.log(text)
        const room = getUser(socket.id)?.room;
        if (room) {
            io.to(room).emit('message', buildTargetedMessage(name, text, recipient));
        }
    });


    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room;
        if (room) {
            socket.broadcast.to(room).emit('activity', name);
        }
    });

    socket.on('publicKey', ({keyOwner, publicKey}) => {
        const room = getUser(socket.id)?.room;
        if(room) {
            socket.broadcast.to(room).emit('publicKey', ({keyOwner, publicKey}));
        }
    });
});

/* State Helper Functions */

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('default', {
            "hour": 'numeric',
            "minute": 'numeric',
            "second": 'numeric'
        }).format(new Date())
    }
}
function buildTargetedMessage(name, text, recipient) {
    return {
        name,
        text,
        recipient,
        time: new Intl.DateTimeFormat('default', {
            "hour": 'numeric',
            "minute": 'numeric',
            "second": 'numeric'
        }).format(new Date())
    }
}
function activateUser(id, name, room) {
    const user = { id, name, room };
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ]);
    return user;
}

function userLeavesApp(id) {
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id)
    ]);
}

function getUser(id) {
    /* console.log('inside the getUser function:');
    console.log(UsersState); */
    return UsersState.users.find(user => user.id === id);
}

function getUsersInRoom(room) {
    /* console.log('inside the getUsersInRoom function: ');
    console.log(UsersState); */
    return UsersState.users.filter(user => user.room === room);
}

function getAllActiveRooms() {
    //Grabs data from the state. All users that are in a room indicate active room
    //This creates a map, converts it to a set to eliminate dupes and then converts it
    //to a returnable array for use
    return Array.from(new Set(UsersState.users.map(user => user.room)));
}

function getQRCode(roomName) {
    let url = `http://${ip}:${PORT}/html/join.html?room=${roomName}`
    qrcode.generateRoomQRCode(url, roomName); //generate qrcode
}