const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth.routes')
const favoritesRoutes = require('./routes/favorites.routes')

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/favorites', favoritesRoutes)

app.get("/api/health/", (req, res) => {
    res.json({status:'ok'})
})

app.listen(PORT, () => {
    console.log(`server listing on http://localhost:${PORT}`)
})