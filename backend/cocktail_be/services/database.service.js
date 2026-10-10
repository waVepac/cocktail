const fs = require('fs/promises')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')

async function readDatabase() {
    const content = await fs.readFile(DB_PATH, 'utf-8')

    return JSON.parse(content)
}

async function writeDatabase(data) {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

module.exports = {readDatabase, writeDatabase}