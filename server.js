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

const mongo = require("mongodb").MongoClient;
const dsn = "mongodb://localhost:27017/chat";
const collection = "messages";

async function collectionQuery(dsn, colName, type, data) {
    const client = await mongo.connect(dsn);
    const db = await client.db();
    const col = await db.collection(colName);
    let res;
    if (type === "add") {
        res = col.insertOne(data);
    }
    else if (type === "get") {
        res = await col.find().toArray();
    }

    await client.close();
    return res;
}

io.on('connection', (socket) => {
    // register the socket.id in the users object
    users[socket.id] = "";

    socket.on('disconnect', () => {
        // free up the username from the chat
        if (users[socket.id] != "") {
            const data = {
                user: users[socket.id],
                message: "left the chatroom",
                type: "left",
                sent: new Date().getTime()
            };

            socket.broadcast.emit('server-sends', (data));
            collectionQuery(dsn, collection, "add", data);
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
            collectionQuery(dsn, collection, "add", data);
            // bind username to socket.id
            users[socket.id] = data.user;
        }
    });

    socket.on('client-sends', (data) => {
        socket.broadcast.emit('server-sends', (data));
        collectionQuery(dsn, collection, "add", data);
    });

    socket.on('get-messages', () => {
        (() => {
            collectionQuery(dsn, collection, "get")
                .then(res => io.to(`${socket.id}`).emit("all-messages", res))
                .catch(err => console.log(err));
        })();
    });
});

http.listen(port, () => {
    console.log(`Listening on port *: ${port}`);
});
