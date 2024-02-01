//state and properties for rooms
const RoomsState = {
    rooms: [],
    setRooms: function (newRoomsArray) {
        this.rooms = newRoomsArray;
    }
}

function createRoom(roomName, maxCapacity) {
    let name = roomName;
    let capacity = 0;
    let users = [];
    const room = { name, maxCapacity, capacity, users };
    RoomsState.setRooms([
        ...RoomsState.rooms.filter(room => room.name !== roomName),
        room
    ]);

    console.log('Room Created ', RoomsState.rooms);
}

function checkIfRoomExists(roomName) {
    if (RoomsState.rooms.find(room => room.name === roomName)) {
        return true;
    }
    return false;
}

function checkIfUserInRoom(roomName, userName) {
    let users = RoomsState.rooms.find(room => room.name === roomName).users;
    if (users.find(user => user === userName)) {
        return true;
    }
    return false;
}

function addUserToRoom(roomName, userName) {
    //find the room the user wants to join
    //newRoom is a copy
    let newRoom = RoomsState.rooms.find(room => room.name === roomName);
    //update room properties
    newRoom.users.push(userName);
    newRoom.capacity = newRoom.capacity + 1;
    //add updated room to RoomsState
    RoomsState.setRooms([
        ...RoomsState.rooms.filter(room => room.name !== roomName),
        newRoom
    ]);
    console.log('User Joined ', RoomsState.rooms);
}

function removeUserFromRoom(roomName, userName) {
    console.log(roomName, userName);
    let newRoom = RoomsState.rooms.find(room => room.name === roomName);
    //returns an array with userName removed
    newRoom.users = newRoom.users.filter(user => user !== userName);
    newRoom.capacity = newRoom.capacity - 1;

    if (newRoom.capacity <= 0) {
        //remove room if capacity is 0
        RoomsState.setRooms([
            ...RoomsState.rooms.filter(room => room.name !== roomName)
        ])
    }
    else {
        //otherwise, add updated room to RoomsState
        RoomsState.setRooms([
            ...RoomsState.rooms.filter(room => room.name !== roomName),
            newRoom
        ]);
    }
    console.log('User Left ', RoomsState.rooms);
}

function getMaxCapacity(roomName) {
    //search through the rooms array with find() and return the max capacity
    return RoomsState.rooms.find(room => room.name === roomName).maxCapacity;
}

function getCapacity(roomName) {
    //search through the rooms array with find() and return the capacity 
    return RoomsState.rooms.find(room => room.name === roomName).capacity;
}

function getAllRooms() {
    return RoomsState.rooms;
}

module.exports = {
    createRoom,
    checkIfRoomExists,
    checkIfUserInRoom,
    addUserToRoom,
    getMaxCapacity,
    getCapacity,
    getAllRooms,
    removeUserFromRoom,
};

function logRooms() {
    console.log(RoomsState.rooms);
}

// setInterval(logRooms, 2000);