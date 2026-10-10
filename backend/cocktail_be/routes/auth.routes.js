const express = require('express')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const {readDatabase, writeDatabase} = require('../services/database.service')

const ruoter = express.Router()

const SALT_ROUNDS = 10

ruoter.post('/register', async (req, res) => {
    try{
        const { username, password } = req.body

        if (!username || !password){
            return res.status(400).json({
                message: "Username e password sono obbligatori"
            })
        }

        const database = await readDatabase()
        const existingUser = database.users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        )

        if (existingUser){
            return res.status(409).json({
                message:"Username già esistente"
            })
        }

        const salt = await bcrypt.genSalt(SALT_ROUNDS)
        const passwordHash = await bcrypt.hash(password, salt)

        const token = crypto.randomBytes(32).toString('hex')

        const user = {
            id: Date.now(),
            username:username,
            passwordHash:passwordHash,
            token:token
        }

        database.users.push(user)

        await writeDatabase(database)

        return res.status(201).json({
            token:token,
            user:{
                id:user.id,
                username:user.username
            }
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            message: 'errore interno al server'
        })
    }
})

ruoter.post('/login', async (req, res) => {
    try{
        const { username, password } = req.body

        if (!username || !password){
            return res.status(400).json({
                message:"Username e password sono obligatori"
            })
        }

        const database = await readDatabase()

        const user = database.users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        )

        if (!user){
            return res.status(401).json({
                message: "Credenziali errate"
            })
        }

        if(!user.passwordHash){
            return res.status(401).json({
                message: "credenziali non valide"
            })
        }

        const passwordValid = await bcrypt.compare(password, user.passwordHash)

        if (!passwordValid){
            return res.status(401).json({
                message:"credenziali errate"
            })
        }

        const token = crypto.randomBytes(32).toString('hex')
        user.token = token

        await writeDatabase(database)

        return res.status(200).json({
            token:token,
            user:{
                id:user.id,
                username: user.username
            }
        })
    } catch (error){
        console.error(error)

        return res.status(500).json({
            message: "Errore interno del server"
        })
    }
})

module.exports = ruoter