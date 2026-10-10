const express = require('express')
const authenticateToken = require('../middleware/auth.middleware')
const { readDatabase, writeDatabase } = require('../services/database.service')

const router = express.Router()
router.use(authenticateToken)

router.get('/', async (req, res) => {
    try {
        const database = await readDatabase()
        const favorites = database.favorites.filter(item => item.userId === req.user.id && item.active === true)
        return res.status(200).json(favorites)
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
})

// Importazione idempotente: un preferito già attivo non viene mai disattivato.
router.post('/import', async (req, res) => {
    const inputs = req.body?.favorites
    if (!Array.isArray(inputs) || inputs.length > 1000) {
        return res.status(400).json({ message: 'Elenco preferiti non valido' })
    }
    const unique = new Map()
    for (const input of inputs) {
        const id = typeof input?.id === 'string' || typeof input?.id === 'number' ? String(input.id).trim() : ''
        const name = typeof input?.name === 'string' ? input.name.trim() : ''
        const thumbnail = typeof input?.thumbnail === 'string' ? input.thumbnail.trim() : ''
        if (!/^\d+$/.test(id) || !name || !thumbnail) {
            return res.status(400).json({ message: 'Id, nome e thumbnail del cocktail sono obbligatori' })
        }
        try {
            if (!['http:', 'https:'].includes(new URL(thumbnail).protocol)) throw new Error('URL non valida')
        } catch {
            return res.status(400).json({ message: 'Thumbnail non valida' })
        }
        unique.set(id, { id, name, thumbnail })
    }
    try {
        const database = await readDatabase()
        for (const favorite of unique.values()) {
            const index = database.favorites.findIndex(item => item.userId === req.user.id && String(item.favorite?.id ?? item.cocktailId) === favorite.id)
            const record = { userId: req.user.id, favorite, active: true }
            if (index < 0) database.favorites.push(record)
            else database.favorites[index] = record
        }
        if (unique.size) await writeDatabase(database)
        return res.status(200).json(database.favorites.filter(item => item.userId === req.user.id && item.active === true))
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
})

router.post('/:userId/toggle', async (req, res) => {
    try {
        const userId = req.user.id
        const input = req.body?.favorite
        const id = typeof input?.id === 'string' || typeof input?.id === 'number' ? String(input.id).trim() : ''
        const name = typeof input?.name === 'string' ? input.name.trim() : ''
        const thumbnail = typeof input?.thumbnail === 'string' ? input.thumbnail.trim() : ''
        if (!/^\d+$/.test(id) || !name || !thumbnail) {
            return res.status(400).json({ message: 'Id, nome e thumbnail del cocktail sono obbligatori' })
        }
        let imageUrl
        try {
            imageUrl = new URL(thumbnail)
        } catch {
            return res.status(400).json({ message: 'Thumbnail non valida' })
        }
        if (!['http:', 'https:'].includes(imageUrl.protocol)) {
            return res.status(400).json({ message: 'Thumbnail non valida' })
        }

        const database = await readDatabase()
        const index = database.favorites.findIndex(item => item.userId === userId && String(item.favorite?.id ?? item.cocktailId) === id)
        const record = {
            userId: userId,
            favorite: { id: id, name: name, thumbnail: thumbnail },
            active: index < 0 ? true : !database.favorites[index].active
        }
        if (index < 0) {
            database.favorites.push(record)
        } else {
            database.favorites[index] = record
        }
        await writeDatabase(database)
        return res.status(201).json({
            ...record,
            message: record.active ? 'Cocktail aggiunto ai preferiti' : 'Cocktail rimosso dai preferiti'
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: 'Errore interno del server' })
    }
})

module.exports = router
