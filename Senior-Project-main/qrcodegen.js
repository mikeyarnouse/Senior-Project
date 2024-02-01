var QRCode = require('qrcode');

async function generateRoomQRCode(urlWithRoomName) {
    try {
        return await QRCode.toDataURL(urlWithRoomName);
    }
    catch (err) {
        console.log(err);
    }
}

module.exports = {
    generateRoomQRCode,
}