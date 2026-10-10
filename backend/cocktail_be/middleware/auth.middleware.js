const { readDatabase } = require('../services/database.service')

async function authenticateToken(req, res, next) {
    try{
        const authenticationHeader = req.headers.authorization

        if (!authenticationHeader){
            return res.status(401).json({
                message: "Token manacante"
            })
        }

        const parts = authenticationHeader.split(' ')

        if(parts.length !== 2 || parts[0] !== 'Bearer'){
            return res.status(401).json({
                message: 'Token non valido'
            })
        }

        const token = parts[1]

        const database = await readDatabase()

        const user = database.users.find(
            user => user.token === token
        )

        if(!user){
            return res.status(401).json({
                message: 'Token non valido'
            })
        }

        req.user = { id:user.id, username:user.username }
        next()
    } catch(error){
        console.error(error)

        return res.status(500).json({
            message: "Errore interno del server"
        })
    }
}

module.exports = authenticateToken