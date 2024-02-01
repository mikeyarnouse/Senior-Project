// const joinForm = document.querySelector('.form-join');
const joinForm = document.getElementById('join');
const nameInput = document.getElementById('name');
const chatRoom = document.getElementById('room');
const userStatus = document.getElementById('user-status');
const roomStatus = document.getElementById('room-status');
const serverIP = 'localhost';
const PORT = '3000';

joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    let roomExists = await checkIfRoomExists(chatRoom.value);

    if (!roomExists) {
        roomStatus.textContent = "Room Doesn't Exist"
        roomStatus.className = 'unavailable';
        chatRoom.value = "";
        chatRoom.focus();
        userStatus.className = 'display-none';
    }
    else {
        let userInRoom = await checkIfUserInRoom(chatRoom.value, nameInput.value)
        if (userInRoom) {
            userStatus.textContent = 'Username Already Taken';
            userStatus.className = 'unavailable';
            roomStatus.className = 'display-none';
            nameInput.value = "";
            nameInput.focus();
        }
        else {
            localStorage.setItem('nameInput', nameInput.value);
            localStorage.setItem('roomInput', chatRoom.value);
            console.log("Joining room " + chatRoom.value);
            window.location = "../html/chat.html";
        }
    }
});

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
};

async function checkIfUserInRoom(name, user) {
    const IP = `http://${serverIP}:${PORT}/userInRoom?`;
    try {
        const response = await fetch(IP + new URLSearchParams({
            roomName: name,
            userToCheck: user
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
};

//get room name if invited with qrcode or link
function getRoomNameFromURL() {
    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });

    let room = params.room;
    console.log(room);
    return room;
}

window.onload = function() {
    let room = getRoomNameFromURL();
    document.getElementById('room').value = room;  //will be empty if query params are empty
}