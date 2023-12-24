const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const {generateMessage, generateLocationMessage} = require('./utils/messages')
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000

// define paths for express config
const publicPath = path.join(__dirname, '../public')

// setup static directory to serve
app.use(express.static(publicPath))

io.on('connection', (socket) =>{
    console.log('New websocket connection')

    socket.on('join', ({username, room}, callback) =>{
        const {error, user} = addUser({id: socket.id, username, room})
        if (error){
            return callback(error)
        }
        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome!'))  // send message to only new user
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))  // send a message to all except new user
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) =>{
        const user = getUser(socket.id)
        const filter = new Filter()
        if (filter.isProfane(message)){
            return callback('Profanity is not allowed!')
        }
        io.to(user.room).emit('message', generateMessage(user.username, message))  // send a message too all users in chat
        callback()
    })
    socket.on('sendLocation', (coords, callback) =>{
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () =>{
        const user = removeUser(socket.id)

        if(user){
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log('Server is up on port ' + port)
})