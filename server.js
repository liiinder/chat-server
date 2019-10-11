let app = require('express')();
let http = require('http').Server(app);
let io = require('socket.io')(http);
let port = 8300;
let users = {};

app.get('/', (req, res) => {
    res.json({
        data: {
            msg: "Got a GET request, sending back default 200"
        }
    });
});

io.on('connection', (socket) => {
    // register the socket.id in the users object
    users[socket.id] = "";

    socket.on('disconnect', () => {
        // free up the username from the chat
        if (users[socket.id] != "") {
                const data = {
                        user: users[socket.id],
                        message: "left the chatroom",
                        type: "left"
                };

                socket.broadcast.emit('server-sends', (data));
        }
        delete users[socket.id];
    });

    socket.on('check-username', (data) => {
        let check = true; 

        for (let [_, username] of Object.entries(users)) {
            if (username.toUpperCase() == data.user.toUpperCase()) {
                check = false;
                break;
            }
        }

        io.to(`${socket.id}`).emit("username-result", check);

        if (check) {
            data.message = "joined the chatroom";
            data.type = "join";
            io.emit('server-sends', (data));
            // bind username to socket.id
            users[socket.id] = data.user;
        }
    });

    socket.on('client-sends', (data) => {
        socket.broadcast.emit('server-sends', (data));
    });
});

http.listen(port, () => {
    console.log(`Listening on port *: ${port}`);
});
