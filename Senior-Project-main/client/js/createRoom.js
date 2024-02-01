const createRoomForm = document.getElementById('create-room-form');
const joinRoomForm = document.getElementById('join-room-form');
const roomNameInput = document.getElementById('room-name');
const maxCapInput = document.getElementById('max-capacity');
const userNameInput = document.getElementById('user-name');
const roomStatus = document.getElementById('room-status');
const joinRoomDiv = document.getElementById('join-room-div');
var roomIsAvailable;
var roomName;
var maxCapacity;
const serverIP = 'localhost';
const PORT = '3000';

//Uses 'change' event to check if room is available whenever user types in text box.
//'input' event can also be used.
roomNameInput.addEventListener('change', async(e) => {
    roomName = roomNameInput.value;
    let roomExists = await checkIfRoomExists(roomName);
    //If the room exists, disallow the user to create it.
    if(roomExists) {
        roomStatus.textContent = 'Room Unavailable';
        roomStatus.className = 'room-unavailable';
        roomIsAvailable = false;
        roomNameInput.focus();
    }
    else {
        roomStatus.textContent = 'Room Available';
        roomStatus.className = 'room-available';
        roomIsAvailable = true;
    }
});

//Make join form visible if room is available. Otherwise hide it
//Room is not created here. It's created when the user joins and goes to chat.html
createRoomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    maxCapacity = maxCapInput.value;
    if (roomIsAvailable) {
        joinRoomDiv.style.display = 'block';
        userNameInput.focus();
    }
    else {
        roomStatus.textContent = 'Room Unavailable';
        roomStatus.className = 'room-unavailable';
        roomNameInput.focus();
    }
});

//Join the room (Room is actually created upon joining the room).
//We don't need to check if username already exists when creating a room
joinRoomForm.addEventListener('submit', async(e) => {
    e.preventDefault();
    if(!await checkIfRoomExists(roomName)) {
        await createRoom(roomName, maxCapacity);
    
        localStorage.setItem('roomInput', roomName);
        localStorage.setItem('nameInput', userNameInput.value);
        window.location.replace("../html/chat.html");
    }
    else {
        roomStatus.textContent = 'Room Unavailable';
        roomNameInput.focus();
    }
});

//Check with the server if the room name is available
async function checkIfRoomExists(name) {
    const IP = `http://${serverIP}:${PORT}/roomState?`;
    try {
        const response = await fetch(IP + new URLSearchParams({
            roomName: name
        }), {
            method: 'GET',
            mode: 'cors'
        });
        let bool = await response.json();
        return bool;
    }
    catch (error) {
        console.log(error);
    }
}

async function createRoom(roomName, maxCap) {
    const IP = `http://${serverIP}:${PORT}/createRoom`;
    try {
        await fetch(IP, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({
                roomName: roomName,
                maxCap: maxCap
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
            }
        });
    }
    catch (error) {
        console.log(error);
    }
}

//For testing
/* async function getAllRooms() {
    try {
        const response = await fetch('http://127.0.0.1:3000/getAllRooms' ,{
            method: 'GET',
            mode: 'cors'
        });
        console.log(await response.json());
    }
    catch (error) {
        console.log(error);
    }
} */

/* window.onload = () => {
    console.log(document.getElementById('room-name').textContent);
    roomNameInput.textContent = '';
    maxCapInput.textContent = '';
} */

window.onload = function() {
    document.getElementById('room-name').value = '';
    document.getElementById('max-capacity').value = '';
    document.getElementById('user-name').value = '';
}
